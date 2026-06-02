"""Pydantic schemas for project API request and response payloads."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    """Defines the payload for creating a project.

    Attributes:
        name: Project display name.
        code: Three-character project code using uppercase letters or digits.
        priority: Project priority label.
        description: Optional project description. Defaults to None.
        status: Optional project status label. Defaults to None.
        owner_ids: User IDs assigned as project owners. Defaults to an empty list.
        member_ids: User IDs assigned as project members. Defaults to an empty list.
    """

    name: str
    code: str = Field(min_length=3, max_length=3, pattern=r"^[A-Z0-9]{3}$")
    priority: str
    description: str | None = None
    status: str | None = None
    owner_ids: list[UUID] = Field(default_factory=list)
    member_ids: list[UUID] = Field(default_factory=list)


class ProjectUpdate(BaseModel):
    """Defines the payload for updating a project.

    Attributes:
        name: Optional updated project display name. Defaults to None.
        code: Optional updated three-character project code using uppercase letters
            or digits. Defaults to None.
        priority: Optional updated project priority label. Defaults to None.
        description: Optional updated project description. Defaults to None.
        status: Optional updated project status label. Defaults to None.
        owner_ids: Optional replacement list of owner user IDs. Defaults to None.
        member_ids: Optional replacement list of member user IDs. Defaults to None.
    """

    name: str | None = None
    code: str | None = Field(
        default=None, min_length=3, max_length=3, pattern=r"^[A-Z0-9]{3}$"
    )
    priority: str | None = None
    description: str | None = None
    status: str | None = None
    owner_ids: list[UUID] | None = None
    member_ids: list[UUID] | None = None


class ProjectRead(BaseModel):
    """Defines the project response payload.

    Attributes:
        id: Project identifier.
        name: Project display name.
        code: Three-character project code.
        priority: Project priority label.
        description: Optional project description.
        status: Optional project status label.
        owner_ids: User IDs assigned as project owners.
        member_ids: User IDs assigned as project members.
        created_at: Optional timestamp when the project was created.
        updated_at: Optional timestamp when the project was last updated.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    code: str
    priority: str
    description: str | None
    status: str | None
    owner_ids: list[UUID]
    member_ids: list[UUID]
    created_at: datetime | None
    updated_at: datetime | None


class ProjectMemberCreate(BaseModel):
    """Request payload for adding a project member."""

    user_id: UUID
