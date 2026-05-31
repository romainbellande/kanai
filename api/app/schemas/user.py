"""User API schemas."""

from uuid import UUID

from pydantic import BaseModel


class UserRead(BaseModel):
    """Response payload for a user."""

    id: UUID | str
    first_name: str | None = None
    last_name: str | None = None
