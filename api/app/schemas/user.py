"""User API schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UserCreate(BaseModel):
    """Request payload for creating a user."""

    external_id: str = Field(min_length=1, max_length=255)


class UserUpdate(BaseModel):
    """Request payload for updating a user."""

    external_id: str | None = Field(default=None, min_length=1, max_length=255)


class UserRead(BaseModel):
    """Response payload for a user."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    external_id: str
    first_name: str | None = None
    last_name: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
