# Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a DDD-style authentication bounded context that validates bearer tokens with `joserfc`, caches discovery and JWKS metadata for 1 hour, reuses Redis for server-side sessions, and protects FastAPI requests through pure ASGI middleware.

**Architecture:** Place all auth behavior under `app/modules/auth/` with `domain`, `application`, `infrastructure`, and `interface` layers. Keep the middleware thin, push request-authentication decisions into an `AuthenticateRequest` use case, adapt Redis and OIDC/JWKS concerns in infrastructure, and reuse the existing shared `RedisService` instead of creating a second Redis lifecycle.

**Tech Stack:** Python 3.13, FastAPI, Pydantic v2, `joserfc`, `httpx`, `cachetools`, `redis.asyncio`, `fakeredis`, `pytest`, `pytest-httpx`, Ruff, Pyrefly

---

## Planned File Map

- Create: `app/modules/auth/domain/exceptions.py`
  Purpose: auth-domain exception types raised by lower layers before interface-level HTTP mapping.
- Create: `app/modules/auth/domain/value_objects.py`
  Purpose: token fingerprint generation and Redis key derivation.
- Create: `app/modules/auth/domain/session.py`
  Purpose: Pydantic-backed auth session model and expiration behavior.
- Create: `app/modules/auth/domain/repositories.py`
  Purpose: `SessionRepository` protocol used by the application layer.
- Create: `app/modules/auth/application/dto.py`
  Purpose: authenticated context returned to middleware and reusable by the verifier/use case.
- Create: `app/modules/auth/application/ports.py`
  Purpose: `TokenVerifier` protocol consumed by the use case.
- Create: `app/modules/auth/application/authenticate_request.py`
  Purpose: orchestrate session reuse, token verification, session persistence, and TTL capping.
- Create: `app/modules/auth/infrastructure/redis_session_repository.py`
  Purpose: persist `Session` objects via the shared `RedisService`.
- Create: `app/modules/auth/infrastructure/oidc_metadata_provider.py`
  Purpose: fetch and cache discovery and JWKS payloads with 1-hour `TTLCache` entries.
- Create: `app/modules/auth/infrastructure/joserfc_token_verifier.py`
  Purpose: verify JWTs from discovered JWKS and map library failures to auth exceptions.
- Create: `app/modules/auth/interface/http_exceptions.py`
  Purpose: custom FastAPI `HTTPException` types for auth failures.
- Create: `app/modules/auth/interface/auth_middleware.py`
  Purpose: pure ASGI entry point that bypasses whitelisted routes, parses headers, calls the use case, and populates `scope["auth"]`.
- Modify: `app/services/redis_service.py`
  Purpose: add one TTL-aware overwrite helper so auth infrastructure can persist sessions without bypassing the shared service.
- Modify: `main.py`
  Purpose: wire the auth bounded context and register the middleware.
- Modify: `tests/test_redis_service.py`
  Purpose: cover the new TTL-aware write helper.
- Create: `tests/modules/auth/test_session_domain.py`
  Purpose: domain tests for fingerprints and session expiration.
- Create: `tests/modules/auth/test_session_repository.py`
  Purpose: Redis-backed session repository tests with `fakeredis`.
- Create: `tests/modules/auth/test_oidc_metadata_provider.py`
  Purpose: metadata and JWKS caching / failure mapping tests.
- Create: `tests/modules/auth/test_joserfc_token_verifier.py`
  Purpose: focused verifier tests with monkeypatched `joserfc` decode behavior.
- Create: `tests/modules/auth/test_authenticate_request.py`
  Purpose: use-case tests for session hits, misses, expiry, and TTL capping.
- Create: `tests/modules/auth/test_auth_middleware.py`
  Purpose: middleware tests for whitelist behavior, header errors, auth success, and scope population.

### Task 1: Create The Auth Domain Core

**Files:**
- Create: `app/modules/auth/domain/exceptions.py`
- Create: `app/modules/auth/domain/value_objects.py`
- Create: `app/modules/auth/domain/session.py`
- Create: `app/modules/auth/domain/repositories.py`
- Create: `tests/modules/auth/test_session_domain.py`

- [ ] **Step 1: Write the failing domain tests**

Create `tests/modules/auth/test_session_domain.py` with a token fingerprint test and session expiry checks:

