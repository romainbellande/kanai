import importlib
import sys

import pytest

from app.core.security import AuthMiddleware, JoserfcTokenVerifier


def test_authenticate_request_wires_configured_audience_into_verifier() -> None:
    sys.modules.pop("app.main", None)
    main = importlib.import_module("app.main")

    verifier = main.authenticate_request._token_verifier

    assert isinstance(verifier, JoserfcTokenVerifier)
    assert verifier.expected_audience == main.settings.auth.audience


def test_main_builds_auth_middleware_from_bootstrap_helpers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.services.auth_service as auth_service

    sentinel_authenticate_request = object()
    sentinel_whitelist_paths = {"/healthz"}

    monkeypatch.setattr(
        auth_service,
        "build_authenticate_request",
        lambda *, settings, redis_service: sentinel_authenticate_request,
    )
    monkeypatch.setattr(
        auth_service,
        "get_auth_whitelist_paths",
        lambda: sentinel_whitelist_paths,
    )

    sys.modules.pop("app.main", None)
    main = importlib.import_module("app.main")

    middleware = next(
        item for item in main.app.user_middleware if item.cls is AuthMiddleware
    )

    assert main.authenticate_request is sentinel_authenticate_request
    assert main.auth_whitelist_paths == sentinel_whitelist_paths
    assert middleware.kwargs["authenticate_request"] is sentinel_authenticate_request
    assert middleware.kwargs["whitelist_paths"] == sentinel_whitelist_paths
