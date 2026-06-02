"""Schemas for project task request and response payloads."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


NULLABLE_UPDATE_FIELD = "nullable_update_field"


class TaskCreate(BaseModel):
    """Request payload for creating a project task.

    Parameters:
        title: Task title.
        column_id: Optional workflow column ID. Defaults to the first project column.
        status: Legacy workflow status for the task. Defaults to "todo".
        priority: Priority level for the task. Defaults to "medium".
        rank: Optional sortable LexoRank-style position. If omitted, appends to status.
        assignee_id: Optional user ID assigned to the task.
        description: Optional task details.
        acceptance_criteria: Optional criteria required to complete the task.
        tag: Optional task tag.
    """

    title: str
    column_id: UUID | None = None
    status: str = "todo"
    priority: str = "medium"
    rank: str | None = None
    assignee_id: UUID | None = None
    description: str | None = None
    acceptance_criteria: str | None = None
    tag: str | None = None


class TaskUpdate(BaseModel):
    """Request payload for updating a project task.

    Parameters:
        title: Optional replacement task title.
        column_id: Optional replacement workflow column ID.
        status: Optional replacement legacy workflow status.
        priority: Optional replacement priority level.
        rank: Optional replacement sortable LexoRank-style position.
        assignee_id: Optional replacement user ID assigned to the task.
        description: Optional replacement task details.
        acceptance_criteria: Optional replacement completion criteria.
        tag: Optional replacement task tag.
    """

    title: str | None = None
    column_id: UUID | None = None
    status: str | None = None
    priority: str | None = None
    rank: str | None = None
    assignee_id: UUID | None = Field(
        default=None,
        json_schema_extra={NULLABLE_UPDATE_FIELD: True},
    )
    description: str | None = Field(
        default=None,
        json_schema_extra={NULLABLE_UPDATE_FIELD: True},
    )
    acceptance_criteria: str | None = Field(
        default=None,
        json_schema_extra={NULLABLE_UPDATE_FIELD: True},
    )
    tag: str | None = Field(
        default=None,
        json_schema_extra={NULLABLE_UPDATE_FIELD: True},
    )

    @model_validator(mode="before")
    @classmethod
    def reject_null_required_fields(cls, data: Any) -> Any:
        """Allow omitted required fields for PATCH, but reject explicit nulls."""
        if not isinstance(data, dict):
            return data

        for field_name, field in cls.model_fields.items():
            field_extra = field.json_schema_extra
            is_nullable_update = isinstance(field_extra, dict) and field_extra.get(
                NULLABLE_UPDATE_FIELD, False
            )
            if (
                not is_nullable_update
                and field_name in data
                and data[field_name] is None
            ):
                raise ValueError(f"{field_name} cannot be null")

        return data

    def update_values(self) -> dict[str, object]:
        """Return fields submitted by the client, preserving explicit nulls."""
        return self.model_dump(exclude_unset=True)


class TaskDestination(BaseModel):
    """Destination for moving a task on the project board."""

    status: str
    before_task_id: UUID | None = None
    after_task_id: UUID | None = None


class TaskRead(BaseModel):
    """Response payload for reading a project task.

    Parameters:
        id: Task ID.
        project_id: ID of the project that owns the task.
        title: Task title.
        column_id: Workflow column ID for the task.
        status: Legacy workflow status for the task.
        priority: Priority level for the task.
        rank: Sortable LexoRank-style position within the task status column.
        assignee_id: Optional user ID assigned to the task.
        description: Optional task details.
        acceptance_criteria: Optional criteria required to complete the task.
        tag: Optional task tag.
        created_at: Optional timestamp when the task was created.
        updated_at: Optional timestamp when the task was last updated.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    column_id: UUID
    title: str
    status: str
    priority: str
    rank: str
    assignee_id: UUID | None
    description: str | None
    acceptance_criteria: str | None
    tag: str | None
    created_at: datetime | None
    updated_at: datetime | None
