from __future__ import annotations

from app.exceptions import RedisServiceException
from app.modules.auth.domain.exceptions import AuthenticationServiceException
from app.modules.auth.domain.repositories import SessionRepository
from app.modules.auth.domain.session import Session
from app.modules.auth.domain.value_objects import TokenFingerprint
from app.services.redis_service import RedisService


class RedisSessionRepository(SessionRepository):
    def __init__(self, redis_service: RedisService) -> None:
        self._redis_service = redis_service

    def _key(self, fingerprint: TokenFingerprint) -> str:
        return f"auth:sessions:{fingerprint.value}"

    async def get(self, fingerprint: TokenFingerprint) -> Session | None:
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
        try:
            return await self._redis_service.delete(self._key(fingerprint))
        except RedisServiceException as error:
            raise AuthenticationServiceException(
                "Authentication service unavailable",
                original_error=error,
            ) from error
