from __future__ import annotations

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
        return await self._redis_service.get(self._key(fingerprint), Session)

    async def save(
        self,
        fingerprint: TokenFingerprint,
        session: Session,
        ttl_seconds: int,
    ) -> Session:
        return await self._redis_service.put(
            self._key(fingerprint),
            session,
            ttl_seconds=ttl_seconds,
        )

    async def delete(self, fingerprint: TokenFingerprint) -> bool:
        return await self._redis_service.delete(self._key(fingerprint))
