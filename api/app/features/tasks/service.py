"""Task feature workflows."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import ProjectColumn
from app.models.task import Task
from app.repositories.project_repository import ProjectRepository
from app.repositories.task_repository import TaskRepository
from app.schemas.task import (
    TaskCreate,
    TaskDestination,
    TaskRead,
    TaskUpdate,
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
        )
        return task_to_read(await self._repository.create(task))

    async def list(self, *, project_id: UUID, user_id: UUID) -> list[TaskRead]:
        """List tasks for a project accessible to a user."""
        await self._project_access.require_project(project_id, user_id)
        tasks = await self._repository.list_by_project(project_id)
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
        if isinstance(column_id, UUID):
            await self._resolve_column(project_id, column_id)

        if "priority" in updates:
            updates["priority"] = task_priority_to_storage(payload.priority)

        for field_name, value in updates.items():
            setattr(task, field_name, value)

        updated = await self._repository.update(task)
        prerequisites = await self._repository.prerequisite_ids_by_task(
            project_id, {task_id}
        )
        return task_to_read(updated, prerequisites.get(task_id, []))

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

        await self._resolve_column(project_id, destination.column_id)
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

        task.column_id = destination.column_id
        task.rank = rank_between(before_rank, after_rank)
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
