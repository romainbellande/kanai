from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.modules.auth.application.dto import AuthenticatedContext
from app.modules.auth.domain.exceptions import AuthenticationServiceException
from app.modules.user.user_model import User


class DatabaseUserProvisioner:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def provision(self, context: AuthenticatedContext) -> None:
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
