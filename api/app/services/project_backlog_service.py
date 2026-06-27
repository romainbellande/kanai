"""Service workflows for project Backlog planning."""

from __future__ import annotations

from builtins import list as list_
from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import ProjectTaskChangeEvent
from app.models.task import Task, TaskDependency
from app.repositories.project_repository import ProjectRepository
from app.repositories.project_task_change_event_repository import (
    ProjectTaskChangeEventRepository,
)
from app.repositories.task_repository import TaskRepository
from app.schemas.project import ProjectBacklogReorder
from app.schemas.task import (
    BacklogTaskBulkCreate,
    TaskCreate,
    TaskRead,
    normalize_task_priority,
    task_priority_to_storage,
)
from app.services.project_access import ProjectAccess

RANK_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
DEFAULT_TASK_RANK = "U"


class ProjectBacklogService:
    """Coordinates project Backlog list and ordering workflows."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize the service with a database session."""
        self._session = session
        self._access = ProjectAccess(session)
        self._project_repository = ProjectRepository(session)
        self._task_repository = TaskRepository(session)
        self._events = ProjectTaskChangeEventRepository(session)

    async def list(self, project_id: UUID, user_id: UUID) -> list_[TaskRead]:
        """Return unfinished non-sprint tasks in Backlog order."""
        project = await self._access.require_project(project_id, user_id)
        tasks = self._sort_backlog_tasks(
            await self._task_repository.list_backlog_candidates(
                project_id,
                project.done_column_id,
            )
        )
        prerequisites = await self._task_repository.prerequisite_ids_by_task(
            project_id, {task.id for task in tasks if task.id is not None}
        )
        return [task_to_read(task, prerequisites.get(task.id, [])) for task in tasks]

    async def reorder(
        self,
        project_id: UUID,
        user_id: UUID,
        payload: ProjectBacklogReorder,
    ) -> list_[TaskRead]:
        """Persist a complete manual Backlog order."""
        project = await self._access.require_project(project_id, user_id)
        tasks = await self._task_repository.list_backlog_candidates(
            project_id,
            project.done_column_id,
        )
        tasks_by_id = {task.id: task for task in tasks if task.id is not None}
        if len(payload.task_ids) != len(tasks_by_id) or set(payload.task_ids) != set(
            tasks_by_id
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Backlog reorder must include each backlog task exactly once",
            )

        for index, task_id in enumerate(payload.task_ids):
            tasks_by_id[task_id].backlog_rank = _rank_for_index(index)

        await self._session.commit()
        return await self.list(project_id, user_id)

    async def create_task(
        self,
        project_id: UUID,
        user_id: UUID,
        payload: TaskCreate,
    ) -> TaskRead:
        """Create a task at the top of the project Backlog."""
        project = await self._access.require_project(project_id, user_id)
        if payload.assignee_id is not None:
            await self._access.validate_users_exist({payload.assignee_id})

        columns = await self._project_repository.list_columns_by_project(project_id)
        column = (
            next((column for column in columns if column.id == payload.column_id), None)
            if payload.column_id is not None
            else next(
                (column for column in columns if column.id != project.done_column_id),
                None,
            )
        )
        if column is None or column.id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Project column not found",
            )
        sprint_id: UUID | None = None
        if payload.include_in_active_sprint:
            sprint = await self._project_repository.get_active_sprint(project_id)
            if sprint is None or sprint.id is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Project has no active sprint",
                )
            sprint_id = sprint.id

        first_backlog_task = next(
            iter(
                self._sort_backlog_tasks(
                    await self._task_repository.list_backlog_candidates(
                        project_id,
                        project.done_column_id,
                    )
                )
            ),
            None,
        )
        task = Task(
            project_id=project_id,
            sprint_id=sprint_id,
            column_id=column.id,
            title=payload.title,
            priority=task_priority_to_storage(payload.priority),
            story_points=payload.story_points,
            rank=await self._next_task_rank(project_id, column.id),
            backlog_rank=(
                None
                if sprint_id is not None
                else rank_between(None, first_backlog_task.backlog_rank)
                if first_backlog_task and first_backlog_task.backlog_rank
                else DEFAULT_TASK_RANK
            ),
            assignee_id=payload.assignee_id,
            description=payload.description,
            acceptance_criteria=payload.acceptance_criteria,
            tag=payload.tag,
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
            if sprint_id is not None:
                self._events.add(
                    ProjectTaskChangeEvent(
                        project_id=project_id,
                        task_id=task.id,
                        event_type="sprint_scope_added",
                        sprint_id=sprint_id,
                        new_sprint_id=sprint_id,
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

    async def _replace_prerequisites(
        self,
        project_id: UUID,
        task_id: UUID,
        prerequisite_task_ids: list_[UUID],
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
        matches = await self._task_repository.list_by_project_ids(
            project_id, prerequisite_ids
        )
        if {task.id for task in matches if task.id is not None} != prerequisite_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Prerequisite tasks must belong to the project",
            )
        await self._reject_dependency_cycle(project_id, task_id, prerequisite_ids)
        await self._task_repository.delete_outgoing_dependency_edges(task_id)
        self._task_repository.add_dependency_edges(
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
        for edge in await self._task_repository.list_dependency_edges(project_id):
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

    async def create_tasks_bulk(
        self,
        project_id: UUID,
        user_id: UUID,
        payload: BacklogTaskBulkCreate,
    ) -> list_[TaskRead]:
        """Atomically save reviewed draft tasks into the Backlog."""
        project = await self._access.require_project(project_id, user_id)
        assignee_ids = {
            task.assignee_id for task in payload.tasks if task.assignee_id is not None
        }
        if assignee_ids:
            await self._access.validate_project_users(project_id, assignee_ids)

        columns = await self._project_repository.list_columns_by_project(project_id)
        column = next(
            (column for column in columns if column.id != project.done_column_id),
            None,
        )
        if column is None or column.id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Project has no non-Done columns",
            )

        backlog_tasks = self._sort_backlog_tasks(
            await self._task_repository.list_backlog_candidates(
                project_id,
                project.done_column_id,
            )
        )
        eligible_existing_ids: set[UUID] = {
            task.id for task in backlog_tasks if task.id is not None
        }
        draft_ids = {draft.key: uuid4() for draft in payload.tasks}
        self._validate_prerequisites(payload, eligible_existing_ids, draft_ids)

        existing_edges = [
            (edge.dependent_task_id, edge.prerequisite_task_id)
            for edge in await self._task_repository.list_dependency_edges(project_id)
        ]
        new_edges = self._resolved_edges(payload, draft_ids)
        self._reject_cycles(existing_edges + new_edges)

        board_rank = await self._next_task_rank(project_id, column.id)
        first_backlog_rank = backlog_tasks[0].backlog_rank if backlog_tasks else None
        backlog_rank: str | None = None
        saved_tasks: list_[Task] = []
        try:
            for draft in payload.tasks:
                backlog_rank = rank_between(backlog_rank, first_backlog_rank)
                task = Task(
                    id=draft_ids[draft.key],
                    project_id=project_id,
                    sprint_id=None,
                    column_id=column.id,
                    title=draft.title,
                    priority=task_priority_to_storage(draft.priority),
                    story_points=draft.story_points,
                    rank=board_rank,
                    backlog_rank=backlog_rank,
                    assignee_id=draft.assignee_id,
                    description=draft.description,
                    acceptance_criteria=draft.acceptance_criteria,
                    tag=draft.tag,
                )
                board_rank = rank_between(board_rank, None)
                self._session.add(task)
                saved_tasks.append(task)
            self._task_repository.add_dependency_edges(
                [
                    TaskDependency(
                        project_id=project_id,
                        dependent_task_id=dependent_id,
                        prerequisite_task_id=prerequisite_id,
                    )
                    for dependent_id, prerequisite_id in new_edges
                ]
            )
            await self._session.commit()
        except Exception:
            await self._session.rollback()
            raise

        for task in saved_tasks:
            await self._session.refresh(task)
        prerequisites = await self._task_repository.prerequisite_ids_by_task(
            project_id, set(draft_ids.values())
        )
        return [
            task_to_read(task, prerequisites.get(task.id, [])) for task in saved_tasks
        ]

    def _validate_prerequisites(
        self,
        payload: BacklogTaskBulkCreate,
        eligible_existing_ids: set[UUID],
        draft_ids: dict[str, UUID],
    ) -> None:
        for draft in payload.tasks:
            seen: set[tuple[str, str]] = set()
            for prerequisite in draft.prerequisites:
                ref = (
                    prerequisite.type,
                    prerequisite.key or str(prerequisite.task_id),
                )
                if ref in seen:
                    raise _invalid_bulk_payload("Duplicate prerequisite reference")
                seen.add(ref)
                if prerequisite.type == "draft":
                    if prerequisite.key == draft.key:
                        raise _invalid_bulk_payload("Task cannot depend on itself")
                    if prerequisite.key not in draft_ids:
                        raise _invalid_bulk_payload("Invalid prerequisite reference")
                elif prerequisite.task_id not in eligible_existing_ids:
                    raise _invalid_bulk_payload("Invalid prerequisite reference")

    def _resolved_edges(
        self, payload: BacklogTaskBulkCreate, draft_ids: dict[str, UUID]
    ) -> list_[tuple[UUID, UUID]]:
        edges: list_[tuple[UUID, UUID]] = []
        for draft in payload.tasks:
            dependent_id = draft_ids[draft.key]
            for prerequisite in draft.prerequisites:
                prerequisite_id = (
                    draft_ids[prerequisite.key]
                    if prerequisite.type == "draft" and prerequisite.key is not None
                    else prerequisite.task_id
                )
                if prerequisite_id is None or prerequisite_id == dependent_id:
                    raise _invalid_bulk_payload("Task cannot depend on itself")
                edges.append((dependent_id, prerequisite_id))
        return edges

    def _reject_cycles(self, edges: list_[tuple[UUID, UUID]]) -> None:
        graph: dict[UUID, list_[UUID]] = {}
        for dependent_id, prerequisite_id in edges:
            graph.setdefault(dependent_id, []).append(prerequisite_id)

        visiting: set[UUID] = set()
        visited: set[UUID] = set()

        def visit(task_id: UUID) -> None:
            if task_id in visiting:
                raise _invalid_bulk_payload("Task dependencies cannot contain cycles")
            if task_id in visited:
                return
            visiting.add(task_id)
            for prerequisite_id in graph.get(task_id, []):
                visit(prerequisite_id)
            visiting.remove(task_id)
            visited.add(task_id)

        for task_id in graph:
            visit(task_id)

    @staticmethod
    def _sort_backlog_tasks(tasks: list_[Task]) -> list_[Task]:
        return sorted(
            tasks,
            key=lambda task: (
                task.backlog_rank is None,
                task.backlog_rank or "",
                task.created_at,
                str(task.id),
            ),
        )

    async def _next_task_rank(self, project_id: UUID, column_id: UUID) -> str:
        tasks = await self._task_repository.list_by_project_and_column(
            project_id, column_id
        )
        return rank_between(tasks[-1].rank, None) if tasks else DEFAULT_TASK_RANK


def task_to_read(
    task: Task, prerequisite_task_ids: list[UUID] | None = None
) -> TaskRead:
    """Convert a task model into an API response schema."""
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
        is_blocked=task.is_blocked,
        blocked_reason=task.blocked_reason,
        tag=task.tag,
        created_at=task.created_at,
        updated_at=task.updated_at,
        prerequisite_task_ids=prerequisite_task_ids or [],
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


def _invalid_bulk_payload(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=detail
    )


def _rank_for_index(index: int) -> str:
    rank = DEFAULT_TASK_RANK
    for _ in range(index):
        rank = rank_between(rank, None)
    return rank
