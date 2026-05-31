"""Session repository interfaces and Redis-backed implementation."""

from __future__ import annotations

from typing import Protocol

from app.core.exceptions import AuthenticationServiceException, RedisServiceException
from app.core.security import TokenFingerprint
from app.schemas.auth import Session
from app.services.redis_service import RedisService


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


class RedisSessionRepository(SessionRepository):
    """Manages authentication sessions persisted in Redis."""

    def __init__(self, redis_service: RedisService) -> None:
        """Initialize the Redis session repository.

        Args:
            redis_service: Redis service used to persist session data.
        """
        self._redis_service = redis_service

    def _key(self, fingerprint: TokenFingerprint) -> str:
        return f"auth:sessions:{fingerprint.value}"

    async def get(self, fingerprint: TokenFingerprint) -> Session | None:
        """Retrieve a session by token fingerprint.

        Args:
            fingerprint: Token fingerprint that identifies the session.

        Returns:
            The matching session, or `None` when no session exists.

        Raises:
            AuthenticationServiceException: When Redis is unavailable.
        """
        try:
            return await self._redis_service.get(self._key(fingerprint), Session)
        except RedisServiceException as error:
            raise AuthenticationServiceException(
                "Authentication service unavailable",
                original_error=error,
            ) from error

    async def save(
        self,
        fingerprint: TokenFingerprint,
        session: Session,
        ttl_seconds: int,
    ) -> Session:
        """Persist a session with a time-to-live.

        Args:
            fingerprint: Token fingerprint that identifies the session.
            session: Session data to persist.
            ttl_seconds: Number of seconds before the session expires.

        Returns:
            The persisted session.

        Raises:
            AuthenticationServiceException: When Redis is unavailable.
        """
        try:
            return await self._redis_service.put(
                self._key(fingerprint),
                session,
                ttl_seconds=ttl_seconds,
            )
        except RedisServiceException as error:
            raise AuthenticationServiceException(
                "Authentication service unavailable",
                original_error=error,
            ) from error

    async def delete(self, fingerprint: TokenFingerprint) -> bool:
        """Delete a session by token fingerprint.

        Args:
            fingerprint: Token fingerprint that identifies the session.

        Returns:
            `True` when a session was deleted, otherwise `False`.

        Raises:
            AuthenticationServiceException: When Redis is unavailable.
        """
        try:
            return await self._redis_service.delete(self._key(fingerprint))
        except RedisServiceException as error:
            raise AuthenticationServiceException(
                "Authentication service unavailable",
                original_error=error,
            ) from error