```python
from datetime import UTC, datetime, timedelta
import hashlib

from app.modules.auth.domain.session import Session
from app.modules.auth.domain.value_objects import TokenFingerprint


def test_token_fingerprint_uses_sha256_and_auth_namespace() -> None:
    fingerprint = TokenFingerprint.from_token("bearer-token")

    assert fingerprint.value == hashlib.sha256(b"bearer-token").hexdigest()
    assert fingerprint.as_redis_key() == f"auth:sessions:{fingerprint.value}"


def test_session_is_expired_for_past_timestamp() -> None:
    session = Session(
        subject="user-1",
        issuer="https://issuer.test",
        expires_at=datetime.now(UTC) - timedelta(seconds=5),
    )

    assert session.is_expired() is True


def test_session_is_not_expired_for_future_timestamp() -> None:
    session = Session(
        subject="user-1",
        issuer="https://issuer.test",
        expires_at=datetime.now(UTC) + timedelta(minutes=5),
    )

    assert session.is_expired() is False
```

- [ ] **Step 2: Run the domain tests to verify they fail**

Run: `uv run pytest tests/modules/auth/test_session_domain.py -q -n 0`
Expected: FAIL because the auth domain modules do not exist yet.

- [ ] **Step 3: Implement the domain files minimally**

Create `app/modules/auth/domain/exceptions.py`:

```python
class AuthDomainException(Exception):
    """Base exception for auth-domain failures."""

    def __init__(self, message: str, original_error: Exception | None = None) -> None:
        self.message = message
        self.original_error = original_error
        super().__init__(message)


class InvalidTokenException(AuthDomainException):
    """Raised when a bearer token is malformed, expired, or otherwise invalid."""


class AuthenticationServiceException(AuthDomainException):
    """Raised when discovery, JWKS, or Redis infrastructure prevents auth."""
```

Create `app/modules/auth/domain/value_objects.py`:

```python
from __future__ import annotations

import hashlib
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class TokenFingerprint:
    value: str

    @classmethod
    def from_token(cls, token: str) -> "TokenFingerprint":
        if not token:
            raise ValueError("Bearer token cannot be empty")

        digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
        return cls(digest)

    def as_redis_key(self) -> str:
        return f"auth:sessions:{self.value}"
```

Create `app/modules/auth/domain/session.py`:

```python
from __future__ import annotations

from datetime import UTC, datetime

from pydantic import BaseModel, Field, field_validator

JsonScalar = str | int | float | bool | None
JsonValue = JsonScalar | list[JsonScalar] | dict[str, JsonScalar]


class Session(BaseModel):
    subject: str
    issuer: str
    expires_at: datetime
    audience: str | list[str] | None = None
    claims: dict[str, JsonValue] = Field(default_factory=dict)

    @field_validator("subject", "issuer")
    @classmethod
    def _validate_non_empty(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Session fields must not be blank")
        return cleaned

    def is_expired(self, now: datetime | None = None) -> bool:
        current = now or datetime.now(UTC)
        expiration = self.expires_at

        if expiration.tzinfo is None:
            expiration = expiration.replace(tzinfo=UTC)

        return expiration <= current
```

Create `app/modules/auth/domain/repositories.py`:

```python
from __future__ import annotations

from typing import Protocol

from app.modules.auth.domain.session import Session
from app.modules.auth.domain.value_objects import TokenFingerprint


class SessionRepository(Protocol):
    async def get(self, fingerprint: TokenFingerprint) -> Session | None: ...

    async def save(
        self,
        fingerprint: TokenFingerprint,
        session: Session,
        ttl_seconds: int,
    ) -> Session: ...

    async def delete(self, fingerprint: TokenFingerprint) -> bool: ...
```

- [ ] **Step 4: Rerun the domain tests**

Run: `uv run pytest tests/modules/auth/test_session_domain.py -q -n 0`
Expected: PASS

- [ ] **Step 5: Commit the domain slice**

```bash
git add app/modules/auth/domain tests/modules/auth/test_session_domain.py
git commit -m "feat: add auth domain models"
```

### Task 2: Add TTL-Aware Redis Persistence And The Session Repository

**Files:**
- Modify: `app/services/redis_service.py`
- Modify: `tests/test_redis_service.py`
- Create: `app/modules/auth/infrastructure/redis_session_repository.py`
- Create: `tests/modules/auth/test_session_repository.py`

- [ ] **Step 1: Write the failing Redis and repository tests**

Add this test to `tests/test_redis_service.py`:

```python
@pytest.mark.asyncio
async def test_put_overwrites_value_and_applies_ttl(redis_service: RedisService) -> None:
    user = RedisUser(id="user-1", name="Alice", enabled=True)

    await redis_service.put("users:user-1", user, ttl_seconds=30)

    loaded = await redis_service.get("users:user-1", RedisUser)
    client = await redis_service._get_client()
    ttl = await client.ttl("users:user-1")

    assert loaded == user
    assert 0 < ttl <= 30
```

Create `tests/modules/auth/test_session_repository.py`:

