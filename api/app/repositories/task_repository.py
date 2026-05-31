"""Persistence operations for project tasks."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task


class TaskRepository:
    """Stores and retrieves task records."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize the repository with a database session."""
        self._session = session

    async def create(self, task: Task) -> Task:
        """Persist and refresh a task."""
        self._session.add(task)
        await self._session.commit()
        await self._session.refresh(task)
        return task

    async def list_by_project(self, project_id: UUID) -> list[Task]:
        """Return all tasks that belong to a project."""
        tasks = await self._session.scalars(
            select(Task)
            .filter_by(project_id=project_id)
            .order_by("status", "task_rank", "created_at", "id")
        )
        return list(tasks.all())

    async def list_by_project_and_status(
        self, project_id: UUID, status: str
    ) -> list[Task]:
        """Return tasks in one project status ordered by rank."""
        tasks = await self._session.scalars(
            select(Task)
            .filter_by(project_id=project_id, status=status)
            .order_by("task_rank", "created_at", "id")
        )
        return list(tasks.all())

    async def get_by_project(self, project_id: UUID, task_id: UUID) -> Task | None:
        """Return one task by project and task ID."""
        return await self._session.scalar(
            select(Task).filter_by(id=task_id, project_id=project_id)
        )

    async def update(self, task: Task) -> Task:
        """Commit and refresh an updated task."""
        await self._session.commit()
        await self._session.refresh(task)
        return task

    async def delete(self, task: Task) -> None:
        """Delete a task."""
        await self._session.delete(task)
        await self._session.commit()

    async def delete_by_project(self, project_id: UUID) -> None:
        """Delete all tasks that belong to a project without committing."""
        tasks = await self.list_by_project(project_id)
        for task in tasks:
            await self._session.delete(task)
