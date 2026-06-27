"""Task feature workflows."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import ProjectColumn, ProjectTaskChangeEvent
from app.models.task import Task, TaskDependency
from app.repositories.project_repository import ProjectRepository
from app.repositories.project_task_change_event_repository import (
    ProjectTaskChangeEventRepository,
)
from app.repositories.task_repository import TaskRepository
from app.schemas.task import (
    TaskCreate,
    TaskDestination,
    TaskRead,
    TaskUpdate,
    normalize_blocked_reason,
    normalize_task_priority,
    task_priority_to_storage,
)
from app.services.project_access import ProjectAccess


RANK_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
DEFAULT_TASK_RANK = "U"


class TaskService:
    """Feature service for project-scoped task workflows."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._project_access = ProjectAccess(session)
        self._project_repository = ProjectRepository(session)
        self._repository = TaskRepository(session)
        self._events = ProjectTaskChangeEventRepository(session)

    async def create(
        self,
        *,
        project_id: UUID,
        user_id: UUID,
        payload: TaskCreate,
    ) -> TaskRead:
        """Create a task in a project accessible to a user."""
        project = await self._project_access.require_project(project_id, user_id)
        if payload.assignee_id is not None:
            await self._project_access.validate_users_exist({payload.assignee_id})

        active_sprint = None
        if payload.include_in_active_sprint:
            active_sprint = await self._project_repository.get_active_sprint(
                project_id
            )
            if active_sprint is None or active_sprint.id is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Project has no active sprint",
                )

        column_id = (
            await self._resolve_column(
                project_id,
                payload.column_id,
                use_first_non_done=payload.include_in_active_sprint,
                done_column_id=project.done_column_id,
            )
        ).id
        if column_id is None:
            raise RuntimeError("Project column ID is missing")

        task = Task(
            project_id=project_id,
            sprint_id=active_sprint.id if active_sprint else None,
            column_id=column_id,
            title=payload.title,
            priority=task_priority_to_storage(payload.priority),
            story_points=payload.story_points,
            rank=await next_task_rank(self._repository, project_id, column_id),
            assignee_id=payload.assignee_id,
            description=payload.description,
            acceptance_criteria=payload.acceptance_criteria,
            tag=payload.tag,
            is_blocked=payload.is_blocked,
            blocked_reason=payload.blocked_reason if payload.is_blocked else None,
        )
        try:
            self._session.add(task)
            await self._session.flush()
            if task.id is None:
                raise RuntimeError("Task ID is missing")
            await self._replace_prerequisites(
                project_id, task.id, payload.prerequisite_task_ids
            )
            if task.story_points is not None:
                self._events.add(
                    ProjectTaskChangeEvent(
                        project_id=project_id,
                        task_id=task.id,
                        event_type="story_points_changed",
                        sprint_id=task.sprint_id,
                        previous_story_points=None,
                        new_story_points=task.story_points,
                        occurred_at=datetime.now(UTC),
                    )
                )
            if task.is_blocked:
                self._events.add(
                    ProjectTaskChangeEvent(
                        project_id=project_id,
                        task_id=task.id,
                        event_type="blocked_state_changed",
                        sprint_id=task.sprint_id,
                        is_blocked=True,
                        blocked_reason=task.blocked_reason,
                        occurred_at=datetime.now(UTC),
                    )
                )
            if active_sprint is not None and active_sprint.id is not None:
                self._events.add(
                    ProjectTaskChangeEvent(
                        project_id=project_id,
                        task_id=task.id,
                        event_type="sprint_scope_added",
                        sprint_id=active_sprint.id,
                        new_sprint_id=active_sprint.id,
                        new_story_points=task.story_points,
                        occurred_at=datetime.now(UTC),
                    )
                )
            await self._session.commit()
            await self._session.refresh(task)
        except Exception:
            await self._session.rollback()
            raise
        return task_to_read(task, payload.prerequisite_task_ids)

    async def list(
        self,
        *,
        project_id: UUID,
        user_id: UUID,
        title: str | None = None,
        limit: int | None = None,
        exclude_task_id: UUID | None = None,
    ) -> list[TaskRead]:
        """List tasks for a project accessible to a user."""
        await self._project_access.require_project(project_id, user_id)
        if title is None and limit is None and exclude_task_id is None:
            tasks = await self._repository.list_by_project(project_id)
        else:
            tasks = await self._repository.search_prerequisite_candidates(
                project_id,
                title=title,
                limit=limit or 10,
                exclude_task_id=exclude_task_id,
            )
        prerequisites = await self._repository.prerequisite_ids_by_task(
            project_id, {task.id for task in tasks if task.id is not None}
        )
        return [task_to_read(task, prerequisites.get(task.id, [])) for task in tasks]

    async def list_active_sprint(
        self, *, project_id: UUID, user_id: UUID
    ) -> list[TaskRead]:
        """List tasks selected into a project's active sprint."""
        await self._project_access.require_project(project_id, user_id)
        active_sprint = await self._project_repository.get_active_sprint(project_id)
        if active_sprint is None or active_sprint.id is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Active sprint not found",
            )
        tasks = await self._repository.list_by_project_and_sprint(
            project_id, active_sprint.id
        )
        prerequisites = await self._repository.prerequisite_ids_by_task(
            project_id, {task.id for task in tasks if task.id is not None}
        )
        return [task_to_read(task, prerequisites.get(task.id, [])) for task in tasks]

    async def get(self, *, project_id: UUID, task_id: UUID, user_id: UUID) -> TaskRead:
        """Get a single task from a project accessible to a user."""
        await self._project_access.require_project(project_id, user_id)
        task = await self._repository.get_by_project(project_id, task_id)
        if task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
            )
        prerequisites = await self._repository.prerequisite_ids_by_task(
            project_id, {task_id}
        )
        return task_to_read(task, prerequisites.get(task_id, []))

    async def update(
        self,
        *,
        project_id: UUID,
        task_id: UUID,
        user_id: UUID,
        payload: TaskUpdate,
    ) -> TaskRead:
        """Update a task in a project accessible to a user."""
        await self._project_access.require_project(project_id, user_id)
        task = await self._repository.get_by_project(project_id, task_id)
        if task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
            )

        updates = payload.update_values()
        assignee_id = updates.get("assignee_id")
        if isinstance(assignee_id, UUID):
            await self._project_access.validate_users_exist({assignee_id})
        column_id = updates.get("column_id")
        destination_column = None
        if isinstance(column_id, UUID):
            destination_column = await self._resolve_column(project_id, column_id)

        if "priority" in updates:
            updates["priority"] = task_priority_to_storage(payload.priority)
        prerequisite_task_ids = updates.pop("prerequisite_task_ids", None)
        story_points_changed = (
            "story_points" in updates and updates["story_points"] != task.story_points
        )
        previous_story_points = task.story_points
        blocked_state_changed = (
            "is_blocked" in updates and updates["is_blocked"] != task.is_blocked
        )
        new_blocked_reason = updates.get("blocked_reason", task.blocked_reason)
        if "is_blocked" in updates and updates["is_blocked"] is False:
            updates["blocked_reason"] = None
            new_blocked_reason = None
        elif updates.get("is_blocked") is True and "blocked_reason" not in updates:
            new_blocked_reason = task.blocked_reason
        elif "blocked_reason" in updates:
            submitted_reason = updates["blocked_reason"]
            new_blocked_reason = normalize_blocked_reason(
                submitted_reason if isinstance(submitted_reason, str) else None
            )
            updates["blocked_reason"] = new_blocked_reason
        previous_column = None
        if destination_column is not None and destination_column.id != task.column_id:
            previous_column = await self._resolve_column(project_id, task.column_id)

        try:
            for field_name, value in updates.items():
                setattr(task, field_name, value)
            if not task.is_blocked:
                task.blocked_reason = None
            if story_points_changed and task.sprint_id is not None:
                self._events.add(
                    ProjectTaskChangeEvent(
                        project_id=project_id,
                        task_id=task_id,
                        event_type="story_points_changed",
                        sprint_id=task.sprint_id,
                        previous_story_points=previous_story_points,
                        new_story_points=task.story_points,
                        occurred_at=datetime.now(UTC),
                    )
                )
            if blocked_state_changed:
                is_blocked = bool(task.is_blocked)
                self._events.add(
                    ProjectTaskChangeEvent(
                        project_id=project_id,
                        task_id=task_id,
                        event_type="blocked_state_changed",
                        sprint_id=task.sprint_id,
                        is_blocked=is_blocked,
                        blocked_reason=new_blocked_reason if is_blocked else None,
                        occurred_at=datetime.now(UTC),
                    )
                )
            if previous_column is not None and destination_column is not None:
                self._events.add(
                    _workflow_column_changed_event(
                        project_id=project_id,
                        task_id=task_id,
                        sprint_id=task.sprint_id,
                        previous_column=previous_column,
                        new_column=destination_column,
                    )
                )
            if prerequisite_task_ids is not None:
                await self._replace_prerequisites(
                    project_id, task_id, prerequisite_task_ids
                )
            await self._session.commit()
            await self._session.refresh(task)
        except Exception:
            await self._session.rollback()
            raise
        prerequisites = await self._repository.prerequisite_ids_by_task(
            project_id, {task_id}
        )
        return task_to_read(task, prerequisites.get(task_id, []))

    async def move(
        self,
        *,
        project_id: UUID,
        task_id: UUID,
        user_id: UUID,
        destination: TaskDestination,
    ) -> TaskRead:
        """Move a task to a board destination and persist its column and rank."""
        await self._project_access.require_project(project_id, user_id)
        task = await self._repository.get_by_project(project_id, task_id)
        if task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
            )

        destination_column = await self._resolve_column(project_id, destination.column_id)
        ordered_destination_tasks = await self._repository.list_by_project_and_column(
            project_id, destination.column_id
        )
        if _is_same_position(task, ordered_destination_tasks, destination):
            prerequisites = await self._repository.prerequisite_ids_by_task(
                project_id, {task_id}
            )
            return task_to_read(task, prerequisites.get(task_id, []))

        destination_tasks = [
            destination_task
            for destination_task in ordered_destination_tasks
            if destination_task.id != task_id
        ]
        before_rank, after_rank = _destination_neighbor_ranks(
            destination_tasks, destination
        )

        if (
            before_rank is not None
            and after_rank is not None
            and before_rank >= after_rank
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Task destination neighbors are out of order",
            )

        previous_column_id = task.column_id
        previous_column = (
            await self._resolve_column(project_id, previous_column_id)
            if previous_column_id != destination.column_id
            else None
        )
        task.column_id = destination.column_id
        task.rank = rank_between(before_rank, after_rank)
        if previous_column is not None:
            self._events.add(
                _workflow_column_changed_event(
                    project_id=project_id,
                    task_id=task_id,
                    sprint_id=task.sprint_id,
                    previous_column=previous_column,
                    new_column=destination_column,
                )
            )
        updated = await self._repository.update(task)
        prerequisites = await self._repository.prerequisite_ids_by_task(
            project_id, {task_id}
        )
        return task_to_read(updated, prerequisites.get(task_id, []))

    async def delete(self, *, project_id: UUID, task_id: UUID, user_id: UUID) -> None:
        """Delete a task from a project accessible to a user."""
        await self._project_access.require_project(project_id, user_id)
        task = await self._repository.get_by_project(project_id, task_id)
        if task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
            )
        await self._repository.delete(task)

    async def _resolve_column(
        self,
        project_id: UUID,
        column_id: UUID | None,
        *,
        use_first_non_done: bool = False,
        done_column_id: UUID | None = None,
    ) -> ProjectColumn:
        columns = await self._project_repository.list_columns_by_project(project_id)
        if column_id is None:
            if not columns:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Project has no columns",
                )
            column = (
                self._first_non_done_column(columns, done_column_id)
                if use_first_non_done
                else columns[0]
            )
        else:
            column = next(
                (column for column in columns if column.id == column_id), None
            )

        if column is None or column.id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Task column must belong to the project",
            )

        return column

    async def _replace_prerequisites(
        self,
        project_id: UUID,
        task_id: UUID,
        prerequisite_task_ids: list[UUID],
    ) -> None:
        if len(set(prerequisite_task_ids)) != len(prerequisite_task_ids):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Prerequisite tasks must be unique",
            )
        prerequisite_ids = set(prerequisite_task_ids)
        if task_id in prerequisite_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="A task cannot depend on itself",
            )
        matches = await self._repository.list_by_project_ids(project_id, prerequisite_ids)
        if {task.id for task in matches if task.id is not None} != prerequisite_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Prerequisite tasks must belong to the project",
            )
        await self._reject_dependency_cycle(project_id, task_id, prerequisite_ids)
        await self._repository.delete_outgoing_dependency_edges(task_id)
        self._repository.add_dependency_edges(
            [
                TaskDependency(
                    project_id=project_id,
                    dependent_task_id=task_id,
                    prerequisite_task_id=prerequisite_id,
                )
                for prerequisite_id in prerequisite_task_ids
            ]
        )

    async def _reject_dependency_cycle(
        self, project_id: UUID, task_id: UUID, prerequisite_ids: set[UUID]
    ) -> None:
        graph: dict[UUID, set[UUID]] = {}
        for edge in await self._repository.list_dependency_edges(project_id):
            if edge.dependent_task_id != task_id:
                graph.setdefault(edge.dependent_task_id, set()).add(
                    edge.prerequisite_task_id
                )
        graph[task_id] = prerequisite_ids

        visiting: set[UUID] = set()
        visited: set[UUID] = set()

        def visit(node: UUID) -> bool:
            if node in visiting:
                return True
            if node in visited:
                return False
            visiting.add(node)
            for prerequisite_id in graph.get(node, set()):
                if visit(prerequisite_id):
                    return True
            visiting.remove(node)
            visited.add(node)
            return False

        if visit(task_id):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Prerequisite tasks cannot create a cycle",
            )

    def _first_non_done_column(
        self,
        columns: list[ProjectColumn],
        done_column_id: UUID | None,
    ) -> ProjectColumn:
        non_done_column = next(
            (column for column in columns if column.id != done_column_id),
            None,
        )
        if non_done_column is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Project has no non-Done columns",
            )
        return non_done_column


