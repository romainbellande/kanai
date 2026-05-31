"""Task API routes for project-scoped task management."""

from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DatabaseSession
from app.schemas.task import TaskCreate, TaskRead, TaskUpdate
from app.services.project_service import require_current_user_id
from app.services.task_service import (
    create_task,
    delete_task,
    get_task,
    list_tasks,
    update_task,
)


task_router = APIRouter(prefix="/{project_id}/tasks", tags=["tasks"])


@task_router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task_endpoint(
    project_id: UUID,
    payload: TaskCreate,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> TaskRead:
    """Create a task in a project accessible to the current user."""
    return await create_task(
        session,
        project_id=project_id,
        user_id=require_current_user_id(current_user.id),
        payload=payload,
    )


@task_router.get("", response_model=list[TaskRead])
async def list_tasks_endpoint(
    project_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> list[TaskRead]:
    """List tasks for a project accessible to the current user."""
    return await list_tasks(
        session,
        project_id=project_id,
        user_id=require_current_user_id(current_user.id),
    )


@task_router.get("/{task_id}", response_model=TaskRead)
async def get_task_endpoint(
    project_id: UUID,
    task_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> TaskRead:
    """Get a single task from a project accessible to the current user."""
    return await get_task(
        session,
        project_id=project_id,
        task_id=task_id,
        user_id=require_current_user_id(current_user.id),
    )


@task_router.patch("/{task_id}", response_model=TaskRead)
async def update_task_endpoint(
    project_id: UUID,
    task_id: UUID,
    payload: TaskUpdate,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> TaskRead:
    """Update a task in a project accessible to the current user."""
    return await update_task(
        session,
        project_id=project_id,
        task_id=task_id,
        user_id=require_current_user_id(current_user.id),
        payload=payload,
    )


@task_router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task_endpoint(
    project_id: UUID,
    task_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> None:
    """Delete a task from a project accessible to the current user."""
    await delete_task(
        session,
        project_id=project_id,
        task_id=task_id,
        user_id=require_current_user_id(current_user.id),
    )
