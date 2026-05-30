"""Value objects for authentication domain concepts."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class TokenFingerprint:
    """Represents a stable fingerprint for a bearer token.

    Parameters:
        value: SHA-256 hex digest used to identify a token without storing it.
    """

    value: str

    @classmethod
    def from_token(cls, token: str) -> "TokenFingerprint":
        """Create a token fingerprint from a bearer token.

        Args:
            token: Bearer token to hash.

        Returns:
            Fingerprint containing the token's SHA-256 hex digest.

        Raises:
            ValueError: If the bearer token is empty or only whitespace.
        """
        if not token or not token.strip():
            raise ValueError("Bearer token cannot be empty")

        digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
        return cls(digest)