def _workflow_column_changed_event(
    *,
    project_id: UUID,
    task_id: UUID,
    sprint_id: UUID | None,
    previous_column: ProjectColumn,
    new_column: ProjectColumn,
) -> ProjectTaskChangeEvent:
    if previous_column.id is None or new_column.id is None:
        raise RuntimeError("Workflow column ID is missing")
    return ProjectTaskChangeEvent(
        project_id=project_id,
        task_id=task_id,
        event_type="workflow_column_changed",
        sprint_id=sprint_id,
        previous_column_id=previous_column.id,
        previous_column_name=previous_column.name,
        previous_column_position=previous_column.position,
        new_column_id=new_column.id,
        new_column_name=new_column.name,
        new_column_position=new_column.position,
        occurred_at=datetime.now(UTC),
    )


def rank_between(before: str | None, after: str | None) -> str:
    """Return a lexicographic rank strictly between neighboring ranks."""
    if before is not None and after is not None and before >= after:
        raise ValueError("before rank must sort before after rank")

    base = len(RANK_ALPHABET)
    prefix = ""
    index = 0

    while True:
        before_digit = (
            RANK_ALPHABET.index(before[index])
            if before is not None and index < len(before)
            else 0
        )
        after_digit = (
            RANK_ALPHABET.index(after[index])
            if after is not None and index < len(after)
            else base - 1
        )

        if after_digit - before_digit > 1:
            return f"{prefix}{RANK_ALPHABET[(before_digit + after_digit) // 2]}"

        prefix = f"{prefix}{RANK_ALPHABET[before_digit]}"
        index += 1


