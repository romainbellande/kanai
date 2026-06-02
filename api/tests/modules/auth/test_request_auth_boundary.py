from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, cast

import pytest
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import InvalidTokenException
from app.core.security import AuthUnauthorizedHTTPException, TokenFingerprint
from app.models.user import User
from app.schemas.auth import AuthenticatedContext, Session
from app.services.auth_service import AuthenticateRequest, RequestAuthBoundary


class StubSessionRepository:
    def __init__(self, session: Session | None = None) -> None:
        self.session = session
        self.saved_calls: list[tuple[TokenFingerprint, Session, int]] = []

    async def get(self, fingerprint: TokenFingerprint) -> Session | None:
        del fingerprint
        return self.session

    async def save(
        self,
        fingerprint: TokenFingerprint,
        session: Session,
        ttl_seconds: int,
    ) -> Session:
        self.saved_calls.append((fingerprint, session, ttl_seconds))
        self.session = session
        return session

    async def delete(self, fingerprint: TokenFingerprint) -> bool:
        del fingerprint
        self.session = None
        return True


class StubTokenVerifier:
    def __init__(self, context: AuthenticatedContext | Exception) -> None:
        self.context = context
        self.calls: list[str] = []

    async def verify(self, bearer_token: str) -> AuthenticatedContext:
        self.calls.append(bearer_token)
        if isinstance(self.context, Exception):
            raise self.context
        return self.context


class StubUserProvisioner:
    def __init__(self) -> None:
        self.contexts: list[AuthenticatedContext] = []

    async def provision(self, context: AuthenticatedContext) -> None:
        self.contexts.append(context)


class StubUserRepository:
    def __init__(self, user: User | None = None) -> None:
        self.user = user
        self.external_ids: list[str] = []

    async def get_by_external_id(self, external_id: str) -> User | None:
        self.external_ids.append(external_id)
        return self.user


def build_session(
    *,
    subject: str = "user-1",
    expires_at: datetime | None = None,
) -> Session:
    return Session(
        subject=subject,
        issuer="https://issuer.test",
        expires_at=expires_at or datetime.now(UTC) + timedelta(minutes=5),
        audience="kanai-api",
        claims={"scope": "openid"},
    )


def build_boundary(
    *,
    repository: StubSessionRepository,
    verifier: StubTokenVerifier,
    user_provisioner: StubUserProvisioner,
    user_repository: StubUserRepository | None = None,
    whitelist_paths: set[str] | None = None,
) -> RequestAuthBoundary:
    return RequestAuthBoundary(
        AuthenticateRequest(
            repository=repository,
            token_verifier=verifier,
            user_provisioner=user_provisioner,
        ),
        whitelist_paths=whitelist_paths,
        user_repository_factory=lambda session: user_repository
        or StubUserRepository(),
    )


def build_scope(
    *,
    path: str = "/protected",
    authorization: str | None = "Bearer bearer-token",
) -> dict[str, Any]:
    headers: list[tuple[bytes, bytes]] = []
    if authorization is not None:
        headers.append((b"authorization", authorization.encode()))

    return {
        "type": "http",
        "method": "GET",
        "path": path,
        "headers": headers,
        "query_string": b"",
        "server": ("testserver", 80),
        "scheme": "http",
        "client": ("testclient", 50000),
    }


@pytest.mark.asyncio
async def test_cached_session_authenticates_scope_without_token_verification() -> None:
    session = build_session()
    repository = StubSessionRepository(session=session)
    verifier = StubTokenVerifier(AuthenticatedContext.from_session(build_session()))
    user_provisioner = StubUserProvisioner()
    boundary = build_boundary(
        repository=repository,
        verifier=verifier,
        user_provisioner=user_provisioner,
    )
    scope = build_scope()

    context = await boundary.authenticate_scope(scope)

    assert context == AuthenticatedContext.from_session(session)
    assert scope["auth"] == context
    assert verifier.calls == []
    assert repository.saved_calls == []
    assert user_provisioner.contexts == [context]


@pytest.mark.asyncio
async def test_missing_session_verifies_token_saves_session_and_provisions_user() -> None:
    repository = StubSessionRepository()
    verified_context = AuthenticatedContext.from_session(build_session())
    verifier = StubTokenVerifier(verified_context)
    user_provisioner = StubUserProvisioner()
    boundary = build_boundary(
        repository=repository,
        verifier=verifier,
        user_provisioner=user_provisioner,
    )
    scope = build_scope()

    context = await boundary.authenticate_scope(scope)

    assert context == verified_context
    assert scope["auth"] == context
    assert verifier.calls == ["bearer-token"]
    assert len(repository.saved_calls) == 1
    assert user_provisioner.contexts == [context]


@pytest.mark.asyncio
async def test_invalid_token_rejects_scope_authentication() -> None:
    repository = StubSessionRepository()
    verifier = StubTokenVerifier(InvalidTokenException("Token is invalid"))
    boundary = build_boundary(
        repository=repository,
        verifier=verifier,
        user_provisioner=StubUserProvisioner(),
    )

    with pytest.raises(InvalidTokenException, match="Token is invalid"):
        await boundary.authenticate_scope(build_scope())

    assert verifier.calls == ["bearer-token"]
    assert repository.saved_calls == []


@pytest.mark.asyncio
async def test_bypass_path_returns_none_without_authentication() -> None:
    repository = StubSessionRepository()
    verifier = StubTokenVerifier(AuthenticatedContext.from_session(build_session()))
    boundary = build_boundary(
        repository=repository,
        verifier=verifier,
        user_provisioner=StubUserProvisioner(),
        whitelist_paths={"/health"},
    )

    context = await boundary.authenticate_scope(build_scope(path="/health/"))

    assert context is None
    assert verifier.calls == []


@pytest.mark.asyncio
async def test_missing_authorization_header_is_rejected_before_adapter_calls() -> None:
    repository = StubSessionRepository()
    verifier = StubTokenVerifier(AuthenticatedContext.from_session(build_session()))
    boundary = build_boundary(
        repository=repository,
        verifier=verifier,
        user_provisioner=StubUserProvisioner(),
    )

    with pytest.raises(AuthUnauthorizedHTTPException) as exc_info:
        await boundary.authenticate_scope(build_scope(authorization=None))

    assert exc_info.value.detail == "Missing Authorization header"
    assert verifier.calls == []
    assert repository.saved_calls == []


@pytest.mark.asyncio
async def test_current_user_resolves_authenticated_scope_subject() -> None:
    user = User(externalId="user-1")
    user_repository = StubUserRepository(user=user)
    boundary = build_boundary(
        repository=StubSessionRepository(),
        verifier=StubTokenVerifier(AuthenticatedContext.from_session(build_session())),
        user_provisioner=StubUserProvisioner(),
        user_repository=user_repository,
    )
    scope = build_scope()
    scope["auth"] = AuthenticatedContext.from_session(build_session(subject="user-1"))
    request = Request(scope)

    current_user = await boundary.current_user(request, session=cast(AsyncSession, object()))

    assert current_user is user
    assert user_repository.external_ids == ["user-1"]
