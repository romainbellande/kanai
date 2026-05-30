"""Session domain model for authenticated principals."""

from __future__ import annotations

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
