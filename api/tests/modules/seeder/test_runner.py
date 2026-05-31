from collections.abc import AsyncIterator, Sequence
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

from app.models.user import User
from app.services.seeder_service import (
    BaseSeeder,
    SeederConfigurationError,
    SeederCycleError,
    SeederDependencyError,
    SeederRunner,
    SeedContext,
)


class RecordingSeeder(BaseSeeder):
    def __init__(
        self,
        name: str,
        events: list[str],
        depends_on: Sequence[str] = (),
    ):
        self.name = name
        self.depends_on = depends_on
        self._events = events

    async def seed(self, ctx: SeedContext) -> None:
        ctx.cache.setdefault("order", {})[self.name] = len(self._events)
        self._events.append(self.name)


class NamedSeeder(BaseSeeder):
    def __init__(self, name: str):
        self.name = name

    async def seed(self, ctx: SeedContext) -> None:
        return None


class CacheAwareSeeder(BaseSeeder):
    name = "cache_aware"

    async def seed(self, ctx: SeedContext) -> None:
        ctx.cache.setdefault("shared", {})["value"] = "from-first"


class CacheReaderSeeder(BaseSeeder):
    name = "cache_reader"
    depends_on = ("cache_aware",)

    def __init__(self, seen_values: list[str]):
        self._seen_values = seen_values

    async def seed(self, ctx: SeedContext) -> None:
        self._seen_values.append(ctx.cache["shared"]["value"])


class UserInsertSeeder(BaseSeeder):
    name = "user_insert"

    async def seed(self, ctx: SeedContext) -> None:
        await ctx.service.get_or_create(User, {"externalId": "rollback-user"})


class FailingSeeder(BaseSeeder):
    name = "failing"
    depends_on = ("user_insert",)

    async def seed(self, ctx: SeedContext) -> None:
        raise RuntimeError("seeding failed")


@pytest_asyncio.fixture
async def session_factory(
    tmp_path: Path,
) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    database_path = tmp_path / "runner.sqlite3"
    engine = create_async_engine(f"sqlite+aiosqlite:///{database_path}")

    async with engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False)

    try:
        yield factory
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_runner_orders_seeders_by_dependencies() -> None:
    events: list[str] = []
    seeders = [
        RecordingSeeder("third", events, depends_on=("second",)),
        RecordingSeeder("first", events),
        RecordingSeeder("second", events, depends_on=("first",)),
    ]

    runner = SeederRunner(seeders, AsyncSession())
    ordered = [seeder.name for seeder in runner._resolve_order()]

    assert ordered == ["first", "second", "third"]


def test_runner_raises_on_duplicate_seeder_names() -> None:
    with pytest.raises(SeederConfigurationError, match="Duplicate seeder name"):
        SeederRunner(
            [NamedSeeder("duplicate"), NamedSeeder("duplicate")], AsyncSession()
        )


def test_runner_raises_on_missing_dependency() -> None:
    seeder = RecordingSeeder("child", [], depends_on=("missing",))
    runner = SeederRunner([seeder], AsyncSession())

    with pytest.raises(SeederDependencyError, match="missing seeder 'missing'"):
        runner._resolve_order()


def test_runner_raises_on_dependency_cycle() -> None:
    first = RecordingSeeder("first", [], depends_on=("second",))
    second = RecordingSeeder("second", [], depends_on=("first",))
    runner = SeederRunner([first, second], AsyncSession())

    with pytest.raises(SeederCycleError, match="cycle"):
        runner._resolve_order()


@pytest.mark.asyncio
async def test_runner_shares_cache_across_seeders(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    seen_values: list[str] = []
    async with session_factory() as session:
        runner = SeederRunner(
            [CacheReaderSeeder(seen_values), CacheAwareSeeder()], session
        )

        await runner.run()

    assert seen_values == ["from-first"]


@pytest.mark.asyncio
async def test_runner_rolls_back_on_failure(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with session_factory() as session:
        runner = SeederRunner([UserInsertSeeder(), FailingSeeder()], session)

        with pytest.raises(RuntimeError, match="seeding failed"):
            await runner.run()

    async with session_factory() as verification_session:
        result = await verification_session.execute(
            select(User).filter_by(externalId="rollback-user")
        )

    assert result.scalar_one_or_none() is None
