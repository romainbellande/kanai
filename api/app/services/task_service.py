"""Service functions for task workflows."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.repositories.task_repository import TaskRepository
from app.schemas.task import TaskCreate, TaskRead, TaskUpdate
from app.services.project_access import ProjectAccess


RANK_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
DEFAULT_TASK_RANK = "U"


def rank_between(before: str | None, after: str | None) -> str:
    """Return a lexicographic rank strictly between neighboring ranks."""
    if before is not None and after is not None and before >= after:
        raise ValueError("before rank must sort before after rank")

    base = len(RANK_ALPHABET)
    prefix = ""
    index = 0

    while True:
        before_digit = (
            RANK_ALPHABET.index(before[index])
            if before is not None and index < len(before)
            else 0
        )
        after_digit = (
            RANK_ALPHABET.index(after[index])
            if after is not None and index < len(after)
            else base - 1
        )

        if after_digit - before_digit > 1:
            return f"{prefix}{RANK_ALPHABET[(before_digit + after_digit) // 2]}"

        prefix = f"{prefix}{RANK_ALPHABET[before_digit]}"
        index += 1


async def next_task_rank(
    repository: TaskRepository, project_id: UUID, status_value: str
) -> str:
    """Append a task after the current end of a status column."""
    tasks = await repository.list_by_project_and_status(project_id, status_value)
    return rank_between(tasks[-1].rank, None) if tasks else DEFAULT_TASK_RANK


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
        rank=task.rank,
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
    project_access = ProjectAccess(session)
    await project_access.require_project(project_id, user_id)
    if payload.assignee_id is not None:
        await project_access.validate_users_exist({payload.assignee_id})

    repository = TaskRepository(session)
    task = Task(
        project_id=project_id,
        title=payload.title,
        status=payload.status,
        priority=payload.priority,
        rank=payload.rank
        or await next_task_rank(repository, project_id, payload.status),
        assignee_id=payload.assignee_id,
        description=payload.description,
        acceptance_criteria=payload.acceptance_criteria,
        tag=payload.tag,
    )
    return task_to_read(await repository.create(task))


async def list_tasks(
    session: AsyncSession,
    *,
    project_id: UUID,
    user_id: UUID,
) -> list[TaskRead]:
    """List tasks for a project accessible to a user."""
    await ProjectAccess(session).require_project(project_id, user_id)
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
    await ProjectAccess(session).require_project(project_id, user_id)
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
    project_access = ProjectAccess(session)
    await project_access.require_project(project_id, user_id)
    repository = TaskRepository(session)
    task = await repository.get_by_project(project_id, task_id)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )

    updates = payload.update_values()
    assignee_id = updates.get("assignee_id")
    if isinstance(assignee_id, UUID):
        await project_access.validate_users_exist({assignee_id})

    for field_name, value in updates.items():
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
    await ProjectAccess(session).require_project(project_id, user_id)
    repository = TaskRepository(session)
    task = await repository.get_by_project(project_id, task_id)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )
    await repository.delete(task)
