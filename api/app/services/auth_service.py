"""Application service for authenticating bearer-token requests."""

from __future__ import annotations

import math
from collections.abc import Callable, Iterable
from datetime import UTC, datetime
from typing import Protocol

from fastapi import HTTPException, Request, WebSocket, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.datastructures import Headers
from starlette.types import Scope

from app.core.config import Settings
from app.core.exceptions import InvalidTokenException
from app.core.security import (
    AuthUnauthorizedHTTPException,
    JoserfcTokenVerifier,
    TokenFingerprint,
)
from app.db.session import DBSession
from app.integrations.oidc_metadata_provider import OidcMetadataProvider
from app.models.user import User
from app.repositories.session_repository import (
    RedisSessionRepository,
    SessionRepository,
)
from app.repositories.user_repository import DatabaseUserProvisioner, UserRepository
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


class CurrentUserRepository(Protocol):
    """Defines user lookup behavior required by request auth."""

    async def get_by_external_id(self, external_id: str) -> User | None:
        """Return a user by external identity provider ID."""
        ...


class RequestAuthBoundary:
    """Authenticate request scopes and resolve request users."""

    def __init__(
        self,
        authenticate_request: AuthenticateRequestHandler,
        *,
        whitelist_paths: Iterable[str] | None = None,
        user_repository_factory: Callable[
            [AsyncSession], CurrentUserRepository
        ] = UserRepository,
    ) -> None:
        """Initialize the request authentication boundary.

        Args:
            authenticate_request: Use case that authenticates bearer tokens.
            whitelist_paths: HTTP paths that bypass request authentication.
            user_repository_factory: Factory used to resolve persisted users.
        """
        self._authenticate_request = authenticate_request
        self._whitelist_paths = set(whitelist_paths or ())
        self._user_repository_factory = user_repository_factory

    async def authenticate_scope(self, scope: Scope) -> AuthenticatedContext | None:
        """Authenticate an ASGI scope and store auth context on it.

        Args:
            scope: ASGI connection scope for the request.

        Returns:
            Authenticated context for protected HTTP requests, otherwise None
            for non-HTTP or bypassed scopes.
        """
        if scope["type"] != "http" or self._is_whitelisted_path(scope["path"]):
            return None

        bearer_token = self._extract_bearer_token(scope)
        auth_context = await self._authenticate_request.execute(bearer_token)
        scope["auth"] = auth_context
        return auth_context

    async def current_user(self, request: Request, session: AsyncSession) -> User:
        """Resolve the authenticated database user from request context.

        Args:
            request: Incoming request containing authentication context in scope.
            session: Database session used to load the authenticated user.

        Returns:
            The authenticated user model.

        Raises:
            HTTPException: If authentication context is missing or the user cannot
                be found.
        """
        auth_context = request.scope.get("auth")
        if not isinstance(auth_context, AuthenticatedContext):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing authenticated context",
            )

        user = await self._user_repository_factory(session).get_by_external_id(
            auth_context.subject
        )
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authenticated user not found",
            )

        return user

    def _is_whitelisted_path(self, path: str) -> bool:
        normalized_path = path.rstrip("/") or "/"
        return normalized_path in self._whitelist_paths

    def _extract_bearer_token(self, scope: Scope) -> str:
        authorization = Headers(scope=scope).get("Authorization")
        if authorization is None:
            raise AuthUnauthorizedHTTPException("Missing Authorization header")

        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token.strip():
            raise AuthUnauthorizedHTTPException(
                "Authorization header must use Bearer scheme"
            )

        return token.strip()


class WebSocketAuthError(Exception):
    """Client-facing WebSocket authentication failure."""

    def __init__(self, code: str, message: str) -> None:
        """Initialize a WebSocket auth failure."""
        super().__init__(message)
        self.code = code
        self.message = message


class WebSocketAuthBoundary:
    """Authenticate WebSockets using bearer tokens from subprotocols."""

    def __init__(
        self,
        authenticate_request: AuthenticateRequestHandler,
        *,
        user_repository_factory: Callable[
            [AsyncSession], CurrentUserRepository
        ] = UserRepository,
    ) -> None:
        """Initialize the WebSocket authentication boundary."""
        self._authenticate_request = authenticate_request
        self._user_repository_factory = user_repository_factory

    async def current_user(self, websocket: WebSocket, session: AsyncSession) -> User:
        """Resolve a local user from the WebSocket bearer subprotocol token."""
        token = self._extract_subprotocol_bearer_token(websocket)
        try:
            auth_context = await self._authenticate_request.execute(token)
        except InvalidTokenException as error:
            raise WebSocketAuthError("invalid_token", error.message) from error

        user = await self._user_repository_factory(session).get_by_external_id(
            auth_context.subject
        )
        if user is None:
            raise WebSocketAuthError(
                "authenticated_user_not_found",
                "Authenticated user not found",
            )

        return user

    def _extract_subprotocol_bearer_token(self, websocket: WebSocket) -> str:
        subprotocols = websocket.scope.get("subprotocols", [])
        if not isinstance(subprotocols, list):
            subprotocols = []

        for subprotocol in subprotocols:
            if not isinstance(subprotocol, str):
                continue
            scheme, separator, token = subprotocol.partition(".")
            if separator and scheme.lower() == "bearer" and token.strip():
                return token.strip()

        raise WebSocketAuthError(
            "missing_token",
            "Missing bearer token subprotocol",
        )


class AuthenticateRequestHandler(Protocol):
    """Defines bearer-token authentication behavior for request auth."""

    async def execute(self, bearer_token: str) -> AuthenticatedContext:
        """Authenticate a bearer token and return the authenticated context."""
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


def build_request_auth_boundary(
    settings: Settings,
    redis_service: RedisService,
) -> RequestAuthBoundary:
    """Build the request authentication boundary.

    Args:
        settings: Application settings containing auth provider configuration.
        redis_service: Redis connection service used for session persistence.

    Returns:
        Configured `RequestAuthBoundary` instance.
    """
    return RequestAuthBoundary(
        build_authenticate_request(settings=settings, redis_service=redis_service),
        whitelist_paths=get_auth_whitelist_paths(),
    )


def get_auth_whitelist_paths() -> set[str]:
    """Return API paths that bypass authentication.

    Returns:
        Set of documentation and OpenAPI paths allowed without authentication.
    """
    return {
        "/docs",
        "/docs/oauth2-redirect",
        "/a2a/acceptance-criteria/.well-known/agent-card.json",
        "/openapi.json",
        "/redoc",
    }
