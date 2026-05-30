"""FastAPI dependencies and access guards for project resources."""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.application.dto import AuthenticatedContext
from app.modules.project.project_model import Project, ProjectMember, ProjectOwner
from app.modules.user.user_model import User
from app.services.database_service import get_db


DatabaseSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(request: Request, session: DatabaseSession) -> User:
    """Resolve the authenticated database user from request context.

    Args:
        request: Incoming request containing authentication context in scope.
        session: Database session used to load the authenticated user.

    Returns:
        The authenticated user model.

    Raises:
        HTTPException: If authentication context is missing or the user cannot
            be found.
    """

    auth_context = request.scope.get("auth")
    if not isinstance(auth_context, AuthenticatedContext):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authenticated context",
        )

    user = await session.scalar(select(User).filter_by(externalId=auth_context.subject))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user not found",
        )

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_project_or_404(session: AsyncSession, project_id: UUID) -> Project:
    """Load a project or raise a not found response.

    Args:
        session: Database session used to load the project.
        project_id: ID of the project to load.

    Returns:
        The requested project.

    Raises:
        HTTPException: If the project does not exist.
    """

    project = await session.get(Project, project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    return project


async def require_project_access(
    session: AsyncSession,
    project_id: UUID,
    user_id: UUID,
) -> Project:
    """Require a user to have owner or member access to a project.

    Args:
        session: Database session used to load access records.
        project_id: ID of the project to check.
        user_id: ID of the user whose access is checked.

    Returns:
        The project when the user has access.

    Raises:
        HTTPException: If the project does not exist or the user lacks access.
    """

    project = await get_project_or_404(session, project_id)
    owner = await session.get(ProjectOwner, (project_id, user_id))
    member = await session.get(ProjectMember, (project_id, user_id))

    if owner is None and member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    return project


async def require_project_owner(
    session: AsyncSession,
    project_id: UUID,
    user_id: UUID,
) -> Project:
    """Require a user to own a project.

    Args:
        session: Database session used to load ownership records.
        project_id: ID of the project to check.
        user_id: ID of the user whose ownership is checked.

    Returns:
        The project when the user is an owner.

    Raises:
        HTTPException: If the project does not exist or the user is not an
            owner.
    """

    project = await get_project_or_404(session, project_id)
    owner = await session.get(ProjectOwner, (project_id, user_id))

    if owner is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    return project


async def validate_user_ids(session: AsyncSession, user_ids: set[UUID]) -> None:
    """Validate that every user ID exists.

    Args:
        session: Database session used to look up users.
        user_ids: User IDs to validate.

    Raises:
        HTTPException: If any user ID does not exist.
    """

    for user_id in user_ids:
        if await session.get(User, user_id) is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unknown user id: {user_id}",
            )