```python
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from fakeredis.aioredis import FakeRedis

import app.services.redis_service as redis_service_module
from app.modules.auth.domain.session import Session
from app.modules.auth.domain.value_objects import TokenFingerprint
from app.modules.auth.infrastructure.redis_session_repository import RedisSessionRepository
from app.services.redis_service import RedisService


@pytest_asyncio.fixture
async def session_repository() -> AsyncIterator[RedisSessionRepository]:
    fake_client = FakeRedis(decode_responses=True)
    redis_service_module._redis_client = fake_client

    repository = RedisSessionRepository(RedisService())

    try:
        yield repository
    finally:
        await fake_client.flushall()
        await fake_client.aclose()
        redis_service_module._redis_client = None


@pytest.mark.asyncio
async def test_save_and_get_round_trip(session_repository: RedisSessionRepository) -> None:
    fingerprint = TokenFingerprint.from_token("token-1")
    session = Session(
        subject="user-1",
        issuer="https://issuer.test",
        expires_at=datetime.now(UTC) + timedelta(minutes=5),
    )

    await session_repository.save(fingerprint, session, ttl_seconds=60)

    loaded = await session_repository.get(fingerprint)

    assert loaded == session


@pytest.mark.asyncio
async def test_save_applies_ttl(session_repository: RedisSessionRepository) -> None:
    fingerprint = TokenFingerprint.from_token("token-2")
    session = Session(
        subject="user-2",
        issuer="https://issuer.test",
        expires_at=datetime.now(UTC) + timedelta(minutes=5),
    )

    await session_repository.save(fingerprint, session, ttl_seconds=15)

    client = await session_repository._redis_service._get_client()
    ttl = await client.ttl(fingerprint.as_redis_key())

    assert 0 < ttl <= 15


@pytest.mark.asyncio
async def test_get_returns_none_for_missing_session(
    session_repository: RedisSessionRepository,
) -> None:
    loaded = await session_repository.get(TokenFingerprint.from_token("missing-token"))

    assert loaded is None
```

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `uv run pytest tests/test_redis_service.py::test_put_overwrites_value_and_applies_ttl tests/modules/auth/test_session_repository.py -q -n 0`
Expected: FAIL because `RedisService.put` and `RedisSessionRepository` do not exist yet.

- [ ] **Step 3: Add the TTL-aware Redis helper and repository adapter**

Add this method to `app/services/redis_service.py` inside `class RedisService`:

```python
    async def put(
        self,
        key: str,
        value: ModelT,
        ttl_seconds: int | None = None,
    ) -> ModelT:
        """Store or overwrite a Redis document, optionally applying a TTL."""
        payload = self._model_to_json_object(value)
        model_type = value.__class__
        client = await self._get_client()

        try:
            await client.set(key, json.dumps(payload), ex=ttl_seconds)
        except RedisError as exc:
            message = f"Failed to store Redis data for key '{key}'"
            raise RedisConnectionException(message, exc) from exc

        return model_type.model_validate(payload)
```

Create `app/modules/auth/infrastructure/redis_session_repository.py`:

```python
from __future__ import annotations

from app.modules.auth.domain.repositories import SessionRepository
from app.modules.auth.domain.session import Session
from app.modules.auth.domain.value_objects import TokenFingerprint
from app.services.redis_service import RedisService


class RedisSessionRepository(SessionRepository):
    def __init__(self, redis_service: RedisService) -> None:
        self._redis_service = redis_service

    async def get(self, fingerprint: TokenFingerprint) -> Session | None:
        return await self._redis_service.get(fingerprint.as_redis_key(), Session)

    async def save(
        self,
        fingerprint: TokenFingerprint,
        session: Session,
        ttl_seconds: int,
    ) -> Session:
        return await self._redis_service.put(
            fingerprint.as_redis_key(),
            session,
            ttl_seconds=ttl_seconds,
        )

    async def delete(self, fingerprint: TokenFingerprint) -> bool:
        return await self._redis_service.delete(fingerprint.as_redis_key())
```

- [ ] **Step 4: Rerun the targeted Redis and repository tests**

Run: `uv run pytest tests/test_redis_service.py::test_put_overwrites_value_and_applies_ttl tests/modules/auth/test_session_repository.py -q -n 0`
Expected: PASS

- [ ] **Step 5: Commit the Redis-backed session slice**

```bash
git add app/services/redis_service.py tests/test_redis_service.py app/modules/auth/infrastructure/redis_session_repository.py tests/modules/auth/test_session_repository.py
git commit -m "feat: add redis-backed auth session repository"
```

### Task 3: Build The OIDC Metadata Provider With 1-Hour Caching

**Files:**
- Create: `app/modules/auth/infrastructure/oidc_metadata_provider.py`
- Create: `tests/modules/auth/test_oidc_metadata_provider.py`

- [ ] **Step 1: Write the failing metadata-provider tests**

Create `tests/modules/auth/test_oidc_metadata_provider.py`:

