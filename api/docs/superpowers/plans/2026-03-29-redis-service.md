# Redis Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable async Redis service that stores JSON-backed Pydantic models by key, reuses one shared client, and is covered by pytest.

**Architecture:** Add a new `RedisService` under `app/services` that lazily initializes a shared `redis.asyncio.Redis` client and exposes `create`, `patch`, `get`, `delete`, and cleanup helpers. The public API stays model-aware by accepting `BaseModel` inputs and reconstructing typed models from Redis JSON payloads, while tests use `fakeredis` to avoid a real Redis dependency.

**Tech Stack:** Python 3.13, FastAPI, Pydantic v2, redis-py asyncio client, fakeredis, pytest, Ruff, Pyrefly

---

### Task 1: Add Redis Dependencies And Configuration

**Files:**
- Modify: `pyproject.toml`
- Modify: `app/config.py`
- Create: `tests/test_redis_service.py`

- [ ] **Step 1: Write the failing configuration test scaffold**

Create the first test file with a smoke assertion that will fail until `redis_url` exists on settings:

```python
from app.config import Settings


def test_settings_include_redis_url() -> None:
    assert "redis_url" in Settings.model_fields
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `uv run pytest tests/test_redis_service.py::test_settings_include_redis_url -q -n 0`
Expected: FAIL because `Settings` does not yet define `redis_url`.

- [ ] **Step 3: Update dependencies and settings minimally**

Add the Redis client and async fake Redis test dependency:

```toml
[project]
dependencies = [
    "alembic>=1.17.1",
    "asyncpg>=0.31.0",
    "authlib>=1.6.9",
    "cachetools>=7.0.5",
    "fastapi[standard]>=0.135.1",
    "httpx>=0.28.1",
    "joserfc>=1.6.3",
    "loguru>=0.7.3",
    "pydantic-settings>=2.13.1",
    "redis>=6.4.0",
    "sqlalchemy[asyncio]>=2.0.48",
    "uuid>=1.30",
    "uvicorn>=0.41.0",
]

[dependency-groups]
dev = [
    "fakeredis>=2.31.0",
    "pyrefly>=0.56.0",
    "pytest>=9.0.2",
    "pytest-asyncio>=1.3.0",
    "pytest-cov>=7.0.0",
    "pytest-env>=1.6.0",
    "pytest-httpx>=0.36.0",
    "pytest-xdist>=3.8.0",
    "ruff>=0.15.6",
]
```

Extend settings with the required Redis URL:

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", extra="allow", env_nested_delimiter="__"
    )

    database_url: str
    redis_url: str
    environment: Environment
    auth: AuthSettings
```

- [ ] **Step 4: Rerun the targeted test**

Run: `uv run pytest tests/test_redis_service.py::test_settings_include_redis_url -q -n 0`
Expected: PASS

- [ ] **Step 5: Commit the configuration slice**

```bash
git add pyproject.toml app/config.py tests/test_redis_service.py uv.lock
git commit -m "feat: add redis settings and dependencies"
```

### Task 2: Build The Shared Redis Service Core

**Files:**
- Modify: `app/exceptions.py`
- Create: `app/services/redis_service.py`
- Modify: `tests/test_redis_service.py`

- [ ] **Step 1: Write the failing create/get tests**

Expand the test file with a small model and core read/write tests:

```python
import pytest
from pydantic import BaseModel

from app.services.redis_service import RedisService


class RedisUser(BaseModel):
    id: str
    name: str
    enabled: bool


@pytest.mark.asyncio
async def test_create_returns_same_model_type(redis_service: RedisService) -> None:
    user = RedisUser(id="user-1", name="Alice", enabled=True)

    created = await redis_service.create("users:user-1", user)

    assert created == user
    assert isinstance(created, RedisUser)


@pytest.mark.asyncio
async def test_get_returns_requested_model_type(redis_service: RedisService) -> None:
    user = RedisUser(id="user-1", name="Alice", enabled=True)
    await redis_service.create("users:user-1", user)

    loaded = await redis_service.get("users:user-1", RedisUser)

    assert loaded == user
    assert isinstance(loaded, RedisUser)


@pytest.mark.asyncio
async def test_get_returns_none_for_missing_key(redis_service: RedisService) -> None:
    loaded = await redis_service.get("users:missing", RedisUser)

    assert loaded is None
```

- [ ] **Step 2: Run the targeted async tests to verify they fail**

Run: `uv run pytest tests/test_redis_service.py -k "create_returns_same_model_type or get_returns_requested_model_type or get_returns_none_for_missing_key" -q -n 0`
Expected: FAIL because `app.services.redis_service` and the `redis_service` fixture do not exist yet.

- [ ] **Step 3: Add focused Redis exception types**

Extend `app/exceptions.py` without changing existing behavior:

