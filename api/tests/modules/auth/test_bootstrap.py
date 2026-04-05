from app.config import settings
from app.modules.auth.application.authenticate_request import AuthenticateRequest
from app.modules.auth.bootstrap import (
    build_authenticate_request,
    get_auth_whitelist_paths,
)
from app.modules.auth.infrastructure.joserfc_token_verifier import (
    JoserfcTokenVerifier,
)
from app.modules.auth.infrastructure.redis_session_repository import (
    RedisSessionRepository,
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
    assert (
        authenticate_request._token_verifier.expected_audience == settings.auth.audience
    )


def test_get_auth_whitelist_paths_matches_public_docs_routes() -> None:
    assert get_auth_whitelist_paths() == {
        "/docs",
        "/docs/oauth2-redirect",
        "/openapi.json",
        "/redoc",
    }
