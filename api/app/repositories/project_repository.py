"""Persistence operations for projects and project memberships."""

from uuid import UUID

from sqlalchemy import column, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel

from app.models.project import (
    Project,
    ProjectChatMessage,
    ProjectColumn,
    ProjectMember,
    ProjectOwner,
    ProjectSprint,
    ProjectSprintTaskSnapshot,
    SprintLifecycleState,
)


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

    async def add_sprint(self, sprint: ProjectSprint) -> ProjectSprint:
        """Add a project sprint and flush so generated fields are available."""
        self._session.add(sprint)
        await self._session.flush()
        return sprint

    async def get_column(self, column_id: UUID) -> ProjectColumn | None:
        """Return a project workflow column by ID."""
        return await self._session.get(ProjectColumn, column_id)

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

    async def get_active_sprint(self, project_id: UUID) -> ProjectSprint | None:
        """Return the active sprint for a project, if one exists."""
        sprint_table = SQLModel.metadata.tables["project_sprints"]
        sprint = await self._session.scalars(
            select(ProjectSprint)
            .filter_by(
                project_id=project_id,
                lifecycle_state=SprintLifecycleState.ACTIVE,
            )
            .order_by(sprint_table.c.created_at.desc(), sprint_table.c.id)
        )
        return sprint.first()

    async def list_closed_sprints(self, project_id: UUID) -> list[ProjectSprint]:
        """Return closed project sprints newest first."""
        sprint_table = SQLModel.metadata.tables["project_sprints"]
        sprints = await self._session.scalars(
            select(ProjectSprint)
            .filter_by(
                project_id=project_id, lifecycle_state=SprintLifecycleState.CLOSED
            )
            .order_by(sprint_table.c.closed_at.desc(), sprint_table.c.created_at.desc())
        )
        return list(sprints.all())

    async def list_sprint_task_snapshots(
        self,
        sprint_id: UUID,
    ) -> list[ProjectSprintTaskSnapshot]:
        """Return historical task snapshots for one sprint."""
        snapshots = await self._session.scalars(
            select(ProjectSprintTaskSnapshot)
            .filter_by(sprint_id=sprint_id)
            .order_by(
                column("outcome"),
                column("column_id"),
                column("rank"),
                column("created_at"),
            )
        )
        return list(snapshots.all())

    async def count_sprints_by_project(self, project_id: UUID) -> int:
        """Return the number of sprints created for a project."""
        count = await self._session.scalar(
            select(func.count())
            .select_from(ProjectSprint)
            .filter_by(project_id=project_id)
        )
        return int(count or 0)

    async def list_sprints_by_project(self, project_id: UUID) -> list[ProjectSprint]:
        """Return every sprint for a project ordered by planned timebox."""
        sprints = await self._session.scalars(
            select(ProjectSprint)
            .filter_by(project_id=project_id)
            .order_by(column("planned_start_date"), column("planned_end_date"))
        )
        return list(sprints.all())

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

    async def delete_chat_messages(self, project_id: UUID) -> None:
        """Delete chat messages for a project without committing."""
        messages = await self._session.scalars(
            select(ProjectChatMessage).filter_by(project_id=project_id)
        )
        for message in messages.all():
            await self._session.delete(message)

    async def delete_sprints(self, project_id: UUID) -> None:
        """Delete sprint rows for a project without committing."""
        sprints = await self._session.scalars(
            select(ProjectSprint).filter_by(project_id=project_id)
        )
        for sprint in sprints.all():
            await self._session.delete(sprint)

    async def delete(self, project: Project) -> None:
        """Delete a project without committing."""
        await self._session.delete(project)

    async def delete_column(self, column: ProjectColumn) -> None:
        """Delete a project workflow column without committing."""
        await self._session.delete(column)

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

    async def refresh_sprint(self, sprint: ProjectSprint) -> None:
        """Refresh a project sprint from the database."""
        await self._session.refresh(sprint)
