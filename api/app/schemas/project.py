"""Pydantic schemas for project API request and response payloads."""

from datetime import date, datetime
from uuid import UUID

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.task import TaskRead

NULLABLE_UPDATE_FIELD = "nullable_update_field"
ProjectStatus = Literal["active", "paused", "blocked", "done"]
DEFAULT_PROJECT_STATUS: ProjectStatus = "active"


class ProjectCreate(BaseModel):
    """Defines the payload for creating a project.

    Attributes:
        name: Project display name.
        code: Three-character project code using uppercase letters or digits.
        description: Optional project description. Defaults to None.
        status: Project lifecycle status. Defaults to active.
        owner_ids: User IDs assigned as project owners. Defaults to an empty list.
        member_ids: User IDs assigned as project members. Defaults to an empty list.
    """

    model_config = ConfigDict(extra="forbid")

    name: str
    code: str = Field(min_length=3, max_length=3, pattern=r"^[A-Z0-9]{3}$")
    description: str | None = None
    status: ProjectStatus = DEFAULT_PROJECT_STATUS
    owner_ids: list[UUID] = Field(default_factory=list)
    member_ids: list[UUID] = Field(default_factory=list)


class ProjectUpdate(BaseModel):
    """Defines the payload for updating a project.

    Attributes:
        name: Optional updated project display name. Defaults to None.
        code: Optional updated three-character project code using uppercase letters
            or digits. Defaults to None.
        description: Optional updated project description. Defaults to None.
        status: Optional updated project status label. Defaults to None.
        owner_ids: Optional replacement list of owner user IDs. Defaults to None.
        member_ids: Optional replacement list of member user IDs. Defaults to None.
    """

    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    code: str | None = Field(
        default=None, min_length=3, max_length=3, pattern=r"^[A-Z0-9]{3}$"
    )
    description: str | None = Field(
        default=None,
        json_schema_extra={NULLABLE_UPDATE_FIELD: True},
    )
    status: ProjectStatus | None = None
    owner_ids: list[UUID] | None = None
    member_ids: list[UUID] | None = None

    @field_validator("name")
    @classmethod
    def trim_required_name(cls, name: str | None) -> str | None:
        """Trim submitted project names and reject blank values."""
        if name is None:
            return None

        trimmed_name = name.strip()
        if trimmed_name == "":
            raise ValueError("name is required")
        return trimmed_name

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


class ProjectRead(BaseModel):
    """Defines the project response payload.

    Attributes:
        id: Project identifier.
        name: Project display name.
        code: Three-character project code.
        description: Optional project description.
        status: Project lifecycle status.
        owner_ids: User IDs assigned as project owners.
        member_ids: User IDs assigned as project members.
        created_at: Optional timestamp when the project was created.
        updated_at: Optional timestamp when the project was last updated.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    code: str
    description: str | None
    status: ProjectStatus
    owner_ids: list[UUID]
    member_ids: list[UUID]
    created_at: datetime | None
    updated_at: datetime | None


class ProjectDashboardCardEmptyStateRead(BaseModel):
    """Empty-state metadata for a dashboard chart card."""

    reason: str
    message: str


class ProjectDashboardCardEntryRead(BaseModel):
    """One chart-ready dashboard data entry."""

    label: str
    values: dict[str, int | float | str | None] = Field(default_factory=dict)


class ProjectDashboardSeriesRead(BaseModel):
    """One chart-ready dashboard series."""

    name: str
    entries: list[ProjectDashboardCardEntryRead] = Field(default_factory=list)


class ProjectDashboardCardRead(BaseModel):
    """One supported Project Dashboard chart card."""

    key: str
    title: str
    series: list[ProjectDashboardSeriesRead] = Field(default_factory=list)
    entries: list[ProjectDashboardCardEntryRead] = Field(default_factory=list)
    empty_state: ProjectDashboardCardEmptyStateRead | None = None


class ProjectDashboardRead(BaseModel):
    """Aggregated Project Dashboard payload."""

    project_id: UUID
    generated_at: datetime
    charts: list[ProjectDashboardCardRead]


class ProjectColumnRead(BaseModel):
    """Defines a project workflow column response payload."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    name: str
    description: str | None
    position: int
    created_at: datetime | None
    updated_at: datetime | None