async def next_task_rank(
    repository: TaskRepository, project_id: UUID, column_id: UUID
) -> str:
    """Append a task after the current end of a project column."""
    tasks = await repository.list_by_project_and_column(project_id, column_id)
    return rank_between(tasks[-1].rank, None) if tasks else DEFAULT_TASK_RANK


def task_to_read(task: Task, prerequisite_task_ids: list[UUID] | None = None) -> TaskRead:
    """Convert a task ORM model into an API response schema."""
    if task.id is None:
        raise RuntimeError("Task ID is missing")

    return TaskRead(
        id=task.id,
        project_id=task.project_id,
        sprint_id=task.sprint_id,
        column_id=task.column_id,
        title=task.title,
        priority=normalize_task_priority(task.priority),
        rank=task.rank,
        story_points=task.story_points,
        backlog_rank=task.backlog_rank,
        assignee_id=task.assignee_id,
        description=task.description,
        acceptance_criteria=task.acceptance_criteria,
        tag=task.tag,
        created_at=task.created_at,
        updated_at=task.updated_at,
        prerequisite_task_ids=prerequisite_task_ids or [],
        is_blocked=task.is_blocked,
        blocked_reason=task.blocked_reason,
    )


def _destination_neighbor_ranks(
    tasks: list[Task], destination: TaskDestination
) -> tuple[str | None, str | None]:
    if destination.before_task_id is None and destination.after_task_id is None:
        return (tasks[-1].rank if tasks else None, None)

    before_task = _task_for_neighbor(
        tasks, destination.before_task_id, "before_task_id"
    )
    after_task = _task_for_neighbor(tasks, destination.after_task_id, "after_task_id")

    if before_task is not None and after_task is not None:
        _require_adjacent_neighbors(tasks, before_task, after_task)

    return (
        before_task.rank if before_task is not None else None,
        after_task.rank if after_task is not None else None,
    )


