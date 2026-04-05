from dataclasses import dataclass

import pytest

import main
from app.config import Environment, Settings
from app.modules.seeder import startup as startup_module


@dataclass
class FakeSession:
    label: str = "fake-session"


class FakeSessionContext:
    def __init__(self, session: FakeSession):
        self._session = session

    async def __aenter__(self) -> FakeSession:
        return self._session

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None


class FakeSessionFactory:
    def __init__(self, session: FakeSession):
        self._session = session
        self.calls = 0

    def __call__(self) -> FakeSessionContext:
        self.calls += 1
        return FakeSessionContext(self._session)


class FakeRunner:
    instances: list["FakeRunner"] = []

    def __init__(self, seeders, session):
        self.seeders = seeders
        self.session = session
        self.run_calls = 0
        type(self).instances.append(self)

    async def run(self) -> None:
        self.run_calls += 1


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


def test_settings_should_seed_db_on_startup() -> None:
    assert build_settings(Environment.LOCAL).should_seed_db_on_startup() is True
    assert build_settings(Environment.DEV).should_seed_db_on_startup() is True
    assert build_settings(Environment.STA).should_seed_db_on_startup() is False
    assert build_settings(Environment.PROD).should_seed_db_on_startup() is False


@pytest.mark.asyncio
@pytest.mark.parametrize("environment", [Environment.LOCAL, Environment.DEV])
async def test_seed_reference_data_executes_in_local_and_dev(
    monkeypatch: pytest.MonkeyPatch,
    environment: Environment,
) -> None:
    FakeRunner.instances.clear()
    fake_session = FakeSession()
    fake_session_factory = FakeSessionFactory(fake_session)
    seeders = [object()]

    monkeypatch.setattr(startup_module, "settings", build_settings(environment))
    monkeypatch.setattr(startup_module, "DBSession", fake_session_factory)
    monkeypatch.setattr(startup_module, "SeederRunner", FakeRunner)
    monkeypatch.setattr(startup_module, "get_seeders", lambda: seeders)

    await startup_module.seed_reference_data()

    assert fake_session_factory.calls == 1
    assert len(FakeRunner.instances) == 1
    assert FakeRunner.instances[0].seeders == seeders
    assert FakeRunner.instances[0].session is fake_session
    assert FakeRunner.instances[0].run_calls == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("environment", [Environment.STA, Environment.PROD])
async def test_seed_reference_data_skips_in_staging_and_prod(
    monkeypatch: pytest.MonkeyPatch,
    environment: Environment,
) -> None:
    FakeRunner.instances.clear()
    fake_session_factory = FakeSessionFactory(FakeSession())

    monkeypatch.setattr(startup_module, "settings", build_settings(environment))
    monkeypatch.setattr(startup_module, "DBSession", fake_session_factory)
    monkeypatch.setattr(startup_module, "SeederRunner", FakeRunner)

    await startup_module.seed_reference_data()

    assert fake_session_factory.calls == 0
    assert FakeRunner.instances == []


@pytest.mark.asyncio
async def test_seed_reference_data_is_noop_when_registry_is_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_session_factory = FakeSessionFactory(FakeSession())

    monkeypatch.setattr(startup_module, "settings", build_settings(Environment.LOCAL))
    monkeypatch.setattr(startup_module, "DBSession", fake_session_factory)
    monkeypatch.setattr(startup_module, "get_seeders", lambda: [])

    await startup_module.seed_reference_data()

    assert fake_session_factory.calls == 0


@pytest.mark.asyncio
async def test_main_lifespan_runs_db_setup_then_seeding_then_redis_shutdown(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    events: list[str] = []

    async def create_db_and_tables() -> None:
        events.append("create-db")

    async def seed_reference_data() -> None:
        events.append("seed")

    async def close_redis() -> None:
        events.append("redis-close")

    monkeypatch.setattr(main, "create_db_and_tables", create_db_and_tables)
    monkeypatch.setattr(main, "seed_reference_data", seed_reference_data)
    monkeypatch.setattr(main.redis_service, "aclose", close_redis)

    async with main.lifespan(main.app):
        events.append("yield")

    assert events == ["create-db", "seed", "yield", "redis-close"]
