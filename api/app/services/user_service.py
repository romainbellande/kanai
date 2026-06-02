"""Service functions for user workflows."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserRead, UserUpdate


def user_to_read(user: User) -> UserRead:
    """Convert a user model into its API response schema."""
    if user.id is None:
        raise RuntimeError("User ID is missing")

    return UserRead(
        id=user.id,
        external_id=user.externalId,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


async def get_user_or_404(session: AsyncSession, user_id: UUID) -> User:
    """Load a user or raise a not found response."""
    user = await UserRepository(session).get(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


async def create_user(session: AsyncSession, *, external_id: str) -> UserRead:
    """Create a user from an external identity provider subject."""
    repository = UserRepository(session)
    user = User(externalId=external_id)
    try:
        await repository.add(user)
        await repository.commit()
        await repository.refresh(user)
    except IntegrityError as error:
        await repository.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User external_id already exists",
        ) from error
    return user_to_read(user)


async def list_users(session: AsyncSession) -> list[UserRead]:
    """List users."""
    return [user_to_read(user) for user in await UserRepository(session).list()]


async def get_user(session: AsyncSession, user_id: UUID) -> UserRead:
    """Get a user by ID."""
    return user_to_read(await get_user_or_404(session, user_id))


async def update_user(
    session: AsyncSession,
    *,
    user_id: UUID,
    payload: UserUpdate,
) -> UserRead:
    """Update a user."""
    repository = UserRepository(session)
    user = await get_user_or_404(session, user_id)
    if payload.external_id is not None:
        user.externalId = payload.external_id

    try:
        await repository.commit()
        await repository.refresh(user)
    except IntegrityError as error:
        await repository.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User external_id already exists",
        ) from error
    return user_to_read(user)


async def delete_user(session: AsyncSession, user_id: UUID) -> None:
    """Delete a user."""
    repository = UserRepository(session)
    user = await get_user_or_404(session, user_id)
    await repository.delete(user)
    await repository.commit()
