"""Version 1 API router composition."""

from fastapi import APIRouter

from app.api.v1.endpoints.auth import auth_router
from app.api.v1.endpoints.products import products_router
from app.api.v1.endpoints.projects import project_router
from app.api.v1.endpoints.users import user_router


api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(user_router)
api_router.include_router(project_router)
api_router.include_router(products_router)
