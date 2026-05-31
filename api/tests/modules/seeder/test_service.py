from collections.abc import AsyncIterator
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy import Column, String, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import Field, SQLModel

from app.models.user import User
from app.services.seeder_service import SeedService, SeederRunner, get_seeders


class SeederTestItem(SQLModel, table=True):
    __tablename__ = "seeder_test_items"  # type: ignore[bad-override]

    id: int | None = Field(default=None, primary_key=True)
    slug: str = Field(sa_column=Column(String(), nullable=False))
    label: str = Field(sa_column=Column(String(), nullable=False))
    note: str = Field(sa_column=Column(String(), nullable=False))


@pytest_asyncio.fixture
async def session(tmp_path: Path) -> AsyncIterator[AsyncSession]:
    database_path = tmp_path / "service.sqlite3"
    engine = create_async_engine(f"sqlite+aiosqlite:///{database_path}")
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)

    async with session_factory() as session:
        yield session

    await engine.dispose()


@pytest.mark.asyncio
async def test_get_or_create_returns_existing_row_without_creating_duplicate(
    session: AsyncSession,
) -> None:
    service = SeedService(session)
    existing = User(externalId="existing-user")
    session.add(existing)
    await session.commit()

    loaded = await service.get_or_create(User, {"externalId": "existing-user"})
    result = await session.execute(select(User).filter_by(externalId="existing-user"))

    assert loaded.id == existing.id
    assert len(result.scalars().all()) == 1


@pytest.mark.asyncio
async def test_get_or_create_creates_and_flushes_missing_row(
    session: AsyncSession,
) -> None:
    service = SeedService(session)

    created = await service.get_or_create(User, {"externalId": "created-user"})
    result = await session.execute(select(User).filter_by(externalId="created-user"))

    assert created.id is not None
    assert result.scalar_one().externalId == "created-user"


@pytest.mark.asyncio
async def test_upsert_by_unique_inserts_missing_rows(session: AsyncSession) -> None:
    service = SeedService(session)

    rows = [
        {"externalId": "seed-user-1"},
        {"externalId": "seed-user-2"},
    ]
    await service.upsert_by_unique(User, "externalId", rows)

    result = await session.execute(select(User).order_by(User.externalId))

    assert [user.externalId for user in result.scalars().all()] == [
        "seed-user-1",
        "seed-user-2",
    ]


@pytest.mark.asyncio
async def test_upsert_by_unique_updates_only_permitted_fields(
    session: AsyncSession,
) -> None:
    service = SeedService(session)
    existing = SeederTestItem(slug="item-1", label="Before", note="Keep")
    session.add(existing)
    await session.commit()

    await service.upsert_by_unique(
        SeederTestItem,
        "slug",
        [{"slug": "item-1", "label": "After", "note": "Changed"}],
        update_fields=["label"],
    )
    result = await session.execute(select(SeederTestItem).filter_by(slug="item-1"))
    updated = result.scalar_one()

    assert updated.label == "After"
    assert updated.note == "Keep"


@pytest.mark.asyncio
async def test_concrete_seeders_are_idempotent(session: AsyncSession) -> None:
    first_runner = SeederRunner(get_seeders(), session)
    await first_runner.run()

    second_runner = SeederRunner(get_seeders(), session)
    await second_runner.run()

    result = await session.execute(select(User).filter_by(externalId="seed-admin"))

    assert len(result.scalars().all()) == 1


def test_get_seeders_returns_explicit_registry_order() -> None:
    assert [seeder.name for seeder in get_seeders()] == ["seed_admin_user"]
