from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


class Base(DeclarativeBase):
    pass


engine = create_async_engine(settings.database_url)
DBSession = async_sessionmaker[AsyncSession](engine, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    db = DBSession()
    try:
        yield db
    finally:
        await db.close()
