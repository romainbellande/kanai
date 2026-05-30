"""Bootstrap authentication dependencies for the API."""

from app.config import Settings
from app.modules.auth.application.authenticate_request import AuthenticateRequest
from app.modules.auth.infrastructure.joserfc_token_verifier import (
    JoserfcTokenVerifier,
)
from app.modules.auth.infrastructure.database_user_provisioner import (
    DatabaseUserProvisioner,
)
from app.modules.auth.infrastructure.oidc_metadata_provider import OidcMetadataProvider
from app.modules.auth.infrastructure.redis_session_repository import (
    RedisSessionRepository,
)
from app.services.database_service import DBSession
from app.services.redis_service import RedisService


def build_authenticate_request(
    settings: Settings,
    redis_service: RedisService,
) -> AuthenticateRequest:
    """Build the authentication request use case.

    Args:
        settings: Application settings containing auth provider configuration.
        redis_service: Redis connection service used for session persistence.

    Returns:
        Configured `AuthenticateRequest` instance.
    """
    return AuthenticateRequest(
        repository=RedisSessionRepository(redis_service),
        token_verifier=JoserfcTokenVerifier(
            OidcMetadataProvider(settings.auth.discovery_endpoint),
            expected_audience=settings.auth.audience,
        ),
        user_provisioner=DatabaseUserProvisioner(DBSession),
    )


def get_auth_whitelist_paths() -> set[str]:
    """Return API paths that bypass authentication.

    Returns:
        Set of documentation and OpenAPI paths allowed without authentication.
    """
    return {"/docs", "/docs/oauth2-redirect", "/openapi.json", "/redoc"}
