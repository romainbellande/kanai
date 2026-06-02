"""Service functions for task workflows."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.repositories.task_repository import TaskRepository
from app.schemas.task import TaskCreate, TaskDestination, TaskRead, TaskUpdate
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


async def move_task(
    session: AsyncSession,
    *,
    project_id: UUID,
    task_id: UUID,
    user_id: UUID,
    destination: TaskDestination,
) -> TaskRead:
    """Move a task to a board destination and persist its status and rank."""
    await ProjectAccess(session).require_project(project_id, user_id)
    repository = TaskRepository(session)
    task = await repository.get_by_project(project_id, task_id)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )

    ordered_destination_tasks = await repository.list_by_project_and_status(
        project_id, destination.status
    )
    if _is_same_position(task, ordered_destination_tasks, destination):
        return task_to_read(task)

    destination_tasks = [
        destination_task
        for destination_task in ordered_destination_tasks
        if destination_task.id != task_id
    ]
    before_rank = _rank_for_neighbor(
        destination_tasks, destination.before_task_id, "before_task_id"
    )
    after_rank = _rank_for_neighbor(
        destination_tasks, destination.after_task_id, "after_task_id"
    )

    if before_rank is not None and after_rank is not None and before_rank >= after_rank:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task destination neighbors are out of order",
        )

    task.status = destination.status
    task.rank = rank_between(before_rank, after_rank)
    return task_to_read(await repository.update(task))


def _rank_for_neighbor(
    tasks: list[Task], task_id: UUID | None, field_name: str
) -> str | None:
    if task_id is None:
        return None

    for task in tasks:
        if task.id == task_id:
            return task.rank

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"{field_name} not found",
    )


def _is_same_position(
    task: Task, ordered_destination_tasks: list[Task], destination: TaskDestination
) -> bool:
    if task.status != destination.status:
        return False

    task_index = next(
        (
            index
            for index, destination_task in enumerate(ordered_destination_tasks)
            if destination_task.id == task.id
        ),
        None,
    )
    if task_index is None:
        return False

    before_task_id = (
        ordered_destination_tasks[task_index - 1].id if task_index else None
    )
    after_task = (
        ordered_destination_tasks[task_index + 1]
        if task_index + 1 < len(ordered_destination_tasks)
        else None
    )
    return (
        destination.before_task_id == before_task_id
        and destination.after_task_id == (after_task.id if after_task else None)
    )


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
