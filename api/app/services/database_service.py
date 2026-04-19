from collections.abc import AsyncIterator
from importlib import import_module

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

from loguru import logger

from app.config import get_settings
from app.exceptions import DatabaseConnectionException

settings = get_settings()


engine = create_async_engine(settings.database_url)
DBSession = async_sessionmaker[AsyncSession](engine, expire_on_commit=False)


def import_models() -> None:
    import_module("app.modules.user.user_model")


async def get_db() -> AsyncIterator[AsyncSession]:
    db = DBSession()
    try:
        yield db
    finally:
        await db.close()


async def create_db_and_tables() -> None:
    """
    Create all database tables for local and dev environments.

    This function should be called during application startup to ensure
    all tables exist in the database in non-production environments.

    Raises:
        DatabaseConnectionException: If database connection is not available
    """
    if not settings.should_init_db_on_startup():
        logger.info(
            "Skipping automatic database table creation for environment '{}'.",
            settings.environment,
        )
        return

    if engine is None:
        logger.error(
            "Cannot create database tables: database engine is not initialized"
        )
        raise DatabaseConnectionException("Database connection is not available")

    try:
        import_models()
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        logger.info("Database tables created successfully")
    except SQLAlchemyError as e:
        logger.error(f"Failed to create database tables: {str(e)}")
        raise DatabaseConnectionException(
            f"Failed to create database tables: {str(e)}", e
        )
