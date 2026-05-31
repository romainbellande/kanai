"""Authentication endpoint placeholder.

Authentication is currently enforced by middleware rather than route handlers.
"""

from fastapi import APIRouter


auth_router = APIRouter(prefix="/auth", tags=["auth"])