```python
import pytest

from app.modules.auth.domain.exceptions import AuthenticationServiceException
from app.modules.auth.infrastructure.oidc_metadata_provider import OidcMetadataProvider


DISCOVERY_URL = "https://issuer.test/.well-known/openid-configuration"
JWKS_URL = "https://issuer.test/keys"


@pytest.mark.asyncio
async def test_discovery_and_jwks_are_cached_for_one_hour(httpx_mock) -> None:
    httpx_mock.add_response(
        url=DISCOVERY_URL,
        json={"jwks_uri": JWKS_URL},
    )
    httpx_mock.add_response(
        url=JWKS_URL,
        json={"keys": [{"kty": "RSA", "kid": "kid-1", "n": "abc", "e": "AQAB"}]},
    )

    provider = OidcMetadataProvider(DISCOVERY_URL)

    first = await provider.get_jwks()
    second = await provider.get_jwks()

    assert first == second
    assert len(httpx_mock.get_requests()) == 2
    assert provider._discovery_cache.ttl == 3600
    assert provider._jwks_cache.ttl == 3600


@pytest.mark.asyncio
async def test_missing_jwks_uri_raises_auth_service_exception(httpx_mock) -> None:
    httpx_mock.add_response(url=DISCOVERY_URL, json={"issuer": "https://issuer.test"})

    provider = OidcMetadataProvider(DISCOVERY_URL)

    with pytest.raises(AuthenticationServiceException):
        await provider.get_jwks()


@pytest.mark.asyncio
async def test_malformed_jwks_payload_raises_auth_service_exception(httpx_mock) -> None:
    httpx_mock.add_response(url=DISCOVERY_URL, json={"jwks_uri": JWKS_URL})
    httpx_mock.add_response(url=JWKS_URL, json=["not-a-dict"])

    provider = OidcMetadataProvider(DISCOVERY_URL)

    with pytest.raises(AuthenticationServiceException):
        await provider.get_jwks()
```

- [ ] **Step 2: Run the metadata-provider tests to verify they fail**

Run: `uv run pytest tests/modules/auth/test_oidc_metadata_provider.py -q -n 0`
Expected: FAIL because `OidcMetadataProvider` does not exist yet.

- [ ] **Step 3: Implement the metadata provider with explicit TTLCache usage**

Create `app/modules/auth/infrastructure/oidc_metadata_provider.py`:

```python
from __future__ import annotations

from cachetools import TTLCache
import httpx

from app.modules.auth.domain.exceptions import AuthenticationServiceException


class OidcMetadataProvider:
    def __init__(self, discovery_endpoint: str) -> None:
        self._discovery_endpoint = discovery_endpoint
        self._discovery_cache: TTLCache[str, dict[str, object]] = TTLCache(
            maxsize=1024,
            ttl=3600,
        )
        self._jwks_cache: TTLCache[str, dict[str, object]] = TTLCache(
            maxsize=1024,
            ttl=3600,
        )

    async def get_discovery_document(self) -> dict[str, object]:
        cached = self._discovery_cache.get(self._discovery_endpoint)
        if cached is not None:
            return cached

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(self._discovery_endpoint)
                response.raise_for_status()
                payload = response.json()
        except httpx.HTTPError as exc:
            raise AuthenticationServiceException(
                "Failed to fetch OpenID discovery metadata",
                exc,
            ) from exc

        if not isinstance(payload, dict):
            raise AuthenticationServiceException("Discovery metadata must be a JSON object")

        self._discovery_cache[self._discovery_endpoint] = payload
        return payload

    async def get_jwks(self) -> dict[str, object]:
        discovery = await self.get_discovery_document()
        jwks_uri = discovery.get("jwks_uri")

        if not isinstance(jwks_uri, str) or not jwks_uri:
            raise AuthenticationServiceException("Discovery metadata does not contain a valid jwks_uri")

        cached = self._jwks_cache.get(jwks_uri)
        if cached is not None:
            return cached

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(jwks_uri)
                response.raise_for_status()
                payload = response.json()
        except httpx.HTTPError as exc:
            raise AuthenticationServiceException("Failed to fetch JWKS data", exc) from exc

        if not isinstance(payload, dict) or not isinstance(payload.get("keys"), list):
            raise AuthenticationServiceException("JWKS payload must be a JSON object with a keys list")

        self._jwks_cache[jwks_uri] = payload
        return payload
```

- [ ] **Step 4: Rerun the metadata-provider tests**

Run: `uv run pytest tests/modules/auth/test_oidc_metadata_provider.py -q -n 0`
Expected: PASS

- [ ] **Step 5: Commit the metadata slice**

```bash
git add app/modules/auth/infrastructure/oidc_metadata_provider.py tests/modules/auth/test_oidc_metadata_provider.py
git commit -m "feat: add cached oidc metadata provider"
```

