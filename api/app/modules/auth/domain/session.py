from __future__ import annotations

from datetime import UTC, datetime

from pydantic import BaseModel, Field, field_validator

JsonScalar = str | int | float | bool | None
JsonValue = JsonScalar | list[JsonScalar] | dict[str, JsonScalar]


class Session(BaseModel):
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
        current = now or datetime.now(UTC)
        expiration = self.expires_at

        if expiration.tzinfo is None:
            expiration = expiration.replace(tzinfo=UTC)

        return expiration <= current
