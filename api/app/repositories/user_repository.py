"""User persistence helpers."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.exceptions import AuthenticationServiceException
from app.models.user import User
from app.schemas.auth import AuthenticatedContext


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
                existing_user = await session.scalar(
                    select(User).filter_by(externalId=context.subject)
                )
                if existing_user is not None:
                    return

                session.add(User(externalId=context.subject))
                await session.commit()
            except IntegrityError:
                await session.rollback()
            except SQLAlchemyError as error:
                await session.rollback()
                raise AuthenticationServiceException(
                    "Authentication service unavailable",
                    original_error=error,
                ) from error
