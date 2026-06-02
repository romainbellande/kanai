"""Project API routes."""

from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DatabaseSession
from app.api.v1.endpoints.tasks import task_router
from app.schemas.project import ProjectCreate, ProjectMemberCreate, ProjectRead, ProjectUpdate
from app.services.project_service import (
    add_project_member_for_user,
    create_project_for_user,
    delete_project_for_user,
    list_projects_for_user,
    project_to_read,
    require_current_user_id,
    require_project_access,
    update_project_for_user,
)


project_router = APIRouter(prefix="/projects", tags=["projects"])
project_router.include_router(task_router)


@project_router.post(
    "", response_model=ProjectRead, status_code=status.HTTP_201_CREATED
)
async def create_project_endpoint(
    payload: ProjectCreate,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> ProjectRead:
    """Create a project for the current user."""
    return await create_project_for_user(
        session,
        creator_user_id=require_current_user_id(current_user.id),
        name=payload.name,
        code=payload.code,
        priority=payload.priority,
        description=payload.description,
        status_value=payload.status,
        owner_ids=payload.owner_ids,
        member_ids=payload.member_ids,
    )


@project_router.get("", response_model=list[ProjectRead])
async def list_projects(
    session: DatabaseSession,
    current_user: CurrentUser,
) -> list[ProjectRead]:
    """List projects accessible to the current user."""
    return await list_projects_for_user(
        session,
        require_current_user_id(current_user.id),
    )


@project_router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> ProjectRead:
    """Get a project accessible to the current user."""
    project = await require_project_access(
        session,
        project_id,
        require_current_user_id(current_user.id),
    )
    return await project_to_read(session, project)


@project_router.post("/{project_id}/members", response_model=ProjectRead)
async def add_project_member(
    project_id: UUID,
    payload: ProjectMemberCreate,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> ProjectRead:
    """Add a member to a project owned by the current user."""
    return await add_project_member_for_user(
        session,
        project_id=project_id,
        user_id=require_current_user_id(current_user.id),
        member_user_id=payload.user_id,
    )


@project_router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> ProjectRead:
    """Update a project owned by the current user."""
    return await update_project_for_user(
        session,
        project_id=project_id,
        user_id=require_current_user_id(current_user.id),
        payload=payload,
    )


@project_router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> None:
    """Delete a project owned by the current user."""
    await delete_project_for_user(
        session,
        project_id=project_id,
        user_id=require_current_user_id(current_user.id),
    )
