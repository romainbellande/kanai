"""Service workflows for project Backlog planning."""

from __future__ import annotations

from builtins import list as list_
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.repositories.project_repository import ProjectRepository
from app.repositories.task_repository import TaskRepository
from app.schemas.project import ProjectBacklogReorder
from app.schemas.task import (
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

    async def list(self, project_id: UUID, user_id: UUID) -> list_[TaskRead]:
        """Return unfinished non-sprint tasks in Backlog order."""
        project = await self._access.require_project(project_id, user_id)
        return [
            task_to_read(task)
            for task in self._sort_backlog_tasks(
                await self._task_repository.list_backlog_candidates(
                    project_id,
                    project.done_column_id,
                )
            )
        ]

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
        column = next(
            (column for column in columns if column.id != project.done_column_id),
            None,
        )
        if column is None or column.id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Project has no non-Done columns",
            )

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
            sprint_id=None,
            column_id=column.id,
            title=payload.title,
            priority=task_priority_to_storage(payload.priority),
            rank=await self._next_task_rank(project_id, column.id),
            backlog_rank=rank_between(None, first_backlog_task.backlog_rank)
            if first_backlog_task and first_backlog_task.backlog_rank
            else DEFAULT_TASK_RANK,
            assignee_id=payload.assignee_id,
            description=payload.description,
            acceptance_criteria=payload.acceptance_criteria,
            tag=payload.tag,
        )
        return task_to_read(await self._task_repository.create(task))

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


def task_to_read(task: Task) -> TaskRead:
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
        backlog_rank=task.backlog_rank,
        assignee_id=task.assignee_id,
        description=task.description,
        acceptance_criteria=task.acceptance_criteria,
        tag=task.tag,
        created_at=task.created_at,
        updated_at=task.updated_at,
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


def _rank_for_index(index: int) -> str:
    rank = DEFAULT_TASK_RANK
    for _ in range(index):
        rank = rank_between(rank, None)
    return rank
