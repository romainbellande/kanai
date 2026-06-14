from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.api.deps as api_deps
import app.core.logging as custom_logging
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.security import AuthMiddleware
from app.db.session import create_db_and_tables
from app.features.a2a import a2a_router
from app.services.auth_service import (
    WebSocketAuthBoundary,
    build_authenticate_request,
    build_request_auth_boundary,
)
from app.services.project_chat_fanout import project_chat_fanout
from app.services.redis_service import redis_service
from app.services.seeder_service import seed_reference_data

custom_logging.init()

request_auth_boundary = build_request_auth_boundary(
    settings=settings,
    redis_service=redis_service,
)
api_deps.websocket_auth_boundary = WebSocketAuthBoundary(
    build_authenticate_request(settings=settings, redis_service=redis_service),
)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None]:
    await create_db_and_tables()
    await seed_reference_data()
    yield
    await project_chat_fanout.aclose()
    await redis_service.aclose()


app = FastAPI(lifespan=lifespan)

origins = [settings.client_origin]

app.add_middleware(
    AuthMiddleware,
    auth_boundary=request_auth_boundary,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(api_router)
app.include_router(a2a_router)
