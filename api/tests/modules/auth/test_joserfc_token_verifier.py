from datetime import UTC, datetime
from typing import cast

import pytest
from joserfc.errors import JoseError

from app.modules.auth.domain.exceptions import AuthenticationServiceException
from app.modules.auth.domain.exceptions import InvalidTokenException
from app.modules.auth.infrastructure.joserfc_token_verifier import JoserfcTokenVerifier


class StubMetadataProvider:
    async def get_discovery_document(self) -> dict[str, object]:
        return {"issuer": "https://issuer.test"}

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
        def __init__(self, **kwargs: dict[str, object]) -> None:
            assert kwargs == {
                "exp": {"essential": True},
                "iss": {"essential": True, "value": "https://issuer.test"},
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


@pytest.mark.asyncio
async def test_verify_rejects_wrong_issuer(monkeypatch: pytest.MonkeyPatch) -> None:
    verifier = JoserfcTokenVerifier(metadata_provider=StubMetadataProvider())
    stub_token = StubToken(
        {
            "sub": "user-1",
            "iss": "https://wrong-issuer.test",
            "exp": 1_893_456_000,
        }
    )

    class FakeJWTClaimsRegistry:
        def __init__(self, **kwargs: dict[str, object]) -> None:
            self.expected_issuer = cast(str, kwargs["iss"]["value"])

        def validate(self, claims: dict[str, object]) -> None:
            if claims["iss"] != self.expected_issuer:
                raise JoseError("invalid issuer")

    monkeypatch.setattr(
        "app.modules.auth.infrastructure.joserfc_token_verifier.KeySet.import_key_set",
        lambda _: {"imported": True},
    )
    monkeypatch.setattr(
        "app.modules.auth.infrastructure.joserfc_token_verifier.jwt.decode",
        lambda *_: stub_token,
    )
    monkeypatch.setattr(
        "app.modules.auth.infrastructure.joserfc_token_verifier.jwt.JWTClaimsRegistry",
        FakeJWTClaimsRegistry,
    )

    with pytest.raises(InvalidTokenException, match="invalid issuer"):
        await verifier.verify("bearer-token")


@pytest.mark.asyncio
async def test_verify_rejects_wrong_audience_when_expected_audience_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    verifier = JoserfcTokenVerifier(
        metadata_provider=StubMetadataProvider(),
        expected_audience="kanai-api",
    )
    stub_token = StubToken(
        {
            "sub": "user-1",
            "iss": "https://issuer.test",
            "exp": 1_893_456_000,
            "aud": "other-api",
        }
    )

    class FakeJWTClaimsRegistry:
        def __init__(self, **kwargs: dict[str, object]) -> None:
            assert kwargs["aud"] == {"essential": True, "value": "kanai-api"}

        def validate(self, claims: dict[str, object]) -> None:
            if claims["aud"] != "kanai-api":
                raise JoseError("invalid audience")

    monkeypatch.setattr(
        "app.modules.auth.infrastructure.joserfc_token_verifier.KeySet.import_key_set",
        lambda _: {"imported": True},
    )
    monkeypatch.setattr(
        "app.modules.auth.infrastructure.joserfc_token_verifier.jwt.decode",
        lambda *_: stub_token,
    )
    monkeypatch.setattr(
        "app.modules.auth.infrastructure.joserfc_token_verifier.jwt.JWTClaimsRegistry",
        FakeJWTClaimsRegistry,
    )

    with pytest.raises(InvalidTokenException, match="invalid audience"):
        await verifier.verify("bearer-token")


@pytest.mark.asyncio
async def test_verify_maps_malformed_decoded_claims_to_invalid_token_exception(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    verifier = JoserfcTokenVerifier(metadata_provider=StubMetadataProvider())
    stub_token = StubToken(
        {
            "sub": "user-1",
            "iss": "https://issuer.test",
            "exp": "not-a-timestamp",
        }
    )

    class FakeJWTClaimsRegistry:
        def __init__(self, **kwargs: dict[str, object]) -> None:
            del kwargs

        def validate(self, claims: dict[str, object]) -> None:
            del claims

    monkeypatch.setattr(
        "app.modules.auth.infrastructure.joserfc_token_verifier.KeySet.import_key_set",
        lambda _: {"imported": True},
    )
    monkeypatch.setattr(
        "app.modules.auth.infrastructure.joserfc_token_verifier.jwt.decode",
        lambda *_: stub_token,
    )
    monkeypatch.setattr(
        "app.modules.auth.infrastructure.joserfc_token_verifier.jwt.JWTClaimsRegistry",
        FakeJWTClaimsRegistry,
    )

    with pytest.raises(InvalidTokenException):
        await verifier.verify("bearer-token")


@pytest.mark.asyncio
async def test_verify_maps_malformed_jwks_to_authentication_service_exception(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    verifier = JoserfcTokenVerifier(metadata_provider=StubMetadataProvider())

    def fake_import_key_set(_: dict[str, object]) -> object:
        raise ValueError("bad jwks")

    monkeypatch.setattr(
        "app.modules.auth.infrastructure.joserfc_token_verifier.KeySet.import_key_set",
        fake_import_key_set,
    )

    with pytest.raises(
        AuthenticationServiceException,
        match="Failed to construct JWT key set",
    ):
        await verifier.verify("bearer-token")


@pytest.mark.asyncio
async def test_verify_maps_realistic_key_import_failure_to_authentication_service_exception(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    verifier = JoserfcTokenVerifier(metadata_provider=StubMetadataProvider())

    def fake_import_key_set(_: dict[str, object]) -> object:
        raise KeyError("keys")

    monkeypatch.setattr(
        "app.modules.auth.infrastructure.joserfc_token_verifier.KeySet.import_key_set",
        fake_import_key_set,
    )

    with pytest.raises(
        AuthenticationServiceException,
        match="Failed to construct JWT key set",
    ):
        await verifier.verify("bearer-token")
