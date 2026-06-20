"""Schemas for project task request and response payloads."""

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


NULLABLE_UPDATE_FIELD = "nullable_update_field"
NO_TASK_PRIORITY = ""
LEGACY_TASK_PRIORITY = "urgent"
NORMALIZED_LEGACY_TASK_PRIORITY = "critical"
ALLOWED_STORY_POINTS = {1, 2, 3, 5, 8, 13}


def normalize_task_priority(priority: str | None) -> str | None:
    """Normalize optional task priority values for the API contract."""
    if priority is None:
        return None

    normalized_priority = priority.strip().lower()
    if normalized_priority == LEGACY_TASK_PRIORITY:
        return NORMALIZED_LEGACY_TASK_PRIORITY
    if normalized_priority == NO_TASK_PRIORITY:
        return None
    return normalized_priority


def task_priority_to_storage(priority: str | None) -> str:
    """Map the optional API priority to current non-null storage."""
    return normalize_task_priority(priority) or NO_TASK_PRIORITY


def normalize_story_points(story_points: Any) -> int | None:
    """Normalize optional Story Points while enforcing the fixed scale."""
    if story_points is None or story_points == "":
        return None
    if isinstance(story_points, str):
        story_points = int(story_points) if story_points.isdecimal() else story_points
    if isinstance(story_points, bool) or not isinstance(story_points, int):
        raise ValueError("story_points must be one of 1, 2, 3, 5, 8, or 13")
    if story_points not in ALLOWED_STORY_POINTS:
        raise ValueError("story_points must be one of 1, 2, 3, 5, 8, or 13")
    return story_points


class TaskCreate(BaseModel):
    """Request payload for creating a project task.

    Parameters:
        title: Task title.
        column_id: Optional workflow column ID. Defaults to the first project column.
        include_in_active_sprint: Whether the new task belongs to the active sprint.
        priority: Optional priority level for the task.
        story_points: Optional Story Points estimate.
        assignee_id: Optional user ID assigned to the task.
        description: Optional task details.
        acceptance_criteria: Optional criteria required to complete the task.
        tag: Optional task tag.
    """

    model_config = ConfigDict(extra="forbid")

    title: str
    column_id: UUID | None = None
    include_in_active_sprint: bool = False
    priority: str | None = None
    story_points: int | None = None
    assignee_id: UUID | None = None
    description: str | None = None
    acceptance_criteria: str | None = None
    tag: str | None = None

    @field_validator("priority")
    @classmethod
    def normalize_priority(cls, priority: str | None) -> str | None:
        """Expose legacy urgent as critical and blank values as no priority."""
        return normalize_task_priority(priority)

    @field_validator("story_points", mode="before")
    @classmethod
    def validate_story_points(cls, story_points: Any) -> int | None:
        """Allow no estimation and reject values outside the fixed scale."""
        return normalize_story_points(story_points)


class TaskUpdate(BaseModel):
    """Request payload for updating a project task.

    Parameters:
        title: Optional replacement task title.
        column_id: Optional replacement workflow column ID.
        priority: Optional replacement priority level. Explicit null clears it.
        story_points: Optional replacement Story Points estimate. Explicit null clears it.
        assignee_id: Optional replacement user ID assigned to the task.
        description: Optional replacement task details.
        acceptance_criteria: Optional replacement completion criteria.
        tag: Optional replacement task tag.
    """

    model_config = ConfigDict(extra="forbid")

    title: str | None = None
    column_id: UUID | None = None
    priority: str | None = Field(
        default=None,
        json_schema_extra={NULLABLE_UPDATE_FIELD: True},
    )
    story_points: int | None = Field(
        default=None,
        json_schema_extra={NULLABLE_UPDATE_FIELD: True},
    )
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

    @field_validator("priority")
    @classmethod
    def normalize_priority(cls, priority: str | None) -> str | None:
        """Expose legacy urgent as critical and blank values as no priority."""
        return normalize_task_priority(priority)

    @field_validator("story_points", mode="before")
    @classmethod
    def validate_story_points(cls, story_points: Any) -> int | None:
        """Allow no estimation and reject values outside the fixed scale."""
        return normalize_story_points(story_points)

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

    model_config = ConfigDict(extra="forbid")

    column_id: UUID
    before_task_id: UUID | None = None
    after_task_id: UUID | None = None


class TaskPrerequisiteRef(BaseModel):
    """Reviewed draft prerequisite reference."""

    model_config = ConfigDict(extra="forbid")

    type: Literal["draft", "existing"]
    key: str | None = None
    task_id: UUID | None = None

    @model_validator(mode="after")
    def require_matching_value(self) -> "TaskPrerequisiteRef":
        if self.type == "draft" and not (self.key and self.key.strip()):
            raise ValueError("draft prerequisite key is required")
        if self.type == "existing" and self.task_id is None:
            raise ValueError("existing prerequisite task_id is required")
        if self.type == "draft" and self.task_id is not None:
            raise ValueError("draft prerequisite cannot include task_id")
        if self.type == "existing" and self.key is not None:
            raise ValueError("existing prerequisite cannot include key")
        return self


class BacklogTaskDraftCreate(BaseModel):
    """Reviewed generated Backlog task draft."""

    model_config = ConfigDict(extra="forbid")

    key: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=200)
    priority: str | None = None
    story_points: int | None = None
    assignee_id: UUID | None = None
    description: str | None = Field(default=None, max_length=8000)
    acceptance_criteria: str | None = Field(default=None, max_length=8000)
    tag: str | None = Field(default=None, max_length=100)
    prerequisites: list[TaskPrerequisiteRef] = Field(default_factory=list, max_length=5)

    @field_validator("key", "title")
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("value cannot be blank")
        return value

    @field_validator("priority")
    @classmethod
    def normalize_priority(cls, priority: str | None) -> str | None:
        return normalize_task_priority(priority)

    @field_validator("story_points", mode="before")
    @classmethod
    def validate_story_points(cls, story_points: Any) -> int | None:
        return normalize_story_points(story_points)


class BacklogTaskBulkCreate(BaseModel):
    """Atomic reviewed draft save request."""

    model_config = ConfigDict(extra="forbid")

    tasks: list[BacklogTaskDraftCreate] = Field(min_length=1, max_length=12)

    @model_validator(mode="after")
    def reject_duplicate_keys(self) -> "BacklogTaskBulkCreate":
        keys = [task.key.casefold() for task in self.tasks]
        if len(set(keys)) != len(keys):
            raise ValueError("Task draft keys must be unique")
        return self


class TaskRead(BaseModel):
    """Response payload for reading a project task.

    Parameters:
        id: Task ID.
        project_id: ID of the project that owns the task.
        sprint_id: Optional active or historical sprint membership ID.
        title: Task title.
        column_id: Workflow column ID for the task.
        priority: Optional priority level for the task.
        story_points: Optional Story Points estimate.
        rank: Sortable LexoRank-style position within the task column.
        backlog_rank: Optional manual rank within the project backlog.
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
    sprint_id: UUID | None
    column_id: UUID
    title: str
    priority: str | None
    story_points: int | None
    rank: str
    backlog_rank: str | None
    assignee_id: UUID | None
    description: str | None
    acceptance_criteria: str | None
    tag: str | None
    created_at: datetime | None
    updated_at: datetime | None
    prerequisite_task_ids: list[UUID] = Field(default_factory=list)
