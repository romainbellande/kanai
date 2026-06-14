import importlib
import sys
from typing import cast

import pytest
from fastapi.testclient import TestClient

from app.core.security import AuthMiddleware, JoserfcTokenVerifier
from app.schemas.auth import AuthenticatedContext
from app.services.auth_service import AuthenticateRequest, RequestAuthBoundary


class SentinelAuthenticateRequest:
    async def execute(self, bearer_token: str) -> AuthenticatedContext:
        del bearer_token
        raise AssertionError("sentinel should not authenticate requests")


def test_authenticate_request_wires_configured_audience_into_verifier() -> None:
    sys.modules.pop("app.main", None)
    main = importlib.import_module("app.main")

    authenticate_request = cast(
        AuthenticateRequest,
        main.request_auth_boundary._authenticate_request,
    )
    verifier = authenticate_request._token_verifier

    assert isinstance(verifier, JoserfcTokenVerifier)
    assert verifier.expected_audience == main.settings.auth.audience


def test_main_serves_a2a_agent_card_without_bearer_auth() -> None:
    sys.modules.pop("app.main", None)
    main = importlib.import_module("app.main")
    client = TestClient(main.app)

    response = client.get("/a2a/acceptance-criteria/.well-known/agent-card.json")

    assert response.status_code == 200
    assert response.json()["url"] == "/a2a/acceptance-criteria"


def test_main_protects_a2a_invocation_route_convention() -> None:
    sys.modules.pop("app.main", None)
    main = importlib.import_module("app.main")
    client = TestClient(main.app)

    response = client.post("/a2a/acceptance-criteria")

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing Authorization header"}


def test_main_builds_auth_middleware_from_bootstrap_helpers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.services.auth_service as auth_service

    sentinel_auth_boundary = RequestAuthBoundary(
        authenticate_request=SentinelAuthenticateRequest(),
        whitelist_paths={"/healthz"},
    )

    monkeypatch.setattr(
        auth_service,
        "build_request_auth_boundary",
        lambda *, settings, redis_service: sentinel_auth_boundary,
    )

    sys.modules.pop("app.main", None)
    main = importlib.import_module("app.main")

    middleware = next(
        item for item in main.app.user_middleware if item.cls is AuthMiddleware
    )

    assert main.request_auth_boundary is sentinel_auth_boundary
    assert middleware.kwargs["auth_boundary"] is sentinel_auth_boundary
