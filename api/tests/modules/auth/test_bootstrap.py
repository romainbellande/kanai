from app.core.config import settings
from app.core.security import JoserfcTokenVerifier
from app.repositories.session_repository import RedisSessionRepository
from app.repositories.user_repository import DatabaseUserProvisioner
from app.services.auth_service import (
    AuthenticateRequest,
    RequestAuthBoundary,
    build_authenticate_request,
    build_request_auth_boundary,
    get_auth_whitelist_paths,
)
from app.services.redis_service import RedisService


def test_build_authenticate_request_wires_configured_audience_and_redis_repository() -> (
    None
):
    redis_service = RedisService()

    authenticate_request = build_authenticate_request(
        settings=settings,
        redis_service=redis_service,
    )

    assert isinstance(authenticate_request, AuthenticateRequest)
    assert isinstance(authenticate_request._repository, RedisSessionRepository)
    assert authenticate_request._repository._redis_service is redis_service
    assert isinstance(authenticate_request._token_verifier, JoserfcTokenVerifier)
    assert isinstance(
        authenticate_request._user_provisioner,
        DatabaseUserProvisioner,
    )
    assert (
        authenticate_request._token_verifier.expected_audience == settings.auth.audience
    )


def test_get_auth_whitelist_paths_matches_public_docs_routes() -> None:
    assert get_auth_whitelist_paths() == {
        "/docs",
        "/docs/oauth2-redirect",
        "/a2a/acceptance-criteria/.well-known/agent-card.json",
        "/openapi.json",
        "/redoc",
    }


def test_build_request_auth_boundary_wires_authenticator_and_whitelist_paths() -> None:
    redis_service = RedisService()

    boundary = build_request_auth_boundary(
        settings=settings, redis_service=redis_service
    )

    assert isinstance(boundary, RequestAuthBoundary)
    assert isinstance(boundary._authenticate_request, AuthenticateRequest)
    assert boundary._whitelist_paths == get_auth_whitelist_paths()
