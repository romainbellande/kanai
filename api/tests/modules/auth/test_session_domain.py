from datetime import UTC, datetime, timedelta
import hashlib

from app.modules.auth.domain.session import Session
from app.modules.auth.domain.value_objects import TokenFingerprint


def test_token_fingerprint_uses_sha256_and_auth_namespace() -> None:
    fingerprint = TokenFingerprint.from_token("bearer-token")

    assert fingerprint.value == hashlib.sha256(b"bearer-token").hexdigest()
    assert fingerprint.as_redis_key() == f"auth:sessions:{fingerprint.value}"


def test_session_is_expired_for_past_timestamp() -> None:
    session = Session(
        subject="user-1",
        issuer="https://issuer.test",
        expires_at=datetime.now(UTC) - timedelta(seconds=5),
    )

    assert session.is_expired() is True


def test_session_is_not_expired_for_future_timestamp() -> None:
    session = Session(
        subject="user-1",
        issuer="https://issuer.test",
        expires_at=datetime.now(UTC) + timedelta(minutes=5),
    )

    assert session.is_expired() is False
