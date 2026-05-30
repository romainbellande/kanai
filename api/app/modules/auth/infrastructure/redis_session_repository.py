"""Redis-backed session repository implementation."""

from __future__ import annotations

from app.exceptions import RedisServiceException
from app.modules.auth.domain.exceptions import AuthenticationServiceException
from app.modules.auth.domain.repositories import SessionRepository
from app.modules.auth.domain.session import Session
from app.modules.auth.domain.value_objects import TokenFingerprint
from app.services.redis_service import RedisService


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
