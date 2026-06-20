"""Persistence operations for project tasks."""

from typing import Any, cast
from uuid import UUID

from sqlalchemy import column, delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task, TaskDependency


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
            .order_by(
                column("column_id"),
                column("task_rank"),
                column("created_at"),
                column("id"),
            )
        )
        return list(tasks.all())

    async def list_by_project_and_sprint(
        self, project_id: UUID, sprint_id: UUID
    ) -> list[Task]:
        """Return tasks in one project sprint ordered by board column and rank."""
        tasks = await self._session.scalars(
            select(Task)
            .filter_by(project_id=project_id, sprint_id=sprint_id)
            .order_by(
                column("column_id"),
                column("task_rank"),
                column("created_at"),
                column("id"),
            )
        )
        return list(tasks.all())

    async def list_backlog_candidates(
        self, project_id: UUID, done_column_id: UUID | None
    ) -> list[Task]:
        """Return unfinished non-sprint project tasks eligible for backlog."""
        statement = select(Task).filter_by(project_id=project_id, sprint_id=None)
        if done_column_id is not None:
            statement = statement.where(column("column_id") != done_column_id)
        tasks = await self._session.scalars(
            statement.order_by(
                column("backlog_rank"),
                column("created_at"),
                column("id"),
            )
        )
        return list(tasks.all())

    async def list_by_project_and_column(
        self, project_id: UUID, column_id: UUID
    ) -> list[Task]:
        """Return tasks in one project column ordered by rank."""
        tasks = await self._session.scalars(
            select(Task)
            .filter_by(project_id=project_id, column_id=column_id)
            .order_by(
                column("task_rank"),
                column("created_at"),
                column("id"),
            )
        )
        return list(tasks.all())

    async def get_by_project(self, project_id: UUID, task_id: UUID) -> Task | None:
        """Return one task by project and task ID."""
        return await self._session.scalar(
            select(Task).filter_by(id=task_id, project_id=project_id)
        )

    async def prerequisite_ids_by_task(
        self, project_id: UUID, task_ids: set[UUID]
    ) -> dict[UUID, list[UUID]]:
        """Return project-scoped prerequisite IDs keyed by dependent task ID."""
        if not task_ids:
            return {}
        dependency = cast(Any, TaskDependency).__table__.c
        task = cast(Any, Task).__table__.c
        rows = await self._session.execute(
            select(dependency.dependent_task_id, dependency.prerequisite_task_id)
            .select_from(
                cast(Any, TaskDependency).__table__.join(
                    cast(Any, Task).__table__,
                    dependency.prerequisite_task_id == task.id,
                )
            )
            .where(dependency.project_id == project_id)
            .where(task.project_id == project_id)
            .where(dependency.dependent_task_id.in_(task_ids))
        )
        result = {task_id: [] for task_id in task_ids}
        for dependent_task_id, prerequisite_task_id in rows:
            result[dependent_task_id].append(prerequisite_task_id)
        return result

    async def list_dependency_edges(self, project_id: UUID) -> list[TaskDependency]:
        """Return all dependency edges in one project."""
        edges = await self._session.scalars(
            select(TaskDependency).filter_by(project_id=project_id)
        )
        return list(edges.all())

    def add_dependency_edges(self, edges: list[TaskDependency]) -> None:
        """Stage dependency edges without committing."""
        self._session.add_all(edges)

    async def delete_dependency_edges_for_tasks(self, task_ids: set[UUID]) -> None:
        """Delete dependency edges touching task IDs without committing."""
        if not task_ids:
            return
        dependency = cast(Any, TaskDependency).__table__.c
        await self._session.execute(
            delete(TaskDependency).where(
                or_(
                    dependency.dependent_task_id.in_(task_ids),
                    dependency.prerequisite_task_id.in_(task_ids),
                )
            )
        )

    async def update(self, task: Task) -> Task:
        """Commit and refresh an updated task."""
        await self._session.commit()
        await self._session.refresh(task)
        return task

    async def delete(self, task: Task) -> None:
        """Delete a task."""
        if task.id is not None:
            await self.delete_dependency_edges_for_tasks({task.id})
        await self._session.delete(task)
        await self._session.commit()

    async def delete_by_project(self, project_id: UUID) -> None:
        """Delete all tasks that belong to a project without committing."""
        tasks = await self.list_by_project(project_id)
        await self.delete_dependency_edges_for_tasks(
            {task.id for task in tasks if task.id is not None}
        )
        for task in tasks:
            await self._session.delete(task)
