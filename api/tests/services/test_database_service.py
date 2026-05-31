from collections.abc import AsyncIterator
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlmodel import SQLModel

from app.core.config import Environment, Settings
from app.db import session as database_service


def build_settings(environment: Environment) -> Settings:
    return Settings(
        database_url="sqlite+aiosqlite:///./test.db",
        redis_url="redis://localhost:6379/0",
        environment=environment,
        auth={
            "discovery_endpoint": "https://example.test/.well-known/openid-configuration",
            "audience": "kanai-api",
        },
    )


@pytest_asyncio.fixture
async def engine(tmp_path: Path) -> AsyncIterator[AsyncEngine]:
    database_path = tmp_path / "database_service.sqlite3"
    test_engine = create_async_engine(f"sqlite+aiosqlite:///{database_path}")

    try:
        yield test_engine
    finally:
        await test_engine.dispose()


async def get_table_names(engine: AsyncEngine) -> list[str]:
    async with engine.connect() as connection:
        return await connection.run_sync(
            lambda sync_conn: inspect(sync_conn).get_table_names()
        )


@pytest.mark.asyncio
async def test_create_db_and_tables_creates_users_table_in_local(
    monkeypatch: pytest.MonkeyPatch,
    engine: AsyncEngine,
) -> None:
    monkeypatch.setattr(database_service, "settings", build_settings(Environment.LOCAL))
    monkeypatch.setattr(database_service, "engine", engine)

    await database_service.create_db_and_tables()

    assert "users" in await get_table_names(engine)
    assert database_service.SQLModel.metadata is SQLModel.metadata


@pytest.mark.asyncio
async def test_create_db_and_tables_skips_table_creation_outside_startup_envs(
    monkeypatch: pytest.MonkeyPatch,
    engine: AsyncEngine,
) -> None:
    monkeypatch.setattr(database_service, "settings", build_settings(Environment.PROD))
    monkeypatch.setattr(database_service, "engine", engine)

    await database_service.create_db_and_tables()

    assert "users" not in await get_table_names(engine)
