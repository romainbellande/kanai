from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.core.logging as custom_logging
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.security import AuthMiddleware
from app.db.session import create_db_and_tables
from app.services.auth_service import build_request_auth_boundary
from app.services.redis_service import redis_service
from app.services.seeder_service import seed_reference_data

custom_logging.init()

request_auth_boundary = build_request_auth_boundary(
    settings=settings,
    redis_service=redis_service,
)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None]:
    await create_db_and_tables()
    await seed_reference_data()
    yield
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
