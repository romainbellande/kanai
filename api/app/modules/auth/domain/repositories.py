from __future__ import annotations

from typing import Protocol

from app.modules.auth.domain.session import Session
from app.modules.auth.domain.value_objects import TokenFingerprint


class SessionRepository(Protocol):
    async def get(self, fingerprint: TokenFingerprint) -> Session | None: ...

    async def save(
        self,
        fingerprint: TokenFingerprint,
        session: Session,
        ttl_seconds: int,
    ) -> Session: ...

    async def delete(self, fingerprint: TokenFingerprint) -> bool: ...
