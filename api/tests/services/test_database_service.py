from collections.abc import AsyncIterator
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlmodel import SQLModel

from app.core.config import AuthSettings, Environment, Settings
from app.db import session as database_service


def build_settings(environment: Environment) -> Settings:
    return Settings(
        database_url="sqlite+aiosqlite:///./test.db",
        redis_url="redis://localhost:6379/0",
        environment=environment,
        auth=AuthSettings(
            discovery_endpoint="https://example.test/.well-known/openid-configuration",
            audience="kanai-api",
        ),
        client_origin="http://localhost:5173",
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


async def get_column_names(engine: AsyncEngine, table_name: str) -> list[str]:
    async with engine.connect() as connection:
        return await connection.run_sync(
            lambda sync_conn: [
                column["name"] for column in inspect(sync_conn).get_columns(table_name)
            ]
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
async def test_create_db_and_tables_resets_metadata_tables_in_local(
    monkeypatch: pytest.MonkeyPatch,
    engine: AsyncEngine,
) -> None:
    monkeypatch.setattr(database_service, "settings", build_settings(Environment.LOCAL))
    monkeypatch.setattr(database_service, "engine", engine)
    async with engine.begin() as connection:
        await connection.exec_driver_sql(
            'CREATE TABLE tasks (id VARCHAR, "rank" VARCHAR)'
        )

    await database_service.create_db_and_tables()

    columns = await get_column_names(engine, "tasks")
    assert "rank" not in columns
    assert "task_rank" in columns
    assert "column_id" in columns


@pytest.mark.asyncio
async def test_create_db_and_tables_skips_table_creation_outside_startup_envs(
    monkeypatch: pytest.MonkeyPatch,
    engine: AsyncEngine,
) -> None:
    monkeypatch.setattr(database_service, "settings", build_settings(Environment.PROD))
    monkeypatch.setattr(database_service, "engine", engine)

    await database_service.create_db_and_tables()

    assert "users" not in await get_table_names(engine)


@pytest.mark.asyncio
async def test_create_db_and_tables_does_not_repair_legacy_task_rank_in_prod(
    monkeypatch: pytest.MonkeyPatch,
    engine: AsyncEngine,
) -> None:
    monkeypatch.setattr(database_service, "settings", build_settings(Environment.PROD))
    monkeypatch.setattr(database_service, "engine", engine)
    async with engine.begin() as connection:
        await connection.exec_driver_sql(
            'CREATE TABLE tasks (id VARCHAR, "rank" VARCHAR)'
        )

    await database_service.create_db_and_tables()

    columns = await get_column_names(engine, "tasks")
    assert "rank" in columns
    assert "task_rank" not in columns
