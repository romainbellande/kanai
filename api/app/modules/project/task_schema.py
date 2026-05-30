"""Schemas for project task request and response payloads."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TaskCreate(BaseModel):
    """Request payload for creating a project task.

    Parameters:
        title: Task title.
        status: Workflow status for the task. Defaults to "todo".
        priority: Priority level for the task. Defaults to "medium".
        assignee_id: Optional user ID assigned to the task.
        description: Optional task details.
        acceptance_criteria: Optional criteria required to complete the task.
        tag: Optional task tag.
    """

    title: str
    status: str = "todo"
    priority: str = "medium"
    assignee_id: UUID | None = None
    description: str | None = None
    acceptance_criteria: str | None = None
    tag: str | None = None


class TaskUpdate(BaseModel):
    """Request payload for updating a project task.

    Parameters:
        title: Optional replacement task title.
        status: Optional replacement workflow status.
        priority: Optional replacement priority level.
        assignee_id: Optional replacement user ID assigned to the task.
        description: Optional replacement task details.
        acceptance_criteria: Optional replacement completion criteria.
        tag: Optional replacement task tag.
    """

    title: str | None = None
    status: str | None = None
    priority: str | None = None
    assignee_id: UUID | None = None
    description: str | None = None
    acceptance_criteria: str | None = None
    tag: str | None = None


class TaskRead(BaseModel):
    """Response payload for reading a project task.

    Parameters:
        id: Task ID.
        project_id: ID of the project that owns the task.
        title: Task title.
        status: Workflow status for the task.
        priority: Priority level for the task.
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
    title: str
    status: str
    priority: str
    assignee_id: UUID | None
    description: str | None
    acceptance_criteria: str | None
    tag: str | None
    created_at: datetime | None
    updated_at: datetime | None
