"""User persistence helpers."""

from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlmodel import col

from app.core.exceptions import AuthenticationServiceException
from app.models.user import User
from app.schemas.auth import AuthenticatedContext


def _preferred_username_from_claims(context: AuthenticatedContext) -> str | None:
    preferred_username = context.claims.get("preferred_username")
    if not isinstance(preferred_username, str):
        return None

    username = preferred_username.strip()
    return username or None


class UserRepository:
    """Stores and retrieves user records."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize the repository with a database session."""
        self._session = session

    async def get(self, user_id: UUID) -> User | None:
        """Return a user by primary key."""
        return await self._session.get(User, user_id)

    async def get_by_external_id(self, external_id: str) -> User | None:
        """Return a user by external identity provider ID."""
        return await self._session.scalar(
            select(User).filter_by(externalId=external_id)
        )

    async def list(self, *, search: str | None = None, limit: int | None = None) -> list[User]:
        """Return users ordered by external identity, optionally filtered by identity text."""
        statement = select(User)
        search_text = search.strip() if search is not None else ""
        if search_text:
            pattern = f"%{search_text}%"
            statement = statement.where(
                or_(
                    col(User.display_name).ilike(pattern),
                    col(User.externalId).ilike(pattern),
                )
            )
        statement = statement.order_by(User.externalId)
        if limit is not None:
            statement = statement.limit(limit)

        users = await self._session.scalars(statement)
        return list(users.all())

    async def add(self, user: User) -> User:
        """Add a user and flush so generated fields are available."""
        self._session.add(user)
        await self._session.flush()
        return user

    async def delete(self, user: User) -> None:
        """Delete a user without committing."""
        await self._session.delete(user)

    async def commit(self) -> None:
        """Commit pending changes."""
        await self._session.commit()

    async def rollback(self) -> None:
        """Roll back pending changes."""
        await self._session.rollback()

    async def refresh(self, user: User) -> None:
        """Refresh a user from the database."""
        await self._session.refresh(user)


class DatabaseUserProvisioner:
    """Provisions authenticated principals as database users."""

    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        """Initialize the provisioner with a database session factory.

        Args:
            session_factory: Factory used to create asynchronous database sessions.
        """
        self._session_factory = session_factory

    async def provision(self, context: AuthenticatedContext) -> None:
        """Ensure an authenticated context has a persisted user record.

        Args:
            context: Authenticated identity details used to locate or create a user.

        Raises:
            AuthenticationServiceException: If the database cannot complete the
                provisioning operation.
        """
        async with self._session_factory() as session:
            try:
                preferred_username = _preferred_username_from_claims(context)
                existing_user = await session.scalar(
                    select(User).filter_by(externalId=context.subject)
                )
                if existing_user is not None:
                    if preferred_username is not None and (
                        existing_user.preferred_username != preferred_username
                        or existing_user.display_name != preferred_username
                    ):
                        existing_user.preferred_username = preferred_username
                        existing_user.display_name = preferred_username
                        await session.commit()
                    return

                session.add(
                    User(
                        externalId=context.subject,
                        display_name=preferred_username,
                        preferred_username=preferred_username,
                    )
                )
                await session.commit()
            except IntegrityError:
                await session.rollback()
            except SQLAlchemyError as error:
                await session.rollback()
                raise AuthenticationServiceException(
                    "Authentication service unavailable",
                    original_error=error,
                ) from error
