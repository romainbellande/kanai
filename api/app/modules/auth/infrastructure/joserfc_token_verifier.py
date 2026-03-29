from __future__ import annotations

from datetime import UTC, datetime

from joserfc import jwt
from joserfc.errors import JoseError
from joserfc.jwk import KeySet

from app.modules.auth.application.dto import AuthenticatedContext
from app.modules.auth.domain.exceptions import AuthenticationServiceException
from app.modules.auth.domain.exceptions import InvalidTokenException
from app.modules.auth.domain.session import Session
from app.modules.auth.infrastructure.oidc_metadata_provider import OidcMetadataProvider


class JoserfcTokenVerifier:
    def __init__(
        self,
        metadata_provider: OidcMetadataProvider,
        expected_audience: str | None = None,
    ) -> None:
        self.metadata_provider = metadata_provider
        self.expected_audience = expected_audience

    async def verify(self, bearer_token: str) -> AuthenticatedContext:
        discovery_document = await self.metadata_provider.get_discovery_document()
        jwks = await self.metadata_provider.get_jwks()

        try:
            key_set = KeySet.import_key_set(jwks)
        except Exception as error:
            raise AuthenticationServiceException(
                "Failed to construct JWT key set",
                original_error=error,
            ) from error

        try:
            token = jwt.decode(bearer_token, key_set)
            claims_registry = jwt.JWTClaimsRegistry(
                **self._claim_options(discovery_document)
            )
            claims_registry.validate(token.claims)
        except JoseError as error:
            raise InvalidTokenException(str(error), original_error=error) from error

        try:
            session = Session(
                subject=str(token.claims["sub"]),
                issuer=str(token.claims["iss"]),
                expires_at=datetime.fromtimestamp(token.claims["exp"], tz=UTC),
                audience=token.claims.get("aud"),
                claims=token.claims,
            )
        except (KeyError, OSError, OverflowError, TypeError, ValueError) as error:
            raise InvalidTokenException(
                "Token claims are malformed",
                original_error=error,
            ) from error

        return AuthenticatedContext.from_session(session)

    def _claim_options(
        self,
        discovery_document: dict[str, object],
    ) -> dict[str, dict[str, object]]:
        issuer = discovery_document.get("issuer")
        if not isinstance(issuer, str) or not issuer:
            raise AuthenticationServiceException(
                "OIDC discovery document is missing issuer"
            )

        options: dict[str, dict[str, object]] = {
            "exp": {"essential": True},
            "iss": {"essential": True, "value": issuer},
            "sub": {"essential": True},
        }
        if self.expected_audience is not None:
            options["aud"] = {"essential": True, "value": self.expected_audience}

        return options
