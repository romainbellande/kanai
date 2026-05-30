"""Application-layer protocol ports for authentication services."""

from typing import Protocol

from app.modules.auth.application.dto import AuthenticatedContext


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
