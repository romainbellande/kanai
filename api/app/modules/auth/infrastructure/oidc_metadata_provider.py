"""Fetch and cache OpenID Connect provider metadata."""

from copy import deepcopy

from cachetools import TTLCache
import httpx

from app.modules.auth.domain.exceptions import AuthenticationServiceException


class OidcMetadataProvider:
    """Provides cached access to OIDC discovery and JWKS metadata."""

    def __init__(self, discovery_endpoint: str) -> None:
        """Initialize the metadata provider.

        Args:
            discovery_endpoint: URL for the OIDC discovery document.
        """
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
        """Return the OIDC discovery document.

        Returns:
            A copy of the cached or fetched discovery document.

        Raises:
            AuthenticationServiceException: If the discovery document cannot be
                fetched or is malformed.
        """
        cached_document = self._discovery_cache.get(self.discovery_endpoint)
        if cached_document is not None:
            return deepcopy(cached_document)

        discovery_document = await self._fetch_json(self.discovery_endpoint)
        self._discovery_cache[self.discovery_endpoint] = deepcopy(discovery_document)
        return deepcopy(discovery_document)

    async def get_jwks(self) -> dict[str, object]:
        """Return the JSON Web Key Set for the OIDC provider.

        Returns:
            A copy of the cached or fetched JWKS payload.

        Raises:
            AuthenticationServiceException: If the discovery document does not
                include a JWKS URI or the JWKS payload is malformed.
        """
        discovery_document = await self.get_discovery_document()
        jwks_uri = discovery_document.get("jwks_uri")

        if not isinstance(jwks_uri, str) or not jwks_uri:
            raise AuthenticationServiceException(
                "OIDC discovery document is missing jwks_uri"
            )

        cached_jwks = self._jwks_cache.get(jwks_uri)
        if cached_jwks is not None:
            return deepcopy(cached_jwks)

        jwks = await self._fetch_json(jwks_uri)
        if not isinstance(jwks.get("keys"), list):
            raise AuthenticationServiceException("Malformed JWKS payload")

        self._jwks_cache[jwks_uri] = deepcopy(jwks)
        return deepcopy(jwks)

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
