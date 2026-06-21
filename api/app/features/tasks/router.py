"""Task API routes for project-scoped task management."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser, DatabaseSession
from app.schemas.task import TaskCreate, TaskDestination, TaskRead, TaskUpdate


task_router = APIRouter(prefix="/{project_id}/tasks", tags=["tasks"])


def _require_current_user_id(user_id: UUID | None) -> UUID:
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user is missing a database id",
        )
    return user_id


@task_router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task_endpoint(
    project_id: UUID,
    payload: TaskCreate,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> TaskRead:
    """Create a task in a project accessible to the current user."""
    from app.features.tasks import TaskService

    return await TaskService(session).create(
        project_id=project_id,
        user_id=_require_current_user_id(current_user.id),
        payload=payload,
    )


@task_router.get("", response_model=list[TaskRead])
async def list_tasks_endpoint(
    project_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
    title: str | None = Query(default=None),
    limit: int | None = Query(default=None, ge=1, le=50),
    exclude_task_id: UUID | None = Query(default=None),
) -> list[TaskRead]:
    """List tasks for a project accessible to the current user."""
    from app.features.tasks import TaskService

    return await TaskService(session).list(
        project_id=project_id,
        user_id=_require_current_user_id(current_user.id),
        title=title,
        limit=limit,
        exclude_task_id=exclude_task_id,
    )


@task_router.get("/active-sprint", response_model=list[TaskRead])
async def list_active_sprint_tasks_endpoint(
    project_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> list[TaskRead]:
    """List tasks selected into the project's active sprint."""
    from app.features.tasks import TaskService

    return await TaskService(session).list_active_sprint(
        project_id=project_id,
        user_id=_require_current_user_id(current_user.id),
    )


@task_router.get("/{task_id}", response_model=TaskRead)
async def get_task_endpoint(
    project_id: UUID,
    task_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> TaskRead:
    """Get a single task from a project accessible to the current user."""
    from app.features.tasks import TaskService

    return await TaskService(session).get(
        project_id=project_id,
        task_id=task_id,
        user_id=_require_current_user_id(current_user.id),
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
    from app.features.tasks import TaskService

    return await TaskService(session).update(
        project_id=project_id,
        task_id=task_id,
        user_id=_require_current_user_id(current_user.id),
        payload=payload,
    )


@task_router.put("/{task_id}/move", response_model=TaskRead)
async def move_task_endpoint(
    project_id: UUID,
    task_id: UUID,
    payload: TaskDestination,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> TaskRead:
    """Move a task to a board destination accessible to the current user."""
    from app.features.tasks import TaskService

    return await TaskService(session).move(
        project_id=project_id,
        task_id=task_id,
        user_id=_require_current_user_id(current_user.id),
        destination=payload,
    )


@task_router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task_endpoint(
    project_id: UUID,
    task_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> None:
    """Delete a task from a project accessible to the current user."""
    from app.features.tasks import TaskService

    await TaskService(session).delete(
        project_id=project_id,
        task_id=task_id,
        user_id=_require_current_user_id(current_user.id),
    )
