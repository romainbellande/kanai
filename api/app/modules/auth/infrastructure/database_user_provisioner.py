"""Database-backed provisioning for authenticated users."""

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.modules.auth.application.dto import AuthenticatedContext
from app.modules.auth.domain.exceptions import AuthenticationServiceException
from app.modules.user.user_model import User


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
