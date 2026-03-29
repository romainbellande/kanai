from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from app.modules.auth.domain.session import JsonValue, Session


@dataclass(frozen=True)
class AuthenticatedContext:
    subject: str
    issuer: str
    expires_at: datetime
    audience: str | list[str] | None
    claims: dict[str, JsonValue]

    @classmethod
    def from_session(cls, session: Session) -> "AuthenticatedContext":
        return cls(
            subject=session.subject,
            issuer=session.issuer,
            expires_at=session.expires_at,
            audience=session.audience,
            claims=session.claims,
        )
