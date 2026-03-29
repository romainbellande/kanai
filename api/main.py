from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

import app.logger as customLogger
from app.modules.user.user_router import user_router
from app.services.database_service import create_db_and_tables
from app.services.redis_service import redis_service

customLogger.init()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None]:
    await create_db_and_tables()
    yield
    await redis_service.aclose()


app = FastAPI(lifespan=lifespan)

app.include_router(user_router)
