"""FastAPI dependencies for authenticated API requests."""

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import AuthenticatedContext


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

    user = await UserRepository(session).get_by_external_id(auth_context.subject)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user not found",
        )

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
