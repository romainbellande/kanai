"""FastAPI dependencies for authenticated API requests."""

from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import AuthenticatedContext
from app.services.auth_service import RequestAuthBoundary


class _NoopAuthenticateRequest:
    async def execute(self, bearer_token: str) -> AuthenticatedContext:
        del bearer_token
        raise AssertionError("Request authentication is handled by middleware")


DatabaseSession = Annotated[AsyncSession, Depends(get_db)]

request_auth_boundary = RequestAuthBoundary(
    authenticate_request=_NoopAuthenticateRequest()
)


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

    return await request_auth_boundary.current_user(request, session)


CurrentUser = Annotated[User, Depends(get_current_user)]
