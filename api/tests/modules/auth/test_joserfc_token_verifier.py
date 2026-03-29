from datetime import UTC, datetime

import pytest
from joserfc.errors import JoseError

from app.modules.auth.domain.exceptions import InvalidTokenException
from app.modules.auth.infrastructure.joserfc_token_verifier import JoserfcTokenVerifier


class StubMetadataProvider:
    async def get_jwks(self) -> dict[str, object]:
        return {"keys": [{"kid": "kid-1", "kty": "RSA"}]}


class StubToken:
    def __init__(self, claims: dict[str, object]) -> None:
        self.claims = claims


@pytest.mark.asyncio
async def test_verify_returns_authenticated_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    verifier = JoserfcTokenVerifier(metadata_provider=StubMetadataProvider())
    stub_token = StubToken(
        {
            "sub": "user-1",
            "iss": "https://issuer.test",
            "exp": 1_893_456_000,
            "aud": "kanai-api",
            "scope": "openid profile",
        }
    )
    validated_claims: dict[str, object] = {}

    class FakeJWTClaimsRegistry:
        def __init__(self, **kwargs: object) -> None:
            assert kwargs == {
                "exp": {"essential": True},
                "iss": {"essential": True},
                "sub": {"essential": True},
            }

        def validate(self, claims: dict[str, object]) -> None:
            validated_claims.update(claims)

    def fake_import_key_set(jwks: dict[str, object]) -> object:
        assert jwks == {"keys": [{"kid": "kid-1", "kty": "RSA"}]}
        return {"imported": True}

    def fake_decode(token: str, key: object) -> StubToken:
        assert token == "bearer-token"
        assert key == {"imported": True}
        return stub_token

    monkeypatch.setattr(
        "app.modules.auth.infrastructure.joserfc_token_verifier.KeySet.import_key_set",
        fake_import_key_set,
    )
    monkeypatch.setattr(
        "app.modules.auth.infrastructure.joserfc_token_verifier.jwt.decode",
        fake_decode,
    )
    monkeypatch.setattr(
        "app.modules.auth.infrastructure.joserfc_token_verifier.jwt.JWTClaimsRegistry",
        FakeJWTClaimsRegistry,
    )

    context = await verifier.verify("bearer-token")

    assert context.subject == "user-1"
    assert context.issuer == "https://issuer.test"
    assert context.expires_at == datetime.fromtimestamp(1_893_456_000, tz=UTC)
    assert context.audience == "kanai-api"
    assert context.claims == stub_token.claims
    assert validated_claims == stub_token.claims


@pytest.mark.asyncio
async def test_verify_maps_jose_error_to_invalid_token_exception(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    verifier = JoserfcTokenVerifier(metadata_provider=StubMetadataProvider())

    def fake_import_key_set(_: dict[str, object]) -> object:
        return {"imported": True}

    def fake_decode(_: str, __: object) -> StubToken:
        raise JoseError("token invalid")

    monkeypatch.setattr(
        "app.modules.auth.infrastructure.joserfc_token_verifier.KeySet.import_key_set",
        fake_import_key_set,
    )
    monkeypatch.setattr(
        "app.modules.auth.infrastructure.joserfc_token_verifier.jwt.decode",
        fake_decode,
    )

    with pytest.raises(InvalidTokenException, match="token invalid"):
        await verifier.verify("bearer-token")
