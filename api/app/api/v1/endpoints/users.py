"""User API route definitions."""

from fastapi import APIRouter, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


bearer_scheme = HTTPBearer()

user_router = APIRouter(prefix="/users", tags=["users"])


@user_router.get("/me")
async def get_users_me(
    _: HTTPAuthorizationCredentials = Security(bearer_scheme),
):
    """Return the authenticated user's profile.

    Args:
        _: Bearer authorization credentials supplied by FastAPI security.

    Returns:
        A JSON-serializable dictionary containing the user profile fields.
    """
    return {"id": "123", "first_name": "John", "last_name": "Doe"}
