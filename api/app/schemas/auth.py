"""Authentication schemas and session payloads."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from pydantic import BaseModel, Field, field_validator
from typing_extensions import TypeAliasType

JsonScalar = str | int | float | bool | None
JsonValue = TypeAliasType(
    "JsonValue",
    JsonScalar | list["JsonValue"] | dict[str, "JsonValue"],
)


def _normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)

    return value


class Session(BaseModel):
    """Represents an authenticated principal and its token claims.

    Parameters:
        subject: Stable subject identifier for the authenticated principal.
        issuer: Authority that issued the session claims.
        expires_at: Date and time when the session is no longer valid.
        audience: Intended audience or audiences for the session claims.
        claims: Additional JSON-compatible claims associated with the session.
    """

    subject: str
    issuer: str
    expires_at: datetime
    audience: str | list[str] | None = None
    claims: dict[str, JsonValue] = Field(default_factory=dict)

    @field_validator("subject", "issuer")
    @classmethod
    def _validate_non_empty(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Session fields must not be blank")
        return cleaned

    def is_expired(self, now: datetime | None = None) -> bool:
        """Return whether the session has expired.

        Args:
            now: Current time to compare against `expires_at`. Defaults to the
                current UTC time.

        Returns:
            True when `expires_at` is earlier than or equal to `now`, otherwise
            False.
        """

        current = _normalize_datetime(now or datetime.now(UTC))
        expiration = _normalize_datetime(self.expires_at)

        return expiration <= current


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
