"""Authentication application data transfer objects."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from app.modules.auth.domain.session import JsonValue, Session


@dataclass(frozen=True)
class AuthenticatedContext:
    """Authenticated request context derived from a validated session.

    Parameters:
        subject: Principal identifier from the authenticated session.
        issuer: Token issuer that authenticated the principal.
        expires_at: Datetime when the authenticated session expires.
        audience: Intended token audience, if one was provided.
        claims: Validated token claims associated with the session.
    """

    subject: str
    issuer: str
    expires_at: datetime
    audience: str | list[str] | None
    claims: dict[str, JsonValue]

    @classmethod
    def from_session(cls, session: Session) -> "AuthenticatedContext":
        """Create an authenticated context from a domain session.

        Args:
            session: Validated domain session to convert.

        Returns:
            Authenticated context carrying session identity and claims.
        """

        return cls(
            subject=session.subject,
            issuer=session.issuer,
            expires_at=session.expires_at,
            audience=session.audience,
            claims=session.claims,
        )
