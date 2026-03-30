from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import cast

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.modules.auth.application.authenticate_request import AuthenticateRequest
from app.modules.auth.application.dto import AuthenticatedContext
from app.modules.auth.domain.session import Session
from app.modules.auth.domain.exceptions import (
    AuthenticationServiceException,
    InvalidTokenException,
)
from app.modules.auth.domain.value_objects import TokenFingerprint
from app.modules.auth.interface.auth_middleware import (
    AuthMiddleware,
    AuthenticateRequestHandler,
)


class StubAuthenticateRequest:
    def __init__(self, result: AuthenticatedContext | Exception) -> None:
        self._result = result
        self.calls: list[str] = []

    async def execute(self, bearer_token: str) -> AuthenticatedContext:
        self.calls.append(bearer_token)
        if isinstance(self._result, Exception):
            raise self._result
        return self._result


class FailingSessionRepository:
    async def get(self, fingerprint: TokenFingerprint) -> None:
        del fingerprint
        raise AuthenticationServiceException("Authentication service unavailable")

    async def save(
        self,
        fingerprint: TokenFingerprint,
        session: Session,
        ttl_seconds: int,
    ) -> Session:
        del fingerprint, session, ttl_seconds
        raise AssertionError("save should not be called")

    async def delete(self, fingerprint: TokenFingerprint) -> bool:
        del fingerprint
        raise AssertionError("delete should not be called")


class StubTokenVerifier:
    async def verify(self, bearer_token: str) -> AuthenticatedContext:
        del bearer_token
        raise AssertionError("verify should not be called")


def build_context() -> AuthenticatedContext:
    return AuthenticatedContext(
        subject="user-1",
        issuer="https://issuer.test",
        expires_at=datetime.now(UTC) + timedelta(minutes=5),
        audience=None,
        claims={"scope": "openid"},
    )


def build_app(authenticate_request: AuthenticateRequestHandler) -> FastAPI:
    app = FastAPI()
    app.add_middleware(
        AuthMiddleware,
        authenticate_request=authenticate_request,
        whitelist_paths={"/health"},
    )

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/protected")
    async def protected(request: Request) -> dict[str, object]:
        return {"auth": cast(AuthenticatedContext, request.scope["auth"]).claims}

    return app


def test_whitelisted_path_bypasses_auth() -> None:
    authenticate_request = StubAuthenticateRequest(result=build_context())
    client = TestClient(build_app(authenticate_request))

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert authenticate_request.calls == []


def test_whitelisted_path_with_trailing_slash_bypasses_auth() -> None:
    authenticate_request = StubAuthenticateRequest(result=build_context())
    client = TestClient(build_app(authenticate_request))

    response = client.get("/health/", follow_redirects=False)

    assert response.status_code == 307
    assert authenticate_request.calls == []


def test_missing_authorization_header_returns_401() -> None:
    authenticate_request = StubAuthenticateRequest(result=build_context())
    client = TestClient(build_app(authenticate_request))

    response = client.get("/protected")

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing Authorization header"}
    assert response.headers["www-authenticate"] == "Bearer"
    assert authenticate_request.calls == []


def test_invalid_authorization_scheme_returns_401() -> None:
    authenticate_request = StubAuthenticateRequest(result=build_context())
    client = TestClient(build_app(authenticate_request))

    response = client.get("/protected", headers={"Authorization": "Basic token"})

    assert response.status_code == 401
    assert response.json() == {"detail": "Authorization header must use Bearer scheme"}
    assert response.headers["www-authenticate"] == "Bearer"
    assert authenticate_request.calls == []


def test_successful_authentication_populates_scope_auth() -> None:
    context = build_context()
    authenticate_request = StubAuthenticateRequest(result=context)
    client = TestClient(build_app(authenticate_request))

    response = client.get(
        "/protected",
        headers={"Authorization": "Bearer valid-token"},
    )

    assert response.status_code == 200
    assert response.json() == {"auth": context.claims}
    assert authenticate_request.calls == ["valid-token"]


def test_invalid_token_exception_returns_401() -> None:
    authenticate_request = StubAuthenticateRequest(
        result=InvalidTokenException("Token is invalid")
    )
    client = TestClient(build_app(authenticate_request))

    response = client.get(
        "/protected",
        headers={"Authorization": "Bearer invalid-token"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Token is invalid"}
    assert response.headers["www-authenticate"] == "Bearer"


def test_authentication_service_exception_returns_503() -> None:
    authenticate_request = StubAuthenticateRequest(
        result=AuthenticationServiceException("Authentication service unavailable")
    )
    client = TestClient(build_app(authenticate_request))

    response = client.get(
        "/protected",
        headers={"Authorization": "Bearer valid-token"},
    )

    assert response.status_code == 503
    assert response.json() == {"detail": "Authentication service unavailable"}


def test_repository_failure_returns_503() -> None:
    client = TestClient(
        build_app(
            AuthenticateRequest(
                repository=FailingSessionRepository(),
                token_verifier=StubTokenVerifier(),
            )
        )
    )

    response = client.get(
        "/protected",
        headers={"Authorization": "Bearer valid-token"},
    )

    assert response.status_code == 503
    assert response.json() == {"detail": "Authentication service unavailable"}