def _task_for_neighbor(
    tasks: list[Task], task_id: UUID | None, field_name: str
) -> Task | None:
    if task_id is None:
        return None

    for task in tasks:
        if task.id == task_id:
            return task

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"{field_name} must belong to the destination column",
    )


def _require_adjacent_neighbors(
    tasks: list[Task], before_task: Task, after_task: Task
) -> None:
    before_index = _task_index(tasks, before_task)
    after_index = _task_index(tasks, after_task)
    if before_index is None or after_index is None or after_index != before_index + 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task destination neighbors must be adjacent",
        )


def _task_index(tasks: list[Task], target_task: Task) -> int | None:
    return next(
        (index for index, task in enumerate(tasks) if task.id == target_task.id),
        None,
    )


def _is_same_position(
    task: Task, ordered_destination_tasks: list[Task], destination: TaskDestination
) -> bool:
    if task.column_id != destination.column_id:
        return False

    task_index = next(
        (
            index
            for index, destination_task in enumerate(ordered_destination_tasks)
            if destination_task.id == task.id
        ),
        None,
    )
    if task_index is None:
        return False

    if (
        destination.before_task_id is None
        and destination.after_task_id is None
        and task_index == len(ordered_destination_tasks) - 1
    ):
        return True

    before_task_id = (
        ordered_destination_tasks[task_index - 1].id if task_index else None
    )
    after_task = (
        ordered_destination_tasks[task_index + 1]
        if task_index + 1 < len(ordered_destination_tasks)
        else None
    )
    return (
        destination.before_task_id == before_task_id
        and destination.after_task_id == (after_task.id if after_task else None)
    )
