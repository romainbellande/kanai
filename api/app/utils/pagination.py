"""Pagination helpers for API endpoints."""

from pydantic import BaseModel, Field


class PageParams(BaseModel):
    """Common pagination parameters."""

    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
