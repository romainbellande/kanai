from cachetools import TTLCache
import httpx

from app.modules.auth.domain.exceptions import AuthenticationServiceException


class OidcMetadataProvider:
    def __init__(self, discovery_endpoint: str) -> None:
        self.discovery_endpoint = discovery_endpoint
        self._discovery_cache: TTLCache[str, dict[str, object]] = TTLCache(
            maxsize=1024,
            ttl=3600,
        )
        self._jwks_cache: TTLCache[str, dict[str, object]] = TTLCache(
            maxsize=1024,
            ttl=3600,
        )

    async def get_discovery_document(self) -> dict[str, object]:
        cached_document = self._discovery_cache.get(self.discovery_endpoint)
        if cached_document is not None:
            return cached_document

        discovery_document = await self._fetch_json(self.discovery_endpoint)
        self._discovery_cache[self.discovery_endpoint] = discovery_document
        return discovery_document

    async def get_jwks(self) -> dict[str, object]:
        discovery_document = await self.get_discovery_document()
        jwks_uri = discovery_document.get("jwks_uri")

        if not isinstance(jwks_uri, str) or not jwks_uri:
            raise AuthenticationServiceException(
                "OIDC discovery document is missing jwks_uri"
            )

        cached_jwks = self._jwks_cache.get(jwks_uri)
        if cached_jwks is not None:
            return cached_jwks

        jwks = await self._fetch_json(jwks_uri)
        if not isinstance(jwks.get("keys"), list):
            raise AuthenticationServiceException("Malformed JWKS payload")

        self._jwks_cache[jwks_uri] = jwks
        return jwks

    async def _fetch_json(self, url: str) -> dict[str, object]:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url)
                response.raise_for_status()
                payload = response.json()
        except (ValueError, httpx.HTTPError) as error:
            raise AuthenticationServiceException(
                f"Failed to fetch OIDC metadata from {url}",
                original_error=error,
            ) from error

        if not isinstance(payload, dict):
            raise AuthenticationServiceException(
                f"Malformed OIDC metadata payload from {url}"
            )

        return payload
