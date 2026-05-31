"""Application service for authenticating bearer-token requests."""

from __future__ import annotations

import math
from datetime import UTC, datetime
from typing import Protocol

from app.core.config import Settings
from app.core.exceptions import InvalidTokenException
from app.core.security import JoserfcTokenVerifier, TokenFingerprint
from app.db.session import DBSession
from app.integrations.oidc_metadata_provider import OidcMetadataProvider
from app.repositories.session_repository import (
    RedisSessionRepository,
    SessionRepository,
)
from app.repositories.user_repository import DatabaseUserProvisioner
from app.schemas.auth import AuthenticatedContext, Session
from app.services.redis_service import RedisService


class TokenVerifier(Protocol):
    """Defines token verification behavior for authentication adapters."""

    async def verify(self, bearer_token: str) -> AuthenticatedContext:
        """Verify a bearer token and return its authenticated context.

        Args:
            bearer_token: Bearer token value extracted from the request.

        Returns:
            Authenticated context derived from the verified token.
        """
        ...


class AuthenticatedUserProvisioner(Protocol):
    """Defines authenticated user provisioning behavior."""

    async def provision(self, context: AuthenticatedContext) -> None:
        """Provision local user state for an authenticated context.

        Args:
            context: Authenticated context used to provision user state.
        """
        ...


class AuthenticateRequest:
    """Authenticate bearer tokens and cache validated sessions."""

    def __init__(
        self,
        repository: SessionRepository,
        token_verifier: TokenVerifier,
        user_provisioner: AuthenticatedUserProvisioner,
    ) -> None:
        """Initialize the request authenticator.

        Args:
            repository: Session repository used to read, persist, and delete cached sessions.
            token_verifier: Verifier used when a token is not backed by a valid cached session.
            user_provisioner: Provisioner used to ensure authenticated users exist locally.
        """
        self._repository = repository
        self._token_verifier = token_verifier
        self._user_provisioner = user_provisioner

    async def execute(self, bearer_token: str) -> AuthenticatedContext:
        """Authenticate a bearer token and return its authenticated context.

        Args:
            bearer_token: Raw bearer token to authenticate.

        Returns:
            Authenticated context derived from a cached session or verified token.

        Raises:
            InvalidTokenException: The token is malformed or already expired.
        """
        try:
            fingerprint = TokenFingerprint.from_token(bearer_token)
        except ValueError as error:
            raise InvalidTokenException(str(error), original_error=error) from error

        existing_session = await self._repository.get(fingerprint)

        if existing_session is not None:
            if not existing_session.is_expired():
                authenticated_context = AuthenticatedContext.from_session(
                    existing_session
                )
                await self._user_provisioner.provision(authenticated_context)
                return authenticated_context

            await self._repository.delete(fingerprint)

        authenticated_context = await self._token_verifier.verify(bearer_token)
        ttl_seconds = self._compute_ttl_seconds(authenticated_context.expires_at)
        if ttl_seconds <= 0:
            raise InvalidTokenException("Token is expired")

        session = Session(
            subject=authenticated_context.subject,
            issuer=authenticated_context.issuer,
            expires_at=authenticated_context.expires_at,
            audience=authenticated_context.audience,
            claims=authenticated_context.claims,
        )
        await self._repository.save(fingerprint, session, ttl_seconds)
        await self._user_provisioner.provision(authenticated_context)
        return authenticated_context

    def _compute_ttl_seconds(self, expires_at: datetime) -> int:
        now = datetime.now(UTC)
        expiration = expires_at.astimezone(UTC)
        return math.ceil((expiration - now).total_seconds())


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
