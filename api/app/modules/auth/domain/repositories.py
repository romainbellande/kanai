"""Repository interfaces for authentication domain persistence."""

from __future__ import annotations

from typing import Protocol

from app.modules.auth.domain.session import Session
from app.modules.auth.domain.value_objects import TokenFingerprint


class SessionRepository(Protocol):
    """Defines persistence operations for authentication sessions.

    Implementations store, retrieve, and delete sessions by token fingerprint.
    """

    async def get(self, fingerprint: TokenFingerprint) -> Session | None:
        """Retrieve a session by token fingerprint.

        Args:
            fingerprint: Token fingerprint that identifies the session.

        Returns:
            Matching session when one exists, otherwise `None`.
        """
        ...

    async def save(
        self,
        fingerprint: TokenFingerprint,
        session: Session,
        ttl_seconds: int,
    ) -> Session:
        """Persist a session with an expiration time.

        Args:
            fingerprint: Token fingerprint that identifies the session.
            session: Session data to persist.
            ttl_seconds: Number of seconds before the stored session expires.

        Returns:
            Persisted session.
        """
        ...

    async def delete(self, fingerprint: TokenFingerprint) -> bool:
        """Delete a session by token fingerprint.

        Args:
            fingerprint: Token fingerprint that identifies the session.

        Returns:
            `True` when a session was deleted, otherwise `False`.
        """
        ...
