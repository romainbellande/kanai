"""Persistence seam for Project Task Change Events."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import col

from app.models.project import ProjectTaskChangeEvent


class ProjectTaskChangeEventRepository:
    """Stores and reads append-only project task analytics events."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def has_events(self, project_id: UUID) -> bool:
        """Return whether a project has recorded analytics events."""
        count = await self._session.scalar(
            select(func.count())
            .select_from(ProjectTaskChangeEvent)
            .filter_by(project_id=project_id)
        )
        return bool(count)

    async def list_by_project(self, project_id: UUID) -> list[ProjectTaskChangeEvent]:
        """Return project task change events in append order."""
        events = await self._session.scalars(
            select(ProjectTaskChangeEvent)
            .filter_by(project_id=project_id)
            .order_by(
                col(ProjectTaskChangeEvent.occurred_at), col(ProjectTaskChangeEvent.id)
            )
        )
        return list(events.all())

    def add(self, event: ProjectTaskChangeEvent) -> None:
        """Stage an append-only project task change event."""
        self._session.add(event)
