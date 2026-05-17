from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import app.logger as customLogger
from app.config import settings
from app.modules.auth.bootstrap import (
    build_authenticate_request,
    get_auth_whitelist_paths,
)
from app.modules.auth.interface.auth_middleware import AuthMiddleware
from app.modules.seeder.startup import seed_reference_data
from app.modules.user.user_router import user_router
from app.services.database_service import create_db_and_tables
from app.services.redis_service import redis_service

customLogger.init()

authenticate_request = build_authenticate_request(
    settings=settings,
    redis_service=redis_service,
)
auth_whitelist_paths = get_auth_whitelist_paths()


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
    authenticate_request=authenticate_request,
    whitelist_paths=auth_whitelist_paths,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(user_router)
