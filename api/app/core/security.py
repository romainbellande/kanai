"""Authentication middleware, token fingerprinting, and JWT verification."""

from __future__ import annotations

import hashlib
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol, cast

from fastapi import HTTPException, status
from joserfc import jwt
from joserfc.errors import JoseError
from joserfc.jwk import KeySet
from starlette.datastructures import Headers
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.exceptions import AuthenticationServiceException, InvalidTokenException
from app.schemas.auth import AuthenticatedContext, Session


class AuthHTTPException(HTTPException):
    """Base HTTP exception for authentication errors."""

    pass


class AuthUnauthorizedHTTPException(AuthHTTPException):
    """HTTP exception for unauthorized authentication requests."""

    def __init__(self, detail: str) -> None:
        """Initialize an unauthorized authentication exception.

        Args:
            detail: Client-facing error detail for the response body.
        """
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class AuthServiceUnavailableHTTPException(AuthHTTPException):
    """HTTP exception for unavailable authentication dependencies."""

    def __init__(self, detail: str) -> None:
        """Initialize an authentication service unavailable exception.

        Args:
            detail: Client-facing error detail for the response body.
        """
        super().__init__(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)


class AuthenticateRequestHandler(Protocol):
    """Defines the request authentication use case required by middleware."""

    async def execute(self, bearer_token: str) -> AuthenticatedContext:
        """Authenticate a bearer token and return the authenticated context.

        Args:
            bearer_token: Token extracted from the HTTP Authorization header.

        Returns:
            Authenticated request context for downstream handlers.
        """
        ...


class AuthMiddleware:
    """Authenticates HTTP requests before passing them to the ASGI app.

    The middleware skips non-HTTP scopes and configured whitelist paths. For
    protected HTTP requests, it validates the Bearer token and stores the
    authenticated context on the ASGI scope.
    """

    def __init__(
        self,
        app: ASGIApp,
        authenticate_request: AuthenticateRequestHandler,
        whitelist_paths: Iterable[str] | None = None,
    ) -> None:
        """Initialize the authentication middleware.

        Args:
            app: Downstream ASGI application to call after authentication.
            authenticate_request: Handler used to authenticate bearer tokens.
            whitelist_paths: Paths that bypass authentication. Defaults to no
                whitelisted paths.
        """
        self.app = app
        self.authenticate_request = authenticate_request
        self.whitelist_paths = set(whitelist_paths or ())

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Authenticate a request scope and call the downstream application.

        Args:
            scope: ASGI connection scope for the request.
            receive: ASGI callable for receiving request events.
            send: ASGI callable for sending response events.
        """
        if scope["type"] != "http" or self._is_whitelisted_path(scope["path"]):
            await self.app(scope, receive, send)
            return

        try:
            bearer_token = self._extract_bearer_token(scope)
            scope["auth"] = await self.authenticate_request.execute(bearer_token)
        except AuthHTTPException as exc:
            await self._send_exception(exc, scope, receive, send)
            return
        except InvalidTokenException as exc:
            await self._send_exception(
                AuthUnauthorizedHTTPException(exc.message),
                scope,
                receive,
                send,
            )
            return
        except AuthenticationServiceException as exc:
            await self._send_exception(
                AuthServiceUnavailableHTTPException(exc.message),
                scope,
                receive,
                send,
            )
            return

        await self.app(scope, receive, send)

    async def _send_exception(
        self,
        exc: AuthHTTPException,
        scope: Scope,
        receive: Receive,
        send: Send,
    ) -> None:
        await JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=exc.headers,
        )(scope, receive, send)

    def _is_whitelisted_path(self, path: str) -> bool:
        normalized_path = path.rstrip("/") or "/"
        return normalized_path in self.whitelist_paths

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


@dataclass(frozen=True, slots=True)
class TokenFingerprint:
    """Represents a stable fingerprint for a bearer token.

    Parameters:
        value: SHA-256 hex digest used to identify a token without storing it.
    """

    value: str

    @classmethod
    def from_token(cls, token: str) -> "TokenFingerprint":
        """Create a token fingerprint from a bearer token.

        Args:
            token: Bearer token to hash.

        Returns:
            Fingerprint containing the token's SHA-256 hex digest.

        Raises:
            ValueError: If the bearer token is empty or only whitespace.
        """
        if not token or not token.strip():
            raise ValueError("Bearer token cannot be empty")

        digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
        return cls(digest)


class MetadataProvider(Protocol):
    """Provides OpenID Connect metadata required to validate tokens."""

    async def get_discovery_document(self) -> dict[str, object]:
        """Fetch the OIDC discovery document.

        Returns:
            Discovery metadata used to configure token claim validation.
        """
        ...

    async def get_jwks(self) -> dict[str, object]:
        """Fetch the JSON Web Key Set for token signature verification.

        Returns:
            JWKS document containing public signing keys.
        """
        ...


class JoserfcTokenVerifier:
    """Verifies bearer tokens against OIDC metadata and JWKS keys."""

    def __init__(
        self,
        metadata_provider: MetadataProvider,
        expected_audience: str | None = None,
    ) -> None:
        """Initialize the token verifier.

        Args:
            metadata_provider: Provider for OIDC discovery metadata and JWKS keys.
            expected_audience: Required JWT audience when audience validation is
                enabled. Defaults to None.
        """
        self.metadata_provider = metadata_provider
        self.expected_audience = expected_audience

    async def verify(self, bearer_token: str) -> AuthenticatedContext:
        """Validate a bearer token and return its authenticated context.

        Args:
            bearer_token: Encoded JWT bearer token to validate.

        Returns:
            Authenticated context derived from the token claims.

        Raises:
            AuthenticationServiceException: If OIDC metadata or JWKS setup fails.
            InvalidTokenException: If the token cannot be decoded, validated, or
                converted into a session.
        """
        discovery_document = await self.metadata_provider.get_discovery_document()
        jwks = await self.metadata_provider.get_jwks()

        try:
            key_set = KeySet.import_key_set(cast(Any, jwks))
        except Exception as error:
            raise AuthenticationServiceException(
                "Failed to construct JWT key set",
                original_error=error,
            ) from error

        try:
            token = jwt.decode(bearer_token, key_set)
            claims_registry = jwt.JWTClaimsRegistry(
                **cast(dict[str, Any], self._claim_options(discovery_document))
            )
            claims_registry.validate(token.claims)
        except JoseError as error:
            raise InvalidTokenException(str(error), original_error=error) from error

        try:
            session = Session(
                subject=str(token.claims["sub"]),
                issuer=str(token.claims["iss"]),
                expires_at=datetime.fromtimestamp(token.claims["exp"], tz=UTC),
                audience=token.claims.get("aud"),
                claims=token.claims,
            )
        except (KeyError, OSError, OverflowError, TypeError, ValueError) as error:
            raise InvalidTokenException(
                "Token claims are malformed",
                original_error=error,
            ) from error

        return AuthenticatedContext.from_session(session)

    def _claim_options(
        self,
        discovery_document: dict[str, object],
    ) -> dict[str, dict[str, object]]:
        issuer = discovery_document.get("issuer")
        if not isinstance(issuer, str) or not issuer:
            raise AuthenticationServiceException(
                "OIDC discovery document is missing issuer"
            )

        options: dict[str, dict[str, object]] = {
            "exp": {"essential": True},
            "iss": {"essential": True, "value": issuer},
            "sub": {"essential": True},
        }
        if self.expected_audience is not None:
            options["aud"] = {"essential": True, "value": self.expected_audience}

        return options
