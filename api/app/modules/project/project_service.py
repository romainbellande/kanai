"""Service functions for project persistence."""

from collections.abc import Iterable
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.project.project_model import Project, ProjectMember, ProjectOwner


async def create_project(
    session: AsyncSession,
    *,
    creator_user_id: UUID,
    name: str,
    code: str,
    priority: str,
    description: str | None = None,
    status: str | None = None,
    owner_ids: Iterable[UUID] = (),
    member_ids: Iterable[UUID] = (),
) -> Project:
    """Create a project with owners and members.

    Args:
        session: Database session used to persist the project.
        creator_user_id: User ID to add as an owner of the project.
        name: Project display name.
        code: Unique project code.
        priority: Project priority value.
        description: Optional project description.
        status: Optional project status value.
        owner_ids: Additional user IDs to add as project owners.
        member_ids: User IDs to add as project members.

    Returns:
        The created and refreshed project.
    """
    project = Project(
        name=name,
        code=code,
        priority=priority,
        description=description,
        status=status,
    )
    session.add(project)
    await session.flush()

    if project.id is None:
        raise RuntimeError("Project ID was not generated")

    owner_user_ids = {creator_user_id, *owner_ids}
    for owner_user_id in owner_user_ids:
        session.add(ProjectOwner(project_id=project.id, user_id=owner_user_id))

    for member_user_id in set(member_ids):
        session.add(ProjectMember(project_id=project.id, user_id=member_user_id))

    await session.commit()
    await session.refresh(project)

    return project
