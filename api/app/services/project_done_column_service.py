"""Service workflows for project Done Column designation."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.project_repository import ProjectRepository
from app.schemas.project import ProjectDoneColumnRead
from app.services.project_access import ProjectAccess, ProjectRole


class ProjectDoneColumnService:
    """Coordinates Done Column configuration for projects."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize the service with a database session."""
        self._repository = ProjectRepository(session)
        self._access = ProjectAccess(session)

    async def get(self, project_id: UUID, user_id: UUID) -> ProjectDoneColumnRead:
        """Return the Done Column designation visible to a project participant."""
        project = await self._access.require_project(project_id, user_id)
        columns = await self._repository.list_columns_by_project(project_id)
        column_ids = {column.id for column in columns}
        if project.done_column_id in column_ids:
            return self._to_read(project_id, project.done_column_id)

        done_columns = [
            column
            for column in columns
            if column.name.strip().casefold() == "done" and column.id is not None
        ]
        if len(done_columns) == 1:
            project.done_column_id = done_columns[0].id
            await self._repository.commit()
            await self._repository.refresh(project)
            return self._to_read(project_id, project.done_column_id)

        return self._to_read(project_id, None)

    async def update(
        self,
        project_id: UUID,
        user_id: UUID,
        *,
        done_column_id: UUID,
    ) -> ProjectDoneColumnRead:
        """Change the Done Column designation for a project owner."""
        project = await self._access.require_project(
            project_id,
            user_id,
            role=ProjectRole.OWNER,
        )
        column = await self._repository.get_column(done_column_id)
        if column is None or column.project_id != project_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Column not found",
            )

        project.done_column_id = done_column_id
        await self._repository.commit()
        await self._repository.refresh(project)
        return self._to_read(project_id, project.done_column_id)

    @staticmethod
    def _to_read(
        project_id: UUID,
        done_column_id: UUID | None,
    ) -> ProjectDoneColumnRead:
        return ProjectDoneColumnRead(
            project_id=project_id,
            done_column_id=done_column_id,
            requires_designation=done_column_id is None,
        )