### Task 4: Add The Token Verifier Adapter

**Files:**
- Create: `app/modules/auth/application/dto.py`
- Create: `app/modules/auth/application/ports.py`
- Create: `app/modules/auth/infrastructure/joserfc_token_verifier.py`
- Create: `tests/modules/auth/test_joserfc_token_verifier.py`

- [ ] **Step 1: Write the failing token-verifier tests**

Create `tests/modules/auth/test_joserfc_token_verifier.py`:

```python
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from joserfc.errors import JoseError

import app.modules.auth.infrastructure.joserfc_token_verifier as verifier_module
from app.modules.auth.domain.exceptions import InvalidTokenException
from app.modules.auth.infrastructure.joserfc_token_verifier import JoserfcTokenVerifier


class StubMetadataProvider:
    async def get_jwks(self) -> dict[str, object]:
        return {"keys": [{"kty": "oct", "k": "c2VjcmV0", "kid": "kid-1"}]}


@pytest.mark.asyncio
async def test_verify_returns_authenticated_context(monkeypatch) -> None:
    def fake_decode(_: str, __) -> SimpleNamespace:
        return SimpleNamespace(
            claims={
                "sub": "user-1",
                "iss": "https://issuer.test",
                "exp": int((datetime.now(UTC) + timedelta(minutes=5)).timestamp()),
                "role": "admin",
            }
        )

    monkeypatch.setattr(verifier_module.jwt, "decode", fake_decode)

    verifier = JoserfcTokenVerifier(StubMetadataProvider())
    context = await verifier.verify("token-value")

    assert context.subject == "user-1"
    assert context.issuer == "https://issuer.test"
    assert context.claims["role"] == "admin"


@pytest.mark.asyncio
async def test_verify_maps_joserfc_errors_to_invalid_token(monkeypatch) -> None:
    def fake_decode(_: str, __) -> SimpleNamespace:
        raise JoseError("bad signature")

    monkeypatch.setattr(verifier_module.jwt, "decode", fake_decode)

    verifier = JoserfcTokenVerifier(StubMetadataProvider())

    with pytest.raises(InvalidTokenException):
        await verifier.verify("token-value")
```

- [ ] **Step 2: Run the token-verifier tests to verify they fail**

Run: `uv run pytest tests/modules/auth/test_joserfc_token_verifier.py -q -n 0`
Expected: FAIL because the DTO, port, and verifier adapter do not exist yet.

- [ ] **Step 3: Implement the DTO, port, and verifier adapter**

Create `app/modules/auth/application/dto.py`:

```python
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.modules.auth.domain.session import JsonValue, Session


class AuthenticatedContext(BaseModel):
    subject: str
    issuer: str
    expires_at: datetime
    audience: str | list[str] | None = None
    claims: dict[str, JsonValue] = Field(default_factory=dict)

    @classmethod
    def from_session(cls, session: Session) -> "AuthenticatedContext":
        return cls.model_validate(session.model_dump())
```

Create `app/modules/auth/application/ports.py`:

```python
from __future__ import annotations

from typing import Protocol

from app.modules.auth.application.dto import AuthenticatedContext


class TokenVerifier(Protocol):
    async def verify(self, bearer_token: str) -> AuthenticatedContext: ...
```

Create `app/modules/auth/infrastructure/joserfc_token_verifier.py`:

```python
from __future__ import annotations

from datetime import UTC, datetime

from joserfc import jwt
from joserfc.errors import ExpiredTokenError, InvalidClaimError, JoseError
from joserfc.jwk import KeySet

from app.modules.auth.application.dto import AuthenticatedContext
from app.modules.auth.application.ports import TokenVerifier
from app.modules.auth.domain.exceptions import InvalidTokenException
from app.modules.auth.infrastructure.oidc_metadata_provider import OidcMetadataProvider


class JoserfcTokenVerifier(TokenVerifier):
    def __init__(self, metadata_provider: OidcMetadataProvider) -> None:
        self._metadata_provider = metadata_provider

    async def verify(self, bearer_token: str) -> AuthenticatedContext:
        try:
            jwks = await self._metadata_provider.get_jwks()
            key_set = KeySet.import_key_set(jwks)
            token = jwt.decode(bearer_token, key_set)
            claims_registry = jwt.JWTClaimsRegistry(
                exp={"essential": True},
                iss={"essential": True},
                sub={"essential": True},
            )
            claims_registry.validate(token.claims)
        except ExpiredTokenError as exc:
            raise InvalidTokenException("Bearer token has expired", exc) from exc
        except (InvalidClaimError, JoseError, ValueError) as exc:
            raise InvalidTokenException("Bearer token is invalid", exc) from exc

        claims = dict(token.claims)
        expires_at = datetime.fromtimestamp(int(claims["exp"]), tz=UTC)

        return AuthenticatedContext(
            subject=str(claims["sub"]),
            issuer=str(claims["iss"]),
            expires_at=expires_at,
            audience=claims.get("aud"),
            claims=claims,
        )
```

