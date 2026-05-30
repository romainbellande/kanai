"""Project API routes and response conversion helpers."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.project.project_dependencies import (
    CurrentUser,
    DatabaseSession,
    get_project_or_404,
    require_project_access,
    require_project_owner,
    validate_user_ids,
)
from app.modules.project.project_model import Project, ProjectMember, ProjectOwner, Task
from app.modules.project.project_schema import ProjectCreate, ProjectRead, ProjectUpdate
from app.modules.project.project_service import create_project
from app.modules.project.task_router import task_router


project_router = APIRouter(prefix="/projects", tags=["projects"])
project_router.include_router(task_router)


async def project_to_read(session: AsyncSession, project: Project) -> ProjectRead:
    """Convert a project model into its API response schema.

    Args:
        session: Database session used to load project owners and members.
        project: Project model to convert.

    Returns:
        API response schema containing project details and related user IDs.

    Raises:
        RuntimeError: If the project does not have an ID.
    """

    if project.id is None:
        raise RuntimeError("Project ID is missing")

    owners = await session.scalars(
        select(ProjectOwner).filter_by(project_id=project.id)
    )
    members = await session.scalars(
        select(ProjectMember).filter_by(project_id=project.id)
    )

    return ProjectRead(
        id=project.id,
        name=project.name,
        code=project.code,
        priority=project.priority,
        description=project.description,
        status=project.status,
        owner_ids=[owner.user_id for owner in owners.all()],
        member_ids=[member.user_id for member in members.all()],
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


async def replace_project_users(
    session: AsyncSession,
    project_id: UUID,
    creator_user_id: UUID,
    owner_ids: list[UUID] | None,
    member_ids: list[UUID] | None,
) -> None:
    """Replace owner and member associations for a project.

    Args:
        session: Database session used to validate users and persist changes.
        project_id: Project whose user associations should be replaced.
        creator_user_id: User ID that must remain a project owner.
        owner_ids: Replacement owner IDs, or `None` to leave owners unchanged.
        member_ids: Replacement member IDs, or `None` to leave members unchanged.
    """

    if owner_ids is not None:
        await validate_user_ids(session, set(owner_ids) | {creator_user_id})
        owners = await session.scalars(
            select(ProjectOwner).filter_by(project_id=project_id)
        )
        for owner in owners.all():
            await session.delete(owner)
        for owner_id in set(owner_ids) | {creator_user_id}:
            session.add(ProjectOwner(project_id=project_id, user_id=owner_id))

    if member_ids is not None:
        await validate_user_ids(session, set(member_ids))
        members = await session.scalars(
            select(ProjectMember).filter_by(project_id=project_id)
        )
        for member in members.all():
            await session.delete(member)
        for member_id in set(member_ids):
            session.add(ProjectMember(project_id=project_id, user_id=member_id))


@project_router.post(
    "", response_model=ProjectRead, status_code=status.HTTP_201_CREATED
)
async def create_project_endpoint(
    payload: ProjectCreate,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> ProjectRead:
    """Create a project for the current user.

    Args:
        payload: Project creation request data.
        session: Database session used to create and load the project.
        current_user: Authenticated user creating the project.

    Returns:
        Created project response data.

    Raises:
        HTTPException: If the current user ID is missing or the project code
            already exists.
    """

    if current_user.id is None:
        raise HTTPException(status_code=500, detail="Current user ID is missing")

    await validate_user_ids(
        session,
        set(payload.owner_ids) | set(payload.member_ids) | {current_user.id},
    )

    try:
        project = await create_project(
            session,
            creator_user_id=current_user.id,
            name=payload.name,
            code=payload.code,
            priority=payload.priority,
            description=payload.description,
            status=payload.status,
            owner_ids=payload.owner_ids,
            member_ids=payload.member_ids,
        )
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Project code already exists",
        ) from error

    return await project_to_read(session, project)


@project_router.get("", response_model=list[ProjectRead])
async def list_projects(
    session: DatabaseSession,
    current_user: CurrentUser,
) -> list[ProjectRead]:
    """List projects accessible to the current user.

    Args:
        session: Database session used to query project memberships.
        current_user: Authenticated user whose projects should be listed.

    Returns:
        Project response data for projects the user owns or belongs to.

    Raises:
        HTTPException: If the current user ID is missing.
    """

    if current_user.id is None:
        raise HTTPException(status_code=500, detail="Current user ID is missing")

    owner_rows = await session.scalars(
        select(ProjectOwner).filter_by(user_id=current_user.id)
    )
    member_rows = await session.scalars(
        select(ProjectMember).filter_by(user_id=current_user.id)
    )
    project_ids = {
        *(owner.project_id for owner in owner_rows.all()),
        *(member.project_id for member in member_rows.all()),
    }

    projects = [
        await get_project_or_404(session, project_id) for project_id in project_ids
    ]
    return [await project_to_read(session, project) for project in projects]


@project_router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> ProjectRead:
    """Get a project accessible to the current user.

    Args:
        project_id: ID of the project to retrieve.
        session: Database session used to load the project.
        current_user: Authenticated user requesting the project.

    Returns:
        Project response data.

    Raises:
        HTTPException: If the current user ID is missing or access is denied.
    """

    if current_user.id is None:
        raise HTTPException(status_code=500, detail="Current user ID is missing")

    project = await require_project_access(session, project_id, current_user.id)
    return await project_to_read(session, project)


@project_router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> ProjectRead:
    """Update a project owned by the current user.

    Args:
        project_id: ID of the project to update.
        payload: Project update request data.
        session: Database session used to persist changes.
        current_user: Authenticated user updating the project.

    Returns:
        Updated project response data.

    Raises:
        HTTPException: If the current user ID is missing, ownership is denied,
            or the project code already exists.
    """

    if current_user.id is None:
        raise HTTPException(status_code=500, detail="Current user ID is missing")

    project = await require_project_owner(session, project_id, current_user.id)

    for field_name in ("name", "code", "priority", "description", "status"):
        value = getattr(payload, field_name)
        if value is not None:
            setattr(project, field_name, value)

    await replace_project_users(
        session,
        project_id,
        current_user.id,
        payload.owner_ids,
        payload.member_ids,
    )

    try:
        await session.commit()
        await session.refresh(project)
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Project code already exists",
        ) from error

    return await project_to_read(session, project)


@project_router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    session: DatabaseSession,
    current_user: CurrentUser,
) -> None:
    """Delete a project owned by the current user.

    Args:
        project_id: ID of the project to delete.
        session: Database session used to delete the project and related rows.
        current_user: Authenticated user deleting the project.

    Raises:
        HTTPException: If the current user ID is missing or ownership is denied.
    """

    if current_user.id is None:
        raise HTTPException(status_code=500, detail="Current user ID is missing")

    project = await require_project_owner(session, project_id, current_user.id)
    tasks = await session.scalars(select(Task).filter_by(project_id=project_id))
    owners = await session.scalars(
        select(ProjectOwner).filter_by(project_id=project_id)
    )
    members = await session.scalars(
        select(ProjectMember).filter_by(project_id=project_id)
    )

    for task in tasks.all():
        await session.delete(task)
    for owner in owners.all():
        await session.delete(owner)
    for member in members.all():
        await session.delete(member)

    await session.delete(project)
    await session.commit()
