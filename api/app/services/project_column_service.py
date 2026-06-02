"""Service boundary for project workflow columns."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import ProjectColumn
from app.repositories.project_repository import ProjectRepository
from app.schemas.project import ProjectColumnRead
from app.services.project_access import ProjectAccess, ProjectRole


DEFAULT_PROJECT_COLUMN_NAMES = ("To Do", "In Progress", "Done")


class ProjectColumnService:
    """Coordinates project-column access and persistence workflows."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize the service with a database session."""
        self._repository = ProjectRepository(session)
        self._access = ProjectAccess(session)

    def add_default_columns(self, project_id: UUID) -> None:
        """Add the default ordered workflow columns to a new project."""
        for position, name in enumerate(DEFAULT_PROJECT_COLUMN_NAMES):
            self._repository.add_column(
                ProjectColumn(project_id=project_id, name=name, position=position)
            )

    async def list(self, project_id: UUID, user_id: UUID) -> list[ProjectColumnRead]:
        """List ordered columns for a project accessible to the user."""
        await self._access.require_project(project_id, user_id)
        columns = await self._repository.list_columns_by_project(project_id)
        return [self._to_read(column) for column in columns]

    async def create(
        self,
        project_id: UUID,
        user_id: UUID,
        *,
        name: str,
    ) -> ProjectColumnRead:
        """Create a workflow column at the end of a project board."""
        await self._access.require_project(project_id, user_id, role=ProjectRole.OWNER)
        column_name = name.strip()
        if column_name == "":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Column name is required",
            )

        existing_columns = await self._repository.list_columns_by_project(project_id)
        if column_name.casefold() in {column.name.casefold() for column in existing_columns}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Column name already exists",
            )

        column = ProjectColumn(
            project_id=project_id,
            name=column_name,
            position=len(existing_columns),
        )
        self._repository.add_column(column)
        await self._repository.flush()
        await self._repository.commit()
        await self._repository.refresh_column(column)
        return self._to_read(column)

    @staticmethod
    def _to_read(column: ProjectColumn) -> ProjectColumnRead:
        if column.id is None:
            raise RuntimeError("Project column ID is missing")

        return ProjectColumnRead(
            id=column.id,
            project_id=column.project_id,
            name=column.name,
            position=column.position,
            created_at=column.created_at,
            updated_at=column.updated_at,
        )