- [ ] **Step 4: Rerun the token-verifier tests**

Run: `uv run pytest tests/modules/auth/test_joserfc_token_verifier.py -q -n 0`
Expected: PASS

- [ ] **Step 5: Commit the verifier slice**

```bash
git add app/modules/auth/application/dto.py app/modules/auth/application/ports.py app/modules/auth/infrastructure/joserfc_token_verifier.py tests/modules/auth/test_joserfc_token_verifier.py
git commit -m "feat: add joserfc auth token verifier"
```

### Task 5: Build The AuthenticateRequest Use Case

**Files:**
- Create: `app/modules/auth/application/authenticate_request.py`
- Create: `tests/modules/auth/test_authenticate_request.py`

- [ ] **Step 1: Write the failing use-case tests**

Create `tests/modules/auth/test_authenticate_request.py`:

```python
from datetime import UTC, datetime, timedelta

import pytest

from app.modules.auth.application.authenticate_request import AuthenticateRequest
from app.modules.auth.application.dto import AuthenticatedContext
from app.modules.auth.domain.repositories import SessionRepository
from app.modules.auth.domain.session import Session
from app.modules.auth.domain.value_objects import TokenFingerprint


class InMemorySessionRepository(SessionRepository):
    def __init__(self) -> None:
        self.saved_ttls: list[int] = []
        self.storage: dict[str, Session] = {}

    async def get(self, fingerprint: TokenFingerprint) -> Session | None:
        return self.storage.get(fingerprint.value)

    async def save(
        self,
        fingerprint: TokenFingerprint,
        session: Session,
        ttl_seconds: int,
    ) -> Session:
        self.saved_ttls.append(ttl_seconds)
        self.storage[fingerprint.value] = session
        return session

    async def delete(self, fingerprint: TokenFingerprint) -> bool:
        return self.storage.pop(fingerprint.value, None) is not None


class StubTokenVerifier:
    def __init__(self) -> None:
        self.calls = 0

    async def verify(self, bearer_token: str) -> AuthenticatedContext:
        self.calls += 1
        return AuthenticatedContext(
            subject="user-1",
            issuer="https://issuer.test",
            expires_at=datetime.now(UTC) + timedelta(seconds=90),
            claims={"raw": bearer_token},
        )


@pytest.mark.asyncio
async def test_existing_valid_session_skips_token_verification() -> None:
    repository = InMemorySessionRepository()
    verifier = StubTokenVerifier()
    fingerprint = TokenFingerprint.from_token("token-1")
    repository.storage[fingerprint.value] = Session(
        subject="user-1",
        issuer="https://issuer.test",
        expires_at=datetime.now(UTC) + timedelta(minutes=5),
        claims={"source": "session"},
    )

    use_case = AuthenticateRequest(repository, verifier)

    context = await use_case.execute("token-1")

    assert verifier.calls == 0
    assert context.claims["source"] == "session"


@pytest.mark.asyncio
async def test_missing_session_verifies_token_and_saves_session() -> None:
    repository = InMemorySessionRepository()
    verifier = StubTokenVerifier()
    use_case = AuthenticateRequest(repository, verifier)

    context = await use_case.execute("token-2")

    assert verifier.calls == 1
    assert context.subject == "user-1"
    assert len(repository.saved_ttls) == 1
    assert repository.saved_ttls[0] > 0


@pytest.mark.asyncio
async def test_expired_session_is_deleted_before_revalidation() -> None:
    repository = InMemorySessionRepository()
    verifier = StubTokenVerifier()
    fingerprint = TokenFingerprint.from_token("token-3")
    repository.storage[fingerprint.value] = Session(
        subject="user-1",
        issuer="https://issuer.test",
        expires_at=datetime.now(UTC) - timedelta(seconds=5),
    )

    use_case = AuthenticateRequest(repository, verifier)

    await use_case.execute("token-3")

    assert verifier.calls == 1
    assert len(repository.saved_ttls) == 1
```

- [ ] **Step 2: Run the use-case tests to verify they fail**

Run: `uv run pytest tests/modules/auth/test_authenticate_request.py -q -n 0`
Expected: FAIL because `AuthenticateRequest` does not exist yet.

- [ ] **Step 3: Implement the auth use case**

Create `app/modules/auth/application/authenticate_request.py`:

