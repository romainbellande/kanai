from datetime import UTC, datetime, timedelta, tzinfo

import pytest

from app.core.exceptions import InvalidTokenException
from app.core.security import TokenFingerprint
from app.schemas.auth import AuthenticatedContext, Session
from app.services.auth_service import AuthenticateRequest


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


class StubUserProvisioner:
    def __init__(self) -> None:
        self.contexts: list[AuthenticatedContext] = []

    async def provision(self, context: AuthenticatedContext) -> None:
        self.contexts.append(context)


class FixedDateTime(datetime):
    current: datetime

    @classmethod
    def now(cls, tz: tzinfo | None = None) -> "FixedDateTime":
        current = cls.current if tz is None else cls.current.astimezone(tz)
        return cls.fromtimestamp(current.timestamp(), tz=current.tzinfo)


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
    user_provisioner = StubUserProvisioner()

    use_case = AuthenticateRequest(
        repository=repository,
        token_verifier=verifier,
        user_provisioner=user_provisioner,
    )

    context = await use_case.execute("bearer-token")

    assert context == AuthenticatedContext.from_session(existing_session)
    assert user_provisioner.contexts == [context]
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
    user_provisioner = StubUserProvisioner()

    use_case = AuthenticateRequest(
        repository=repository,
        token_verifier=verifier,
        user_provisioner=user_provisioner,
    )

    context = await use_case.execute("bearer-token")

    assert context == verified_context
    assert user_provisioner.contexts == [context]
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
    user_provisioner = StubUserProvisioner()

    use_case = AuthenticateRequest(
        repository=repository,
        token_verifier=verifier,
        user_provisioner=user_provisioner,
    )

    context = await use_case.execute("bearer-token")

    assert context == verified_context
    assert user_provisioner.contexts == [context]
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

    use_case = AuthenticateRequest(
        repository=repository,
        token_verifier=verifier,
        user_provisioner=StubUserProvisioner(),
    )

    with pytest.raises(InvalidTokenException):
        await use_case.execute("bearer-token")

    assert repository.saved_calls == []


@pytest.mark.asyncio
@pytest.mark.parametrize("bearer_token", ["", "   "])
async def test_blank_or_whitespace_token_raises_invalid_token_exception(
    bearer_token: str,
) -> None:
    repository = StubSessionRepository()
    verifier = StubTokenVerifier(
        AuthenticatedContext.from_session(
            build_session(expires_at=datetime.now(UTC) + timedelta(minutes=5))
        )
    )

    use_case = AuthenticateRequest(
        repository=repository,
        token_verifier=verifier,
        user_provisioner=StubUserProvisioner(),
    )

    with pytest.raises(InvalidTokenException, match="Bearer token cannot be empty"):
        await use_case.execute(bearer_token)

    assert verifier.calls == []
    assert repository.saved_calls == []


@pytest.mark.asyncio
async def test_token_with_less_than_one_second_remaining_is_accepted_and_saved(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fixed_now = datetime(2026, 1, 1, tzinfo=UTC)
    FixedDateTime.current = fixed_now
    monkeypatch.setattr(
        "app.services.auth_service.datetime",
        FixedDateTime,
    )

    repository = StubSessionRepository()
    verified_context = AuthenticatedContext.from_session(
        build_session(expires_at=fixed_now + timedelta(milliseconds=100))
    )
    verifier = StubTokenVerifier(verified_context)
    user_provisioner = StubUserProvisioner()

    use_case = AuthenticateRequest(
        repository=repository,
        token_verifier=verifier,
        user_provisioner=user_provisioner,
    )

    context = await use_case.execute("bearer-token")

    assert context == verified_context
    assert user_provisioner.contexts == [context]
    assert verifier.calls == ["bearer-token"]
    assert len(repository.saved_calls) == 1
    assert repository.saved_calls[0][2] == 1
