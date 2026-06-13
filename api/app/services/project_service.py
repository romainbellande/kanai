"""Service functions for project workflows."""

from collections.abc import Iterable
from typing import cast
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.repositories.project_repository import ProjectRepository
from app.repositories.task_repository import TaskRepository
from app.schemas.project import (
    DEFAULT_PROJECT_STATUS,
    ProjectRead,
    ProjectStatus,
    ProjectUpdate,
)
from app.services.project_access import ProjectAccess, ProjectRole
from app.services.project_column_service import ProjectColumnService


LEGACY_PROJECT_PRIORITY = "medium"
VALID_PROJECT_STATUSES = {"active", "paused", "blocked", "done"}


def project_status_to_read(status_value: str | None) -> ProjectStatus:
    """Normalize persisted project status to the public fixed lifecycle set."""
    normalized_status = status_value.strip().lower() if status_value else ""
    if normalized_status in VALID_PROJECT_STATUSES:
        return cast("ProjectStatus", normalized_status)
    return DEFAULT_PROJECT_STATUS


def require_current_user_id(user_id: UUID | None) -> UUID:
    """Return a current user ID or raise an internal server error."""
    if user_id is None:
        raise HTTPException(status_code=500, detail="Current user ID is missing")
    return user_id


async def validate_user_ids(session: AsyncSession, user_ids: set[UUID]) -> None:
    """Validate that every user ID exists."""
    await ProjectAccess(session).validate_users_exist(user_ids)


async def get_project_or_404(session: AsyncSession, project_id: UUID) -> Project:
    """Load a project or raise a not found response."""
    project = await ProjectRepository(session).get(project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


async def require_project_access(
    session: AsyncSession,
    project_id: UUID,
    user_id: UUID,
) -> Project:
    """Require a user to have owner or member access to a project."""
    return await ProjectAccess(session).require_project(project_id, user_id)


async def require_project_owner(
    session: AsyncSession,
    project_id: UUID,
    user_id: UUID,
) -> Project:
    """Require a user to own a project."""
    return await ProjectAccess(session).require_project(
        project_id, user_id, role=ProjectRole.OWNER
    )


async def project_to_read(session: AsyncSession, project: Project) -> ProjectRead:
    """Convert a project model into its API response schema."""
    if project.id is None:
        raise RuntimeError("Project ID is missing")

    repository = ProjectRepository(session)
    owners = await repository.list_owner_rows_by_project(project.id)
    members = await repository.list_member_rows_by_project(project.id)

    return ProjectRead(
        id=project.id,
        name=project.name,
        code=project.code,
        description=project.description,
        status=project_status_to_read(project.status),
        owner_ids=[owner.user_id for owner in owners],
        member_ids=[member.user_id for member in members],
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


async def create_project(
    session: AsyncSession,
    *,
    creator_user_id: UUID,
    name: str,
    code: str,
    description: str | None = None,
    status: str = DEFAULT_PROJECT_STATUS,
    owner_ids: Iterable[UUID] = (),
    member_ids: Iterable[UUID] = (),
) -> Project:
    """Create a project with owners and members."""
    repository = ProjectRepository(session)
    project = Project(
        name=name,
        code=code,
        priority=LEGACY_PROJECT_PRIORITY,
        description=description,
        status=status,
    )
    await repository.add(project)

    if project.id is None:
        raise RuntimeError("Project ID was not generated")

    for owner_user_id in {creator_user_id, *owner_ids}:
        repository.add_owner(project.id, owner_user_id)
    for member_user_id in set(member_ids):
        repository.add_member(project.id, member_user_id)
    ProjectColumnService(session).add_default_columns(project.id)

    await repository.commit()
    await repository.refresh(project)
    return project


async def create_project_for_user(
    session: AsyncSession,
    *,
    creator_user_id: UUID,
    name: str,
    code: str,
    description: str | None = None,
    status_value: str = DEFAULT_PROJECT_STATUS,
    owner_ids: Iterable[UUID] = (),
    member_ids: Iterable[UUID] = (),
) -> ProjectRead:
    """Validate and create a project response for a user."""
    await validate_user_ids(
        session, set(owner_ids) | set(member_ids) | {creator_user_id}
    )
    try:
        project = await create_project(
            session,
            creator_user_id=creator_user_id,
            name=name,
            code=code,
            description=description,
            status=status_value,
            owner_ids=owner_ids,
            member_ids=member_ids,
        )
    except IntegrityError as error:
        await ProjectRepository(session).rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Project code already exists",
        ) from error
    return await project_to_read(session, project)


async def list_projects_for_user(
    session: AsyncSession, user_id: UUID
) -> list[ProjectRead]:
    """List projects accessible to a user."""
    repository = ProjectRepository(session)
    owner_rows = await repository.list_owner_rows_by_user(user_id)
    member_rows = await repository.list_member_rows_by_user(user_id)
    project_ids = {
        *(owner.project_id for owner in owner_rows),
        *(member.project_id for member in member_rows),
    }
    projects = [
        await get_project_or_404(session, project_id) for project_id in project_ids
    ]
    return [await project_to_read(session, project) for project in projects]


async def replace_project_users(
    session: AsyncSession,
    project_id: UUID,
    creator_user_id: UUID,
    owner_ids: list[UUID] | None,
    member_ids: list[UUID] | None,
) -> None:
    """Replace owner and member associations for a project."""
    await ProjectAccess(session).replace_membership(
        project_id,
        acting_user_id=creator_user_id,
        owner_ids=set(owner_ids) if owner_ids is not None else None,
        member_ids=set(member_ids) if member_ids is not None else None,
    )


async def update_project_for_user(
    session: AsyncSession,
    *,
    project_id: UUID,
    user_id: UUID,
    payload: ProjectUpdate,
) -> ProjectRead:
    """Update a project owned by a user."""
    repository = ProjectRepository(session)
    project = await require_project_owner(session, project_id, user_id)
    for field_name, value in payload.update_values().items():
        if field_name not in {"name", "code", "description", "status"}:
            continue
        setattr(project, field_name, value)

    await ProjectAccess(session).replace_membership(
        project_id,
        acting_user_id=user_id,
        owner_ids=set(payload.owner_ids) if payload.owner_ids is not None else None,
        member_ids=set(payload.member_ids) if payload.member_ids is not None else None,
    )
    try:
        await repository.commit()
        await repository.refresh(project)
    except IntegrityError as error:
        await repository.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Project code already exists",
        ) from error
    return await project_to_read(session, project)


async def delete_project_for_user(
    session: AsyncSession,
    *,
    project_id: UUID,
    user_id: UUID,
) -> None:
    """Delete a project owned by a user."""
    project_repository = ProjectRepository(session)
    task_repository = TaskRepository(session)
    project = await require_project_owner(session, project_id, user_id)
    await task_repository.delete_by_project(project_id)
    await project_repository.delete_sprints(project_id)
    await project_repository.delete_chat_messages(project_id)
    await project_repository.delete_relationships(project_id)
    await project_repository.delete(project)
    await project_repository.commit()


async def add_project_member_for_user(
    session: AsyncSession,
    *,
    project_id: UUID,
    user_id: UUID,
    member_user_id: UUID,
) -> ProjectRead:
    """Add a member to a project owned by a user."""
    project_repository = ProjectRepository(session)
    project = await require_project_owner(session, project_id, user_id)
    await validate_user_ids(session, {member_user_id})

    if await project_repository.get_member(project_id, member_user_id) is None:
        project_repository.add_member(project_id, member_user_id)
        await project_repository.commit()

    return await project_to_read(session, project)
