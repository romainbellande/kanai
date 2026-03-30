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
    async def execute(self, bearer_token: str) -> AuthenticatedContext: ...


class AuthMiddleware:
    def __init__(
        self,
        app: ASGIApp,
        authenticate_request: AuthenticateRequestHandler,
        whitelist_paths: Iterable[str] | None = None,
    ) -> None:
        self.app = app
        self.authenticate_request = authenticate_request
        self.whitelist_paths = set(whitelist_paths or ())

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
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
