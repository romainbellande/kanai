"""Service functions for task workflows."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.repositories.task_repository import TaskRepository
from app.schemas.task import TaskCreate, TaskRead, TaskUpdate
from app.services.project_service import require_project_access, validate_user_ids


def task_to_read(task: Task) -> TaskRead:
    """Convert a task ORM model into an API response schema."""
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


async def create_task(
    session: AsyncSession,
    *,
    project_id: UUID,
    user_id: UUID,
    payload: TaskCreate,
) -> TaskRead:
    """Create a task in a project accessible to a user."""
    await require_project_access(session, project_id, user_id)
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
    return task_to_read(await TaskRepository(session).create(task))


async def list_tasks(
    session: AsyncSession,
    *,
    project_id: UUID,
    user_id: UUID,
) -> list[TaskRead]:
    """List tasks for a project accessible to a user."""
    await require_project_access(session, project_id, user_id)
    tasks = await TaskRepository(session).list_by_project(project_id)
    return [task_to_read(task) for task in tasks]


async def get_task(
    session: AsyncSession,
    *,
    project_id: UUID,
    task_id: UUID,
    user_id: UUID,
) -> TaskRead:
    """Get a single task from a project accessible to a user."""
    await require_project_access(session, project_id, user_id)
    task = await TaskRepository(session).get_by_project(project_id, task_id)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )
    return task_to_read(task)


async def update_task(
    session: AsyncSession,
    *,
    project_id: UUID,
    task_id: UUID,
    user_id: UUID,
    payload: TaskUpdate,
) -> TaskRead:
    """Update a task in a project accessible to a user."""
    await require_project_access(session, project_id, user_id)
    repository = TaskRepository(session)
    task = await repository.get_by_project(project_id, task_id)
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

    return task_to_read(await repository.update(task))


async def delete_task(
    session: AsyncSession,
    *,
    project_id: UUID,
    task_id: UUID,
    user_id: UUID,
) -> None:
    """Delete a task from a project accessible to a user."""
    await require_project_access(session, project_id, user_id)
    repository = TaskRepository(session)
    task = await repository.get_by_project(project_id, task_id)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )
    await repository.delete(task)