```python
from __future__ import annotations

from datetime import UTC, datetime

from app.modules.auth.application.dto import AuthenticatedContext
from app.modules.auth.application.ports import TokenVerifier
from app.modules.auth.domain.exceptions import InvalidTokenException
from app.modules.auth.domain.repositories import SessionRepository
from app.modules.auth.domain.session import Session
from app.modules.auth.domain.value_objects import TokenFingerprint


class AuthenticateRequest:
    def __init__(
        self,
        session_repository: SessionRepository,
        token_verifier: TokenVerifier,
    ) -> None:
        self._session_repository = session_repository
        self._token_verifier = token_verifier

    async def execute(self, bearer_token: str) -> AuthenticatedContext:
        fingerprint = TokenFingerprint.from_token(bearer_token)
        existing_session = await self._session_repository.get(fingerprint)

        if existing_session is not None and not existing_session.is_expired():
            return AuthenticatedContext.from_session(existing_session)

        if existing_session is not None and existing_session.is_expired():
            await self._session_repository.delete(fingerprint)

        context = await self._token_verifier.verify(bearer_token)

        ttl_seconds = max(
            0,
            int((context.expires_at - datetime.now(UTC)).total_seconds()),
        )
        if ttl_seconds <= 0:
            raise InvalidTokenException("Bearer token has expired")

        session = Session(
            subject=context.subject,
            issuer=context.issuer,
            expires_at=context.expires_at,
            audience=context.audience,
            claims=context.claims,
        )
        await self._session_repository.save(fingerprint, session, ttl_seconds)

        return context
```

- [ ] **Step 4: Rerun the use-case tests**

Run: `uv run pytest tests/modules/auth/test_authenticate_request.py -q -n 0`
Expected: PASS

- [ ] **Step 5: Commit the use-case slice**

```bash
git add app/modules/auth/application/authenticate_request.py tests/modules/auth/test_authenticate_request.py
git commit -m "feat: add auth request orchestration use case"
```

### Task 6: Add The Pure ASGI Middleware And Wire The App

**Files:**
- Create: `app/modules/auth/interface/http_exceptions.py`
- Create: `app/modules/auth/interface/auth_middleware.py`
- Modify: `main.py`
- Create: `tests/modules/auth/test_auth_middleware.py`

- [ ] **Step 1: Write the failing middleware tests**

Create `tests/modules/auth/test_auth_middleware.py`:

```python
from datetime import UTC, datetime, timedelta

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.modules.auth.application.dto import AuthenticatedContext
from app.modules.auth.interface.auth_middleware import AuthMiddleware


class StubAuthenticateRequest:
    def __init__(self) -> None:
        self.calls = 0

    async def execute(self, bearer_token: str) -> AuthenticatedContext:
        self.calls += 1
        return AuthenticatedContext(
            subject="user-1",
            issuer="https://issuer.test",
            expires_at=datetime.now(UTC) + timedelta(minutes=5),
            claims={"token": bearer_token},
        )


def build_app(use_case: StubAuthenticateRequest) -> FastAPI:
    app = FastAPI()
    app.add_middleware(
        AuthMiddleware,
        authenticate_request=use_case,
        whitelist_paths=["/health"],
    )

    @app.get("/health")
    async def health() -> dict[str, bool]:
        return {"ok": True}

    @app.get("/protected")
    async def protected(request: Request) -> dict[str, object]:
        return request.scope["auth"].model_dump(mode="json")

    return app


def test_whitelisted_path_bypasses_auth() -> None:
    use_case = StubAuthenticateRequest()
    client = TestClient(build_app(use_case))

    response = client.get("/health")

    assert response.status_code == 200
    assert use_case.calls == 0


def test_missing_authorization_header_returns_401() -> None:
    client = TestClient(build_app(StubAuthenticateRequest()))

    response = client.get("/protected")

    assert response.status_code == 401
    assert response.json()["detail"] == "Missing Authorization header"


def test_invalid_authorization_scheme_returns_401() -> None:
    client = TestClient(build_app(StubAuthenticateRequest()))

    response = client.get("/protected", headers={"Authorization": "Basic abc"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid bearer token header"


def test_successful_authentication_populates_scope() -> None:
    client = TestClient(build_app(StubAuthenticateRequest()))

    response = client.get(
        "/protected",
        headers={"Authorization": "Bearer token-123"},
    )

    assert response.status_code == 200
    assert response.json()["subject"] == "user-1"
    assert response.json()["claims"]["token"] == "token-123"
```

- [ ] **Step 2: Run the middleware tests to verify they fail**

Run: `uv run pytest tests/modules/auth/test_auth_middleware.py -q -n 0`
Expected: FAIL because the interface-layer middleware and HTTP exceptions do not exist yet.

- [ ] **Step 3: Implement HTTP exceptions, middleware, and app wiring**

Create `app/modules/auth/interface/http_exceptions.py`:

