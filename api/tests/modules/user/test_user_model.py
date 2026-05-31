import asyncio
from collections.abc import AsyncIterator
from pathlib import Path
from uuid import UUID

import pytest
import pytest_asyncio
from sqlalchemy import Uuid
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

from app.models.user import User


@pytest_asyncio.fixture
async def session(tmp_path: Path) -> AsyncIterator[AsyncSession]:
    database_path = tmp_path / "user_model.sqlite3"
    engine = create_async_engine(f"sqlite+aiosqlite:///{database_path}")
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)

    async with session_factory() as session:
        yield session

    await engine.dispose()


def test_user_model_uses_sqlmodel_metadata_with_expected_columns() -> None:
    columns = SQLModel.metadata.tables["users"].c

    assert User.__tablename__ == "users"
    assert User.metadata is SQLModel.metadata
    assert isinstance(columns.id.type, Uuid)
    assert columns.externalId.nullable is False
    assert columns.externalId.unique is True
    assert columns.created_at.nullable is False
    assert columns.created_at.server_default is not None
    assert columns.updated_at.nullable is False
    assert columns.updated_at.server_default is not None
    assert columns.updated_at.onupdate is not None


@pytest.mark.asyncio
async def test_user_model_persists_uuid_and_timestamp_defaults(
    session: AsyncSession,
) -> None:
    user = User(externalId="sqlmodel-user")
    session.add(user)

    await session.commit()
    await session.refresh(user)

    assert isinstance(user.id, UUID)
    assert user.created_at is not None
    assert user.updated_at is not None

    created_at = user.created_at
    updated_at = user.updated_at

    await asyncio.sleep(1.1)
    user.externalId = "sqlmodel-user-updated"

    await session.commit()
    await session.refresh(user)

    assert user.created_at == created_at
    assert user.updated_at is not None
    assert user.updated_at > updated_at
