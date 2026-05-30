"""ASGI middleware for authenticating HTTP requests."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Protocol

from starlette.datastructures import Headers
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.modules.auth.application.dto import AuthenticatedContext
from app.modules.auth.domain.exceptions import (
    AuthenticationServiceException,
    InvalidTokenException,
)
from app.modules.auth.interface.http_exceptions import (
    AuthHTTPException,
    AuthServiceUnavailableHTTPException,
    AuthUnauthorizedHTTPException,
)


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
