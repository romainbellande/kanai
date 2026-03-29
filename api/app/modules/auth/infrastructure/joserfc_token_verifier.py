from __future__ import annotations

from datetime import UTC, datetime

from joserfc import jwt
from joserfc.errors import JoseError
from joserfc.jwk import KeySet

from app.modules.auth.application.dto import AuthenticatedContext
from app.modules.auth.domain.exceptions import InvalidTokenException
from app.modules.auth.domain.session import Session
from app.modules.auth.infrastructure.oidc_metadata_provider import OidcMetadataProvider


class JoserfcTokenVerifier:
    def __init__(self, metadata_provider: OidcMetadataProvider) -> None:
        self.metadata_provider = metadata_provider

    async def verify(self, bearer_token: str) -> AuthenticatedContext:
        try:
            jwks = await self.metadata_provider.get_jwks()
            key_set = KeySet.import_key_set(jwks)
            token = jwt.decode(bearer_token, key_set)
            claims_registry = jwt.JWTClaimsRegistry(
                exp={"essential": True},
                iss={"essential": True},
                sub={"essential": True},
            )
            claims_registry.validate(token.claims)
        except JoseError as error:
            raise InvalidTokenException(str(error), original_error=error) from error

        session = Session(
            subject=str(token.claims["sub"]),
            issuer=str(token.claims["iss"]),
            expires_at=datetime.fromtimestamp(token.claims["exp"], tz=UTC),
            audience=token.claims.get("aud"),
            claims=token.claims,
        )
        return AuthenticatedContext.from_session(session)
