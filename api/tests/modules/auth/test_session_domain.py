from datetime import UTC, datetime, timedelta
import hashlib

import pytest
from pydantic import ValidationError

from app.core.security import TokenFingerprint
from app.schemas.auth import Session


def test_token_fingerprint_uses_sha256() -> None:
    fingerprint = TokenFingerprint.from_token("bearer-token")

    assert fingerprint.value == hashlib.sha256(b"bearer-token").hexdigest()


def test_token_fingerprint_rejects_empty_token() -> None:
    with pytest.raises(ValueError, match="Bearer token cannot be empty"):
        TokenFingerprint.from_token("")


def test_token_fingerprint_rejects_whitespace_only_token() -> None:
    with pytest.raises(ValueError, match="Bearer token cannot be empty"):
        TokenFingerprint.from_token("   ")


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


def test_session_accepts_nested_claims_payload() -> None:
    session = Session(
        subject="user-1",
        issuer="https://issuer.test",
        expires_at=datetime.now(UTC) + timedelta(minutes=5),
        claims={
            "realm_access": {"roles": ["admin", "reader"]},
            "address": {"country": "NL", "metadata": {"verified": True}},
        },
    )

    assert session.claims["realm_access"] == {"roles": ["admin", "reader"]}
    assert session.claims["address"] == {
        "country": "NL",
        "metadata": {"verified": True},
    }


def test_session_is_expired_handles_naive_now_input() -> None:
    session = Session(
        subject="user-1",
        issuer="https://issuer.test",
        expires_at=datetime.now(UTC) + timedelta(minutes=5),
    )
    naive_now = datetime.now(UTC).replace(tzinfo=None)

    assert session.is_expired(now=naive_now) is False


@pytest.mark.parametrize("field_name", ["subject", "issuer"])
def test_session_rejects_blank_required_fields(field_name: str) -> None:
    payload = {
        "subject": "user-1",
        "issuer": "https://issuer.test",
        "expires_at": datetime.now(UTC) + timedelta(minutes=5),
    }
    payload[field_name] = "   "

    with pytest.raises(ValidationError, match="Session fields must not be blank"):
        Session(**payload)
