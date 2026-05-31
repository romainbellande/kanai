import httpx
import pytest
from pytest_httpx import HTTPXMock

from app.core.exceptions import AuthenticationServiceException
from app.integrations.oidc_metadata_provider import OidcMetadataProvider


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


@pytest.mark.asyncio
async def test_cached_metadata_is_not_shared_mutable_state(
    httpx_mock: HTTPXMock,
) -> None:
    provider = OidcMetadataProvider(DISCOVERY_ENDPOINT)

    httpx_mock.add_response(
        url=DISCOVERY_ENDPOINT,
        json={"issuer": "https://issuer.test", "jwks_uri": JWKS_URI},
    )
    httpx_mock.add_response(
        url=JWKS_URI,
        json={"keys": [{"kid": "kid-1", "kty": "RSA"}]},
    )

    discovery_document = await provider.get_discovery_document()
    jwks = await provider.get_jwks()

    discovery_document["issuer"] = "https://mutated.test"
    cast_keys = jwks["keys"]
    assert isinstance(cast_keys, list)
    cast_keys.append({"kid": "kid-2", "kty": "EC"})

    assert await provider.get_discovery_document() == {
        "issuer": "https://issuer.test",
        "jwks_uri": JWKS_URI,
    }
    assert await provider.get_jwks() == {"keys": [{"kid": "kid-1", "kty": "RSA"}]}


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


@pytest.mark.asyncio
async def test_httpx_fetch_failure_maps_to_authentication_service_exception(
    httpx_mock: HTTPXMock,
) -> None:
    provider = OidcMetadataProvider(DISCOVERY_ENDPOINT)

    httpx_mock.add_exception(
        httpx.ConnectError("connect failed"), url=DISCOVERY_ENDPOINT
    )

    with pytest.raises(
        AuthenticationServiceException, match="Failed to fetch OIDC metadata"
    ):
        await provider.get_discovery_document()


@pytest.mark.asyncio
async def test_non_object_json_payload_maps_to_authentication_service_exception(
    httpx_mock: HTTPXMock,
) -> None:
    provider = OidcMetadataProvider(DISCOVERY_ENDPOINT)

    httpx_mock.add_response(url=DISCOVERY_ENDPOINT, json=["not", "an", "object"])

    with pytest.raises(
        AuthenticationServiceException,
        match="Malformed OIDC metadata payload",
    ):
        await provider.get_discovery_document()
