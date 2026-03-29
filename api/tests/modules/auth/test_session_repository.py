from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from fakeredis.aioredis import FakeRedis

import app.services.redis_service as redis_service_module
from app.modules.auth.domain.session import Session
from app.modules.auth.infrastructure.redis_session_repository import (
    RedisSessionRepository,
)
from app.modules.auth.domain.value_objects import TokenFingerprint
from app.services.redis_service import RedisService


@pytest_asyncio.fixture
async def redis_service() -> AsyncIterator[RedisService]:
    fake_client = FakeRedis(decode_responses=True)
    redis_service_module._redis_client = fake_client
    service = RedisService()

    try:
        yield service
    finally:
        await fake_client.flushall()
        await fake_client.aclose()
        redis_service_module._redis_client = None


@pytest_asyncio.fixture
async def session_repository(
    redis_service: RedisService,
) -> AsyncIterator[RedisSessionRepository]:
    yield RedisSessionRepository(redis_service)


def build_session() -> Session:
    return Session(
        subject="user-1",
        issuer="https://issuer.test",
        expires_at=datetime.now(UTC) + timedelta(minutes=5),
        audience="api",
        claims={"role": "admin"},
    )


@pytest.mark.asyncio
async def test_save_and_get_round_trip(
    session_repository: RedisSessionRepository,
) -> None:
    fingerprint = TokenFingerprint("fingerprint-1")
    session = build_session()

    saved = await session_repository.save(fingerprint, session, ttl_seconds=60)
    loaded = await session_repository.get(fingerprint)

    assert saved == session
    assert loaded == session


@pytest.mark.asyncio
async def test_save_applies_ttl(
    session_repository: RedisSessionRepository,
    redis_service: RedisService,
) -> None:
    fingerprint = TokenFingerprint("fingerprint-1")

    await session_repository.save(fingerprint, build_session(), ttl_seconds=30)

    client = await redis_service._get_client()
    key = f"auth:sessions:{fingerprint.value}"
    ttl = await client.ttl(key)

    assert 0 < ttl <= 30


@pytest.mark.asyncio
async def test_get_returns_none_for_missing_session(
    session_repository: RedisSessionRepository,
) -> None:
    loaded = await session_repository.get(TokenFingerprint("missing"))

    assert loaded is None
