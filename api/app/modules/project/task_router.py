"""Task API routes for project-scoped task management."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.modules.project.project_dependencies import (
    CurrentUser,
    DatabaseSession,
    require_project_access,
    validate_user_ids,
)
from app.modules.project.project_model import Task
from app.modules.project.task_schema import TaskCreate, TaskRead, TaskUpdate


task_router = APIRouter(prefix="/{project_id}/tasks", tags=["tasks"])


def task_to_read(task: Task) -> TaskRead:
    """Convert a task ORM model into an API response schema.

    Args:
        task: Task model to convert.

    Returns:
        Task response schema for the provided model.

    Raises:
        RuntimeError: If the task has not been persisted with an ID.
    """

    if task.id is None:
        raise RuntimeError("Task ID is missing")

    return TaskRead(
        id=task.id,
        project_id=task.project_id,
        title=task.title,
        status=task.status,
        priority=task.priority,
        assignee_id=task.assignee_id,
        description=task.description,
        acceptance_criteria=task.acceptance_criteria,
        tag=task.tag,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


@task_router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(
    project_id: UUID,
    payload: TaskCreate,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> TaskRead:
    """Create a task in a project accessible to the current user.

    Args:
        project_id: ID of the project that will contain the task.
        payload: Task creation data from the request body.
        session: Database session for persistence.
        current_user: Authenticated user making the request.

    Returns:
        Created task response data.

    Raises:
        HTTPException: If the current user ID is missing, project access is denied,
            or the assignee does not exist.
    """

    if current_user.id is None:
        raise HTTPException(status_code=500, detail="Current user ID is missing")

    await require_project_access(session, project_id, current_user.id)
    if payload.assignee_id is not None:
        await validate_user_ids(session, {payload.assignee_id})

    task = Task(
        project_id=project_id,
        title=payload.title,
        status=payload.status,
        priority=payload.priority,
        assignee_id=payload.assignee_id,
        description=payload.description,
        acceptance_criteria=payload.acceptance_criteria,
        tag=payload.tag,
    )
    session.add(task)
    await session.commit()
    await session.refresh(task)

    return task_to_read(task)


@task_router.get("", response_model=list[TaskRead])
async def list_tasks(
    project_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> list[TaskRead]:
    """List tasks for a project accessible to the current user.

    Args:
        project_id: ID of the project whose tasks are requested.
        session: Database session for reading tasks.
        current_user: Authenticated user making the request.

    Returns:
        Task response data for all tasks in the project.

    Raises:
        HTTPException: If the current user ID is missing or project access is denied.
    """

    if current_user.id is None:
        raise HTTPException(status_code=500, detail="Current user ID is missing")

    await require_project_access(session, project_id, current_user.id)
    tasks = await session.scalars(select(Task).filter_by(project_id=project_id))

    return [task_to_read(task) for task in tasks.all()]


@task_router.get("/{task_id}", response_model=TaskRead)
async def get_task(
    project_id: UUID,
    task_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> TaskRead:
    """Get a single task from a project accessible to the current user.

    Args:
        project_id: ID of the project containing the task.
        task_id: ID of the task to retrieve.
        session: Database session for reading the task.
        current_user: Authenticated user making the request.

    Returns:
        Requested task response data.

    Raises:
        HTTPException: If the current user ID is missing, project access is denied,
            or the task does not exist in the project.
    """

    if current_user.id is None:
        raise HTTPException(status_code=500, detail="Current user ID is missing")

    await require_project_access(session, project_id, current_user.id)
    task = await session.scalar(
        select(Task).filter_by(id=task_id, project_id=project_id)
    )
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )

    return task_to_read(task)


@task_router.patch("/{task_id}", response_model=TaskRead)
async def update_task(
    project_id: UUID,
    task_id: UUID,
    payload: TaskUpdate,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> TaskRead:
    """Update a task in a project accessible to the current user.

    Args:
        project_id: ID of the project containing the task.
        task_id: ID of the task to update.
        payload: Partial task update data from the request body.
        session: Database session for persistence.
        current_user: Authenticated user making the request.

    Returns:
        Updated task response data.

    Raises:
        HTTPException: If the current user ID is missing, project access is denied,
            the task does not exist in the project, or the assignee does not exist.
    """

    if current_user.id is None:
        raise HTTPException(status_code=500, detail="Current user ID is missing")

    await require_project_access(session, project_id, current_user.id)
    task = await session.scalar(
        select(Task).filter_by(id=task_id, project_id=project_id)
    )
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )

    if payload.assignee_id is not None:
        await validate_user_ids(session, {payload.assignee_id})

    for field_name in (
        "title",
        "status",
        "priority",
        "assignee_id",
        "description",
        "acceptance_criteria",
        "tag",
    ):
        value = getattr(payload, field_name)
        if value is not None:
            setattr(task, field_name, value)

    await session.commit()
    await session.refresh(task)

    return task_to_read(task)


@task_router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    project_id: UUID,
    task_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> None:
    """Delete a task from a project accessible to the current user.

    Args:
        project_id: ID of the project containing the task.
        task_id: ID of the task to delete.
        session: Database session for persistence.
        current_user: Authenticated user making the request.

    Raises:
        HTTPException: If the current user ID is missing, project access is denied,
            or the task does not exist in the project.
    """

    if current_user.id is None:
        raise HTTPException(status_code=500, detail="Current user ID is missing")

    await require_project_access(session, project_id, current_user.id)
    task = await session.scalar(
        select(Task).filter_by(id=task_id, project_id=project_id)
    )
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )

    await session.delete(task)
    await session.commit()
