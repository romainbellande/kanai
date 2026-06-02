"""Persistence operations for projects and project memberships."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel

from app.models.project import Project, ProjectColumn, ProjectMember, ProjectOwner


class ProjectRepository:
    """Stores and retrieves project records and relationships."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize the repository with a database session."""
        self._session = session

    async def add(self, project: Project) -> Project:
        """Add a project and flush so generated fields are available."""
        self._session.add(project)
        await self._session.flush()
        return project

    async def get(self, project_id: UUID) -> Project | None:
        """Return a project by ID."""
        return await self._session.get(Project, project_id)

    async def get_owner(self, project_id: UUID, user_id: UUID) -> ProjectOwner | None:
        """Return a project owner row by composite key."""
        return await self._session.get(ProjectOwner, (project_id, user_id))

    async def get_member(self, project_id: UUID, user_id: UUID) -> ProjectMember | None:
        """Return a project member row by composite key."""
        return await self._session.get(ProjectMember, (project_id, user_id))

    def add_owner(self, project_id: UUID, user_id: UUID) -> None:
        """Add a project owner row."""
        self._session.add(ProjectOwner(project_id=project_id, user_id=user_id))

    def add_member(self, project_id: UUID, user_id: UUID) -> None:
        """Add a project member row."""
        self._session.add(ProjectMember(project_id=project_id, user_id=user_id))

    def add_column(self, column: ProjectColumn) -> None:
        """Add a project workflow column row."""
        self._session.add(column)

    async def flush(self) -> None:
        """Flush pending changes so generated fields are available."""
        await self._session.flush()

    async def list_columns_by_project(self, project_id: UUID) -> list[ProjectColumn]:
        """Return project columns ordered by board position."""
        columns = await self._session.scalars(
            select(ProjectColumn)
            .filter_by(project_id=project_id)
            .order_by(SQLModel.metadata.tables["project_columns"].c.position)
        )
        return list(columns.all())

    async def list_owner_rows_by_project(self, project_id: UUID) -> list[ProjectOwner]:
        """Return owners for a project."""
        owners = await self._session.scalars(
            select(ProjectOwner).filter_by(project_id=project_id)
        )
        return list(owners.all())

    async def list_member_rows_by_project(
        self, project_id: UUID
    ) -> list[ProjectMember]:
        """Return members for a project."""
        members = await self._session.scalars(
            select(ProjectMember).filter_by(project_id=project_id)
        )
        return list(members.all())

    async def list_owner_rows_by_user(self, user_id: UUID) -> list[ProjectOwner]:
        """Return project ownership rows for a user."""
        owners = await self._session.scalars(
            select(ProjectOwner).filter_by(user_id=user_id)
        )
        return list(owners.all())

    async def list_member_rows_by_user(self, user_id: UUID) -> list[ProjectMember]:
        """Return project membership rows for a user."""
        members = await self._session.scalars(
            select(ProjectMember).filter_by(user_id=user_id)
        )
        return list(members.all())

    async def replace_owners(self, project_id: UUID, user_ids: set[UUID]) -> None:
        """Replace all owner rows for a project without committing."""
        for owner in await self.list_owner_rows_by_project(project_id):
            await self._session.delete(owner)
        for user_id in user_ids:
            self.add_owner(project_id, user_id)

    async def replace_members(self, project_id: UUID, user_ids: set[UUID]) -> None:
        """Replace all member rows for a project without committing."""
        for member in await self.list_member_rows_by_project(project_id):
            await self._session.delete(member)
        for user_id in user_ids:
            self.add_member(project_id, user_id)

    async def delete_relationships(self, project_id: UUID) -> None:
        """Delete owner and member rows for a project without committing."""
        for owner in await self.list_owner_rows_by_project(project_id):
            await self._session.delete(owner)
        for member in await self.list_member_rows_by_project(project_id):
            await self._session.delete(member)

    async def delete(self, project: Project) -> None:
        """Delete a project without committing."""
        await self._session.delete(project)

    async def commit(self) -> None:
        """Commit pending changes."""
        await self._session.commit()

    async def rollback(self) -> None:
        """Roll back pending changes."""
        await self._session.rollback()

    async def refresh(self, project: Project) -> None:
        """Refresh a project from the database."""
        await self._session.refresh(project)

    async def refresh_column(self, column: ProjectColumn) -> None:
        """Refresh a project column from the database."""
        await self._session.refresh(column)
