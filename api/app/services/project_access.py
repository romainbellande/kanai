"""Project access and membership policy boundary."""

from enum import StrEnum
from typing import NoReturn
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.repositories.project_repository import ProjectRepository
from app.repositories.user_repository import UserRepository


class ProjectRole(StrEnum):
    """Project role requirements for access checks."""

    OWNER = "owner"
    MEMBER = "member"


class ProjectAccess:
    """Policy boundary for project access and membership decisions."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize the policy with a database session."""
        self._project_repository = ProjectRepository(session)
        self._user_repository = UserRepository(session)

    async def require_project(
        self,
        project_id: UUID,
        user_id: UUID,
        *,
        role: ProjectRole | None = None,
    ) -> Project:
        """Return a project when the user satisfies the requested access role."""
        project = await self._project_repository.get(project_id)
        if project is None:
            self._raise_project_not_found()

        owner = await self._project_repository.get_owner(project_id, user_id)
        member = await self._project_repository.get_member(project_id, user_id)
        if owner is None and (role == ProjectRole.OWNER or member is None):
            self._raise_project_not_found()

        return project

    async def validate_users_exist(self, user_ids: set[UUID]) -> None:
        """Validate that every user ID exists."""
        for user_id in user_ids:
            if await self._user_repository.get(user_id) is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Unknown user id: {user_id}",
                )

    @staticmethod
    def _raise_project_not_found() -> NoReturn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
