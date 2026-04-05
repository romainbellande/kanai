from app.config import Settings
from app.modules.auth.application.authenticate_request import AuthenticateRequest
from app.modules.auth.infrastructure.joserfc_token_verifier import (
    JoserfcTokenVerifier,
)
from app.modules.auth.infrastructure.oidc_metadata_provider import OidcMetadataProvider
from app.modules.auth.infrastructure.redis_session_repository import (
    RedisSessionRepository,
)
from app.services.redis_service import RedisService


def build_authenticate_request(
    settings: Settings,
    redis_service: RedisService,
) -> AuthenticateRequest:
    return AuthenticateRequest(
        repository=RedisSessionRepository(redis_service),
        token_verifier=JoserfcTokenVerifier(
            OidcMetadataProvider(settings.auth.discovery_endpoint),
            expected_audience=settings.auth.audience,
        ),
    )


def get_auth_whitelist_paths() -> set[str]:
    return {"/docs", "/docs/oauth2-redirect", "/openapi.json", "/redoc"}
