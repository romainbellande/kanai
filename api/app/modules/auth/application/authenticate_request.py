from __future__ import annotations

import math
from datetime import UTC, datetime

from app.modules.auth.application.dto import AuthenticatedContext
from app.modules.auth.application.ports import TokenVerifier
from app.modules.auth.domain.exceptions import InvalidTokenException
from app.modules.auth.domain.repositories import SessionRepository
from app.modules.auth.domain.session import Session
from app.modules.auth.domain.value_objects import TokenFingerprint


class AuthenticateRequest:
    def __init__(
        self,
        repository: SessionRepository,
        token_verifier: TokenVerifier,
    ) -> None:
        self._repository = repository
        self._token_verifier = token_verifier

    async def execute(self, bearer_token: str) -> AuthenticatedContext:
        try:
            fingerprint = TokenFingerprint.from_token(bearer_token)
        except ValueError as error:
            raise InvalidTokenException(str(error), original_error=error) from error

        existing_session = await self._repository.get(fingerprint)

        if existing_session is not None:
            if not existing_session.is_expired():
                return AuthenticatedContext.from_session(existing_session)

            await self._repository.delete(fingerprint)

        authenticated_context = await self._token_verifier.verify(bearer_token)
        ttl_seconds = self._compute_ttl_seconds(authenticated_context.expires_at)
        if ttl_seconds <= 0:
            raise InvalidTokenException("Token is expired")

        session = Session(
            subject=authenticated_context.subject,
            issuer=authenticated_context.issuer,
            expires_at=authenticated_context.expires_at,
            audience=authenticated_context.audience,
            claims=authenticated_context.claims,
        )
        await self._repository.save(fingerprint, session, ttl_seconds)
        return authenticated_context

    def _compute_ttl_seconds(self, expires_at: datetime) -> int:
        now = datetime.now(UTC)
        expiration = expires_at.astimezone(UTC)
        return math.ceil((expiration - now).total_seconds())
