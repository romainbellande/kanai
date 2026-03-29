from __future__ import annotations

import hashlib
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class TokenFingerprint:
    value: str

    @classmethod
    def from_token(cls, token: str) -> "TokenFingerprint":
        if not token:
            raise ValueError("Bearer token cannot be empty")

        digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
        return cls(digest)

    def as_redis_key(self) -> str:
        return f"auth:sessions:{self.value}"
