import pytest
from pytest_httpx import HTTPXMock

from app.modules.auth.domain.exceptions import AuthenticationServiceException
from app.modules.auth.infrastructure.oidc_metadata_provider import OidcMetadataProvider


DISCOVERY_ENDPOINT = "https://issuer.test/.well-known/openid-configuration"
JWKS_URI = "https://issuer.test/protocol/openid-connect/certs"


@pytest.mark.asyncio
async def test_discovery_and_jwks_are_fetched_once_then_served_from_cache(
    httpx_mock: HTTPXMock,
) -> None:
    provider = OidcMetadataProvider(DISCOVERY_ENDPOINT)
    discovery_document = {"issuer": "https://issuer.test", "jwks_uri": JWKS_URI}
    jwks = {"keys": [{"kid": "kid-1", "kty": "RSA"}]}

    httpx_mock.add_response(url=DISCOVERY_ENDPOINT, json=discovery_document)
    httpx_mock.add_response(url=JWKS_URI, json=jwks)

    first_discovery = await provider.get_discovery_document()
    second_discovery = await provider.get_discovery_document()
    first_jwks = await provider.get_jwks()
    second_jwks = await provider.get_jwks()

    assert first_discovery == discovery_document
    assert second_discovery == discovery_document
    assert first_jwks == jwks
    assert second_jwks == jwks
    assert len(httpx_mock.get_requests()) == 2


def test_discovery_and_jwks_caches_use_one_hour_ttl() -> None:
    provider = OidcMetadataProvider(DISCOVERY_ENDPOINT)

    assert provider._discovery_cache.ttl == 3600
    assert provider._jwks_cache.ttl == 3600


@pytest.mark.asyncio
async def test_missing_jwks_uri_raises_authentication_service_exception(
    httpx_mock: HTTPXMock,
) -> None:
    provider = OidcMetadataProvider(DISCOVERY_ENDPOINT)

    httpx_mock.add_response(
        url=DISCOVERY_ENDPOINT,
        json={"issuer": "https://issuer.test"},
    )

    with pytest.raises(AuthenticationServiceException, match="jwks_uri"):
        await provider.get_jwks()


@pytest.mark.asyncio
async def test_malformed_jwks_payload_raises_authentication_service_exception(
    httpx_mock: HTTPXMock,
) -> None:
    provider = OidcMetadataProvider(DISCOVERY_ENDPOINT)

    httpx_mock.add_response(
        url=DISCOVERY_ENDPOINT,
        json={"issuer": "https://issuer.test", "jwks_uri": JWKS_URI},
    )
    httpx_mock.add_response(url=JWKS_URI, json={"keys": "not-a-list"})

    with pytest.raises(AuthenticationServiceException, match="Malformed JWKS payload"):
        await provider.get_jwks()