```python
class RedisServiceException(Exception):
    """Base exception for Redis service failures."""


class RedisKeyAlreadyExistsException(RedisServiceException):
    """Raised when create is called for an existing Redis key."""


class RedisKeyNotFoundException(RedisServiceException):
    """Raised when a requested Redis key does not exist."""


class RedisDataValidationException(RedisServiceException):
    """Raised when Redis JSON cannot be validated into a requested model."""


class RedisConnectionException(RedisServiceException):
    """Raised when Redis commands fail because the client is unavailable."""
```

- [ ] **Step 4: Implement the minimal shared Redis service with docstrings**

Create `app/services/redis_service.py` with the shared-client structure and `create` / `get` support first:

```python
from __future__ import annotations

import asyncio
from typing import TypeVar

from pydantic import BaseModel, ValidationError
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.config import get_settings
from app.exceptions import (
    RedisConnectionException,
    RedisDataValidationException,
    RedisKeyAlreadyExistsException,
)

settings = get_settings()

ModelT = TypeVar("ModelT", bound=BaseModel)

_redis_client: Redis | None = None
_redis_lock = asyncio.Lock()


class RedisService:
    """Shared async Redis service for storing JSON-backed Pydantic models by key."""

    async def _get_client(self) -> Redis:
        """Return the shared Redis client, creating it lazily on first use."""
        global _redis_client

        if _redis_client is not None:
            return _redis_client

        async with _redis_lock:
            if _redis_client is None:
                _redis_client = Redis.from_url(settings.redis_url, decode_responses=True)

        return _redis_client

    async def create(self, key: str, value: ModelT) -> ModelT:
        """Create a new Redis document from a Pydantic model and return it."""
        client = await self._get_client()
        payload = value.model_dump(mode="json")
        created = await client.set(key, value.model_dump_json(), nx=True)
        if not created:
            raise RedisKeyAlreadyExistsException(f"Redis key already exists: {key}")
        return type(value).model_validate(payload)

    async def get(self, key: str, model_type: type[ModelT]) -> ModelT | None:
        """Read a Redis document by key and validate it into the requested model type."""
        client = await self._get_client()
        raw_value = await client.get(key)
        if raw_value is None:
            return None
        try:
            return model_type.model_validate_json(raw_value)
        except ValidationError as exc:
            raise RedisDataValidationException(
                f"Redis data for key '{key}' could not be validated"
            ) from exc


redis_service = RedisService()
```

- [ ] **Step 5: Add a fake Redis fixture and rerun the targeted tests**

Expand `tests/test_redis_service.py` with a fixture that patches the shared module state:

```python
import pytest
import pytest_asyncio
from fakeredis.aioredis import FakeRedis

import app.services.redis_service as redis_service_module


@pytest_asyncio.fixture
async def redis_service() -> RedisService:
    fake_client = FakeRedis(decode_responses=True)
    redis_service_module._redis_client = fake_client
    service = RedisService()
    try:
        yield service
    finally:
        await fake_client.aclose()
        redis_service_module._redis_client = None
```

Run: `uv run pytest tests/test_redis_service.py -k "create_returns_same_model_type or get_returns_requested_model_type or get_returns_none_for_missing_key" -q -n 0`
Expected: PASS

- [ ] **Step 6: Commit the service core**

```bash
git add app/exceptions.py app/services/redis_service.py tests/test_redis_service.py
git commit -m "feat: add shared redis service core"
```

### Task 3: Implement Patch, Delete, Cleanup, And Failure Cases

**Files:**
- Modify: `app/services/redis_service.py`
- Modify: `main.py`
- Modify: `tests/test_redis_service.py`

- [ ] **Step 1: Write the failing patch/delete/lifecycle tests**

Add patch models and failure coverage:

```python
class RedisUserPatch(BaseModel):
    name: str | None = None
    enabled: bool | None = None


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


@pytest.mark.asyncio
async def test_patch_fails_for_missing_key(redis_service: RedisService) -> None:
    with pytest.raises(RedisKeyNotFoundException):
        await redis_service.patch("users:missing", RedisUserPatch(name="Bob"), RedisUser)


@pytest.mark.asyncio
async def test_delete_returns_true_when_key_exists(redis_service: RedisService) -> None:
    await redis_service.create(
        "users:user-1",
        RedisUser(id="user-1", name="Alice", enabled=True),
    )

    deleted = await redis_service.delete("users:user-1")

    assert deleted is True


@pytest.mark.asyncio
async def test_delete_returns_false_when_key_missing(redis_service: RedisService) -> None:
    deleted = await redis_service.delete("users:missing")

    assert deleted is False


@pytest.mark.asyncio
async def test_cleanup_resets_shared_client(redis_service: RedisService) -> None:
    client = await redis_service._get_client()

    await redis_service.aclose()

    assert redis_service_module._redis_client is None
    assert client is not redis_service_module._redis_client
```

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `uv run pytest tests/test_redis_service.py -k "patch_merges_top_level_fields or patch_fails_for_missing_key or delete_returns_true_when_key_exists or delete_returns_false_when_key_missing or cleanup_resets_shared_client" -q -n 0`
Expected: FAIL because `patch`, `delete`, and `aclose` do not exist yet.

