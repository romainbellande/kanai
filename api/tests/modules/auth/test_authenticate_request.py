from datetime import UTC, datetime, timedelta

import pytest

from app.modules.auth.application.dto import AuthenticatedContext
from app.modules.auth.application.authenticate_request import AuthenticateRequest
from app.modules.auth.domain.exceptions import InvalidTokenException
from app.modules.auth.domain.session import Session
from app.modules.auth.domain.value_objects import TokenFingerprint


class StubSessionRepository:
    def __init__(self, session: Session | None = None) -> None:
        self.session = session
        self.saved_calls: list[tuple[TokenFingerprint, Session, int]] = []
        self.deleted_fingerprints: list[TokenFingerprint] = []
        self.requested_fingerprints: list[TokenFingerprint] = []

    async def get(self, fingerprint: TokenFingerprint) -> Session | None:
        self.requested_fingerprints.append(fingerprint)
        return self.session

    async def save(
        self,
        fingerprint: TokenFingerprint,
        session: Session,
        ttl_seconds: int,
    ) -> Session:
        self.saved_calls.append((fingerprint, session, ttl_seconds))
        self.session = session
        return session

    async def delete(self, fingerprint: TokenFingerprint) -> bool:
        self.deleted_fingerprints.append(fingerprint)
        self.session = None
        return True


class StubTokenVerifier:
    def __init__(self, context: AuthenticatedContext) -> None:
        self.context = context
        self.calls: list[str] = []

    async def verify(self, bearer_token: str) -> AuthenticatedContext:
        self.calls.append(bearer_token)
        return self.context


def build_session(*, expires_at: datetime) -> Session:
    return Session(
        subject="user-1",
        issuer="https://issuer.test",
        expires_at=expires_at,
        audience="kanai-api",
        claims={"scope": "openid"},
    )


@pytest.mark.asyncio
async def test_existing_valid_session_skips_token_verification() -> None:
    existing_session = build_session(
        expires_at=datetime.now(UTC) + timedelta(minutes=5)
    )
    repository = StubSessionRepository(session=existing_session)
    verifier = StubTokenVerifier(
        AuthenticatedContext.from_session(
            build_session(expires_at=datetime.now(UTC) + timedelta(minutes=10))
        )
    )

    use_case = AuthenticateRequest(repository=repository, token_verifier=verifier)

    context = await use_case.execute("bearer-token")

    assert context == AuthenticatedContext.from_session(existing_session)
    assert verifier.calls == []
    assert repository.saved_calls == []
    assert repository.deleted_fingerprints == []
    assert repository.requested_fingerprints == [
        TokenFingerprint.from_token("bearer-token")
    ]


@pytest.mark.asyncio
async def test_missing_session_verifies_token_and_saves_session_with_positive_ttl() -> (
    None
):
    repository = StubSessionRepository()
    verified_context = AuthenticatedContext.from_session(
        build_session(expires_at=datetime.now(UTC) + timedelta(minutes=5))
    )
    verifier = StubTokenVerifier(verified_context)

    use_case = AuthenticateRequest(repository=repository, token_verifier=verifier)

    context = await use_case.execute("bearer-token")

    assert context == verified_context
    assert verifier.calls == ["bearer-token"]
    assert len(repository.saved_calls) == 1

    fingerprint, saved_session, ttl_seconds = repository.saved_calls[0]
    assert fingerprint == TokenFingerprint.from_token("bearer-token")
    assert saved_session == Session(
        subject=verified_context.subject,
        issuer=verified_context.issuer,
        expires_at=verified_context.expires_at,
        audience=verified_context.audience,
        claims=verified_context.claims,
    )
    assert ttl_seconds > 0


@pytest.mark.asyncio
async def test_expired_session_is_deleted_before_revalidation() -> None:
    expired_session = build_session(expires_at=datetime.now(UTC) - timedelta(seconds=1))
    repository = StubSessionRepository(session=expired_session)
    verified_context = AuthenticatedContext.from_session(
        build_session(expires_at=datetime.now(UTC) + timedelta(minutes=5))
    )
    verifier = StubTokenVerifier(verified_context)

    use_case = AuthenticateRequest(repository=repository, token_verifier=verifier)

    context = await use_case.execute("bearer-token")

    assert context == verified_context
    assert repository.deleted_fingerprints == [
        TokenFingerprint.from_token("bearer-token")
    ]
    assert verifier.calls == ["bearer-token"]
    assert len(repository.saved_calls) == 1


@pytest.mark.asyncio
async def test_verified_token_with_non_positive_ttl_is_rejected() -> None:
    repository = StubSessionRepository()
    verified_context = AuthenticatedContext.from_session(
        build_session(expires_at=datetime.now(UTC) - timedelta(seconds=1))
    )
    verifier = StubTokenVerifier(verified_context)

    use_case = AuthenticateRequest(repository=repository, token_verifier=verifier)

    with pytest.raises(InvalidTokenException):
        await use_case.execute("bearer-token")

    assert repository.saved_calls == []