```python
from fastapi import HTTPException, status


class AuthenticationHTTPException(HTTPException):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(status_code=status_code, detail=detail)


class MissingAuthorizationHeaderHTTPException(AuthenticationHTTPException):
    def __init__(self) -> None:
        super().__init__(status.HTTP_401_UNAUTHORIZED, "Missing Authorization header")


class InvalidAuthorizationHeaderHTTPException(AuthenticationHTTPException):
    def __init__(self) -> None:
        super().__init__(status.HTTP_401_UNAUTHORIZED, "Invalid bearer token header")


class InvalidBearerTokenHTTPException(AuthenticationHTTPException):
    def __init__(self) -> None:
        super().__init__(status.HTTP_401_UNAUTHORIZED, "Bearer token is invalid")


class AuthenticationServiceUnavailableHTTPException(AuthenticationHTTPException):
    def __init__(self) -> None:
        super().__init__(status.HTTP_503_SERVICE_UNAVAILABLE, "Authentication service unavailable")
```

Create `app/modules/auth/interface/auth_middleware.py`:

```python
from __future__ import annotations

from collections.abc import Sequence

from fastapi import Request
from starlette.types import ASGIApp, Receive, Scope, Send

from app.modules.auth.application.authenticate_request import AuthenticateRequest
from app.modules.auth.domain.exceptions import (
    AuthenticationServiceException,
    InvalidTokenException,
)
from app.modules.auth.interface.http_exceptions import (
    AuthenticationServiceUnavailableHTTPException,
    InvalidAuthorizationHeaderHTTPException,
    InvalidBearerTokenHTTPException,
    MissingAuthorizationHeaderHTTPException,
)


class AuthMiddleware:
    def __init__(
        self,
        app: ASGIApp,
        authenticate_request: AuthenticateRequest,
        whitelist_paths: Sequence[str] | None = None,
    ) -> None:
        self.app = app
        self._authenticate_request = authenticate_request
        self._whitelist_paths = set(whitelist_paths or [])

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        if scope.get("path") in self._whitelist_paths:
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)
        authorization = request.headers.get("authorization")
        if authorization is None:
            raise MissingAuthorizationHeaderHTTPException()

        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise InvalidAuthorizationHeaderHTTPException()

        try:
            scope["auth"] = await self._authenticate_request.execute(token)
        except InvalidTokenException as exc:
            raise InvalidBearerTokenHTTPException() from exc
        except AuthenticationServiceException as exc:
            raise AuthenticationServiceUnavailableHTTPException() from exc

        await self.app(scope, receive, send)
```

Modify `main.py` to wire the bounded context before including routers:

```python
from app.config import settings
from app.modules.auth.application.authenticate_request import AuthenticateRequest
from app.modules.auth.infrastructure.joserfc_token_verifier import JoserfcTokenVerifier
from app.modules.auth.infrastructure.oidc_metadata_provider import OidcMetadataProvider
from app.modules.auth.infrastructure.redis_session_repository import RedisSessionRepository
from app.modules.auth.interface.auth_middleware import AuthMiddleware
from app.services.redis_service import redis_service


auth_metadata_provider = OidcMetadataProvider(settings.auth.discovery_endpoint)
auth_token_verifier = JoserfcTokenVerifier(auth_metadata_provider)
auth_session_repository = RedisSessionRepository(redis_service)
authenticate_request = AuthenticateRequest(auth_session_repository, auth_token_verifier)

app = FastAPI(lifespan=lifespan)
app.add_middleware(
    AuthMiddleware,
    authenticate_request=authenticate_request,
    whitelist_paths=["/docs", "/openapi.json", "/redoc"],
)
app.include_router(user_router)
```

- [ ] **Step 4: Run the middleware tests and the full auth suite**

Run: `uv run pytest tests/modules/auth/test_auth_middleware.py tests/modules/auth -q -n 0`
Expected: PASS

Run: `just typecheck`
Expected: PASS

Run: `uv run ruff check .`
Expected: PASS

- [ ] **Step 5: Commit the interface and wiring slice**

```bash
git add main.py app/modules/auth tests/modules/auth app/services/redis_service.py tests/test_redis_service.py
git commit -m "feat: add ddd auth middleware flow"
```

## Self-Review Notes

- Spec coverage: this plan covers DDD layering, pure ASGI middleware, bearer-token-only session lookup, SHA-256 token fingerprint keys, 1-hour discovery/JWKS caching, `joserfc` validation, custom auth HTTP exceptions, Redis-backed sessions, and unit tests for each layer.
- Placeholder scan: no `TODO`, `TBD`, or implied "handle this later" steps remain; every task lists exact files, commands, and code.
- Type consistency: the plan uses `Session`, `TokenFingerprint`, `SessionRepository`, `AuthenticatedContext`, and `AuthenticateRequest` consistently across all tasks.