class ProjectColumnCreate(BaseModel):
    """Request payload for creating a project workflow column."""

    name: str = Field(max_length=80)
    description: str | None = None


class ProjectColumnUpdate(BaseModel):
    """Request payload for updating a project workflow column."""

    name: str = Field(max_length=80)
    description: str | None = None


class ProjectColumnReorder(BaseModel):
    """Request payload for reordering all project workflow columns."""

    column_ids: list[UUID]


class ProjectSprintCreate(BaseModel):
    """Request payload for creating a project sprint."""

    planned_start_date: date
    planned_end_date: date
    goal: str | None = Field(default=None, max_length=4_000)
    task_ids: list[UUID] = Field(default_factory=list)

    @field_validator("goal")
    @classmethod
    def trim_blank_goal(cls, goal: str | None) -> str | None:
        """Trim sprint goals and persist blank values as absent."""
        if goal is None:
            return None

        trimmed_goal = goal.strip()
        return trimmed_goal or None


class ProjectSprintUpdate(BaseModel):
    """Request payload for updating active project sprint metadata."""

    model_config = ConfigDict(extra="forbid")

    planned_start_date: date | None = None
    planned_end_date: date | None = None
    goal: str | None = Field(
        default=None,
        max_length=4_000,
        json_schema_extra={NULLABLE_UPDATE_FIELD: True},
    )

    @field_validator("goal")
    @classmethod
    def trim_goal(cls, goal: str | None) -> str | None:
        """Trim sprint goals while preserving explicit null clears."""
        if goal is None:
            return None

        trimmed_goal = goal.strip()
        return trimmed_goal or None

    def update_values(self) -> dict[str, object]:
        """Return fields submitted by the client, preserving explicit nulls."""
        return self.model_dump(exclude_unset=True)


class ProjectSprintRead(BaseModel):
    """Defines a project sprint response payload."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    name: str
    lifecycle_state: str
    planned_start_date: date
    planned_end_date: date
    goal: str | None
    closed_at: datetime | None
    created_at: datetime | None
    updated_at: datetime | None


class ProjectSprintTaskSnapshotRead(BaseModel):
    """Historical task snapshot captured when a sprint closes."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    sprint_id: UUID
    task_id: UUID | None
    column_id: UUID
    title: str
    outcome: str
    priority: str | None
    story_points: int | None
    rank: str
    description: str | None
    acceptance_criteria: str | None
    tag: str | None
    live_task_exists: bool = False
    created_at: datetime | None


class ProjectSprintClosePreviewRead(BaseModel):
    """Confirmation payload for closing an active sprint."""

    sprint: ProjectSprintRead
    finished_count: int
    unfinished_count: int
    unfinished_tasks: list[TaskRead]
    carryover_statement: str


class ProjectSprintCloseRead(ProjectSprintClosePreviewRead):
    """Response payload after a sprint has been closed."""

    snapshots: list[ProjectSprintTaskSnapshotRead]


class ProjectSprintHistoryRead(BaseModel):
    """Closed sprint summary and historical task detail."""

    sprint: ProjectSprintRead
    finished_count: int
    unfinished_count: int
    snapshots: list[ProjectSprintTaskSnapshotRead]


class ProjectSprintTaskAdd(BaseModel):
    """Request payload for adding an existing task to the active sprint."""

    task_id: UUID


class ProjectDoneColumnRead(BaseModel):
    """Response payload for project Done Column configuration."""

    project_id: UUID
    done_column_id: UUID | None
    requires_designation: bool


class ProjectDoneColumnUpdate(BaseModel):
    """Request payload for changing a project's Done Column."""

    done_column_id: UUID


class ProjectBacklogReorder(BaseModel):
    """Request payload for rewriting project Backlog order."""

    task_ids: list[UUID]


class ProjectMemberCreate(BaseModel):
    """Request payload for adding a project member."""

    user_id: UUID


class ProjectChatAuthorRead(BaseModel):
    """Small author payload embedded in chat messages."""

    id: UUID | None
    display_name: str
    initials: str
    deleted: bool = False


class ProjectChatMessageRead(BaseModel):
    """Project chat history message response payload."""

    id: UUID
    project_id: UUID
    body: str
    created_at: datetime
    author: ProjectChatAuthorRead
