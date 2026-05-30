from typing import Protocol

from app.modules.auth.application.dto import AuthenticatedContext


class TokenVerifier(Protocol):
    async def verify(self, bearer_token: str) -> AuthenticatedContext: ...


class AuthenticatedUserProvisioner(Protocol):
    async def provision(self, context: AuthenticatedContext) -> None: ...
