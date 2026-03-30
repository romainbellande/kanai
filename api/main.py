from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

import app.logger as customLogger
from app.config import settings
from app.modules.auth.application.authenticate_request import AuthenticateRequest
from app.modules.auth.infrastructure.joserfc_token_verifier import (
    JoserfcTokenVerifier,
)
from app.modules.auth.infrastructure.oidc_metadata_provider import OidcMetadataProvider
from app.modules.auth.infrastructure.redis_session_repository import (
    RedisSessionRepository,
)
from app.modules.auth.interface.auth_middleware import AuthMiddleware
from app.modules.user.user_router import user_router
from app.services.database_service import create_db_and_tables
from app.services.redis_service import redis_service

customLogger.init()

authenticate_request = AuthenticateRequest(
    repository=RedisSessionRepository(redis_service),
    token_verifier=JoserfcTokenVerifier(
        OidcMetadataProvider(settings.auth.discovery_endpoint),
        expected_audience=settings.auth.audience,
    ),
)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None]:
    await create_db_and_tables()
    yield
    await redis_service.aclose()


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    AuthMiddleware,
    authenticate_request=authenticate_request,
    whitelist_paths={"/docs", "/docs/oauth2-redirect", "/openapi.json", "/redoc"},
)

app.include_router(user_router)
