from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from fakeredis.aioredis import FakeRedis
from pydantic import BaseModel

import app.services.redis_service as redis_service_module
from app.config import Settings
from app.exceptions import (
    RedisDataValidationException,
    RedisKeyAlreadyExistsException,
    RedisKeyNotFoundException,
)
from app.services.redis_service import RedisService


class RedisUser(BaseModel):
    id: str
    name: str
    enabled: bool


class RedisUserPatch(BaseModel):
    name: str | None = None
    enabled: bool | None = None


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


def test_settings_include_redis_url() -> None:
    assert "redis_url" in Settings.model_fields


@pytest.mark.asyncio
async def test_create_returns_same_model_type(redis_service: RedisService) -> None:
    user = RedisUser(id="user-1", name="Alice", enabled=True)

    created = await redis_service.create("users:user-1", user)

    assert created == user
    assert isinstance(created, RedisUser)


@pytest.mark.asyncio
async def test_create_fails_when_key_exists(redis_service: RedisService) -> None:
    user = RedisUser(id="user-1", name="Alice", enabled=True)
    await redis_service.create("users:user-1", user)

    with pytest.raises(RedisKeyAlreadyExistsException):
        await redis_service.create("users:user-1", user)


@pytest.mark.asyncio
async def test_get_returns_requested_model_type(redis_service: RedisService) -> None:
    user = RedisUser(id="user-1", name="Alice", enabled=True)
    await redis_service.create("users:user-1", user)

    loaded = await redis_service.get("users:user-1", RedisUser)

    assert loaded == user
    assert isinstance(loaded, RedisUser)


@pytest.mark.asyncio
async def test_put_overwrites_value_and_applies_ttl(
    redis_service: RedisService,
) -> None:
    original_user = RedisUser(id="user-1", name="Alice", enabled=True)
    overwritten_user = RedisUser(id="user-1", name="Bob", enabled=False)

    await redis_service.create("users:user-1", original_user)
    await redis_service.put("users:user-1", overwritten_user, ttl_seconds=30)

    loaded = await redis_service.get("users:user-1", RedisUser)
    client = await redis_service._get_client()
    ttl = await client.ttl("users:user-1")

    assert loaded == overwritten_user
    assert 0 < ttl <= 30


@pytest.mark.asyncio
async def test_put_preserves_existing_ttl_when_none_is_passed(
    redis_service: RedisService,
) -> None:
    original_user = RedisUser(id="user-1", name="Alice", enabled=True)
    overwritten_user = RedisUser(id="user-1", name="Bob", enabled=False)

    await redis_service.put("users:user-1", original_user, ttl_seconds=30)

    client = await redis_service._get_client()
    initial_ttl = await client.ttl("users:user-1")

    await redis_service.put("users:user-1", overwritten_user)

    loaded = await redis_service.get("users:user-1", RedisUser)
    ttl = await client.ttl("users:user-1")

    assert loaded == overwritten_user
    assert 0 < ttl <= initial_ttl


@pytest.mark.asyncio
@pytest.mark.parametrize("ttl_seconds", [0, -1])
async def test_put_rejects_non_positive_ttl_values(
    redis_service: RedisService,
    ttl_seconds: int,
) -> None:
    user = RedisUser(id="user-1", name="Alice", enabled=True)

    with pytest.raises(RedisDataValidationException):
        await redis_service.put("users:user-1", user, ttl_seconds=ttl_seconds)


@pytest.mark.asyncio
async def test_get_returns_none_for_missing_key(redis_service: RedisService) -> None:
    loaded = await redis_service.get("users:missing", RedisUser)

    assert loaded is None


@pytest.mark.asyncio
async def test_get_raises_for_non_object_json(redis_service: RedisService) -> None:
    client = await redis_service._get_client()
    await client.set("users:user-1", '"unexpected-string"')

    with pytest.raises(RedisDataValidationException):
        await redis_service.get("users:user-1", RedisUser)


@pytest.mark.asyncio
async def test_patch_merges_top_level_fields(redis_service: RedisService) -> None:
    await redis_service.create(
        "users:user-1",
        RedisUser(id="user-1", name="Alice", enabled=True),
    )

    updated = await redis_service.patch(
        "users:user-1",
        RedisUserPatch(name="Bob"),
        RedisUser,
    )

    assert updated == RedisUser(id="user-1", name="Bob", enabled=True)
    assert isinstance(updated, RedisUser)


@pytest.mark.asyncio
async def test_patch_preserves_existing_ttl(redis_service: RedisService) -> None:
    await redis_service.put(
        "users:user-1",
        RedisUser(id="user-1", name="Alice", enabled=True),
        ttl_seconds=30,
    )

    client = await redis_service._get_client()
    initial_ttl = await client.ttl("users:user-1")

    await redis_service.patch(
        "users:user-1",
        RedisUserPatch(name="Bob"),
        RedisUser,
    )

    ttl = await client.ttl("users:user-1")

    assert 0 < ttl <= initial_ttl


@pytest.mark.asyncio
async def test_patch_fails_for_missing_key(redis_service: RedisService) -> None:
    with pytest.raises(RedisKeyNotFoundException):
        await redis_service.patch(
            "users:missing", RedisUserPatch(name="Bob"), RedisUser
        )


@pytest.mark.asyncio
async def test_delete_returns_true_when_key_exists(redis_service: RedisService) -> None:
    await redis_service.create(
        "users:user-1",
        RedisUser(id="user-1", name="Alice", enabled=True),
    )

    deleted = await redis_service.delete("users:user-1")

    assert deleted is True


@pytest.mark.asyncio
async def test_delete_returns_false_when_key_missing(
    redis_service: RedisService,
) -> None:
    deleted = await redis_service.delete("users:missing")

    assert deleted is False


@pytest.mark.asyncio
async def test_shared_client_is_reused(redis_service: RedisService) -> None:
    first = await redis_service._get_client()
    second = await redis_service._get_client()

    assert first is second


@pytest.mark.asyncio
async def test_cleanup_resets_shared_client(redis_service: RedisService) -> None:
    client = await redis_service._get_client()

    await redis_service.aclose()

    assert redis_service_module._redis_client is None
    assert client is not redis_service_module._redis_client
