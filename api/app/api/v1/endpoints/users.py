"""User API route definitions."""

from uuid import UUID

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DatabaseSession
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.user_service import (
    create_user,
    delete_user,
    get_user,
    list_users,
    update_user,
    user_to_read,
)

user_router = APIRouter(prefix="/users", tags=["users"])


@user_router.get("/me", response_model=UserRead)
async def get_users_me(current_user: CurrentUser) -> UserRead:
    """Return the authenticated user's profile."""
    return user_to_read(current_user)


@user_router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user_endpoint(
    payload: UserCreate,
    session: DatabaseSession,
    _: CurrentUser,
) -> UserRead:
    """Create a user."""
    return await create_user(session, external_id=payload.external_id)


@user_router.get("", response_model=list[UserRead])
async def list_users_endpoint(
    session: DatabaseSession,
    _: CurrentUser,
    q: str | None = Query(default=None, max_length=255),
    limit: int | None = Query(default=None, ge=1, le=50),
) -> list[UserRead]:
    """List users."""
    return await list_users(session, search=q, limit=limit)


@user_router.get("/{user_id}", response_model=UserRead)
async def get_user_endpoint(
    user_id: UUID,
    session: DatabaseSession,
    _: CurrentUser,
) -> UserRead:
    """Get a user."""
    return await get_user(session, user_id)


@user_router.patch("/{user_id}", response_model=UserRead)
async def update_user_endpoint(
    user_id: UUID,
    payload: UserUpdate,
    session: DatabaseSession,
    _: CurrentUser,
) -> UserRead:
    """Update a user."""
    return await update_user(session, user_id=user_id, payload=payload)


@user_router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_endpoint(
    user_id: UUID,
    session: DatabaseSession,
    _: CurrentUser,
) -> None:
    """Delete a user."""
    await delete_user(session, user_id)