- [ ] **Step 3: Implement patch, delete, cleanup, and Redis error translation**

Extend `app/services/redis_service.py`:

```python
from app.exceptions import (
    RedisConnectionException,
    RedisDataValidationException,
    RedisKeyAlreadyExistsException,
    RedisKeyNotFoundException,
)


class RedisService:
    ...

    async def patch(
        self,
        key: str,
        updates: BaseModel,
        model_type: type[ModelT],
    ) -> ModelT:
        """Apply a shallow top-level patch from a Pydantic model and return the updated model."""
        current = await self.get(key, model_type)
        if current is None:
            raise RedisKeyNotFoundException(f"Redis key was not found: {key}")

        current_payload = current.model_dump(mode="json")
        update_payload = updates.model_dump(exclude_unset=True, mode="json")
        merged_payload = {**current_payload, **update_payload}
        validated = model_type.model_validate(merged_payload)

        client = await self._get_client()
        await client.set(key, validated.model_dump_json())
        return validated

    async def delete(self, key: str) -> bool:
        """Delete a Redis document by key and report whether anything was removed."""
        client = await self._get_client()
        deleted = await client.delete(key)
        return deleted > 0

    async def aclose(self) -> None:
        """Close and reset the shared Redis client used by the service."""
        global _redis_client

        if _redis_client is None:
            return

        await _redis_client.aclose()
        _redis_client = None
```

Wrap Redis command calls in `try` / `except RedisError` and raise `RedisConnectionException` so connection failures are explicit.

- [ ] **Step 4: Wire application shutdown into FastAPI lifespan**

Update `main.py`:

```python
from app.services.database_service import create_db_and_tables
from app.services.redis_service import redis_service


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None]:
    await create_db_and_tables()
    yield
    await redis_service.aclose()
```

- [ ] **Step 5: Add remaining validation and reuse tests, then rerun the full Redis test file**

Add coverage for duplicate creates, invalid reconstruction, and shared client reuse:

```python
@pytest.mark.asyncio
async def test_create_fails_when_key_exists(redis_service: RedisService) -> None:
    user = RedisUser(id="user-1", name="Alice", enabled=True)
    await redis_service.create("users:user-1", user)

    with pytest.raises(RedisKeyAlreadyExistsException):
        await redis_service.create("users:user-1", user)


@pytest.mark.asyncio
async def test_get_raises_for_invalid_model_data(redis_service: RedisService) -> None:
    client = await redis_service._get_client()
    await client.set("users:user-1", '{"id":"user-1","name":"Alice","enabled":"not-a-bool"}')

    with pytest.raises(RedisDataValidationException):
        await redis_service.get("users:user-1", RedisUser)


@pytest.mark.asyncio
async def test_shared_client_is_reused(redis_service: RedisService) -> None:
    first = await redis_service._get_client()
    second = await redis_service._get_client()

    assert first is second
```

Run: `uv run pytest tests/test_redis_service.py -q -n 0`
Expected: PASS

- [ ] **Step 6: Commit the remaining service behavior**

```bash
git add app/services/redis_service.py main.py tests/test_redis_service.py
git commit -m "feat: finish redis service operations"
```

### Task 4: Verify The Whole Backend Slice

**Files:**
- Verify only: `pyproject.toml`, `uv.lock`, `app/config.py`, `app/exceptions.py`, `app/services/redis_service.py`, `main.py`, `tests/test_redis_service.py`

- [ ] **Step 1: Sync dependencies if `uv.lock` changed**

Run: `uv sync --group dev`
Expected: dependencies install successfully and `uv.lock` reflects `redis` / `fakeredis`.

- [ ] **Step 2: Run Ruff on the touched files**

Run: `uv run ruff check app/config.py app/exceptions.py app/services/redis_service.py main.py tests/test_redis_service.py`
Expected: PASS

- [ ] **Step 3: Run format check by formatting touched files if needed**

Run: `uv run ruff format app/config.py app/exceptions.py app/services/redis_service.py main.py tests/test_redis_service.py`
Expected: files are formatted with no syntax issues.

- [ ] **Step 4: Run type checking**

Run: `just typecheck`
Expected: PASS

- [ ] **Step 5: Run the requested backend tests**

Run: `just tests`
Expected: PASS, including the new Redis service tests.

- [ ] **Step 6: Commit the verification pass if any formatting or lockfile changes occurred**

```bash
git add pyproject.toml uv.lock app/config.py app/exceptions.py app/services/redis_service.py main.py tests/test_redis_service.py
git commit -m "test: verify redis service integration"
```
