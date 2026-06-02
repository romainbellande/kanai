"""Boundary tests for project access policy behavior."""

from collections.abc import AsyncIterator
from pathlib import Path
from uuid import UUID

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

from app.models.project import Project, ProjectMember, ProjectOwner
from app.models.user import User
from app.schemas.task import TaskCreate
from app.services.project_access import ProjectAccess, ProjectRole
from app.services.task_service import create_task


@pytest_asyncio.fixture
async def session_factory(
    tmp_path: Path,
) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    database_path = tmp_path / "project_access.sqlite3"
    engine = create_async_engine(f"sqlite+aiosqlite:///{database_path}")
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)

    yield factory

    await engine.dispose()


@pytest_asyncio.fixture
async def session(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncIterator[AsyncSession]:
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def project_context(session: AsyncSession) -> dict[str, UUID]:
    owner = User(externalId="owner")
    member = User(externalId="member")
    stranger = User(externalId="stranger")
    project = Project(name="Enterprise Launch", code="ENT", priority="medium")
    session.add_all([owner, member, stranger, project])
    await session.flush()

    assert owner.id is not None
    assert member.id is not None
    assert stranger.id is not None
    assert project.id is not None

    session.add(ProjectOwner(project_id=project.id, user_id=owner.id))
    session.add(ProjectMember(project_id=project.id, user_id=member.id))
    await session.commit()

    return {
        "owner_id": owner.id,
        "member_id": member.id,
        "stranger_id": stranger.id,
        "project_id": project.id,
    }


@pytest.mark.asyncio
async def test_project_access_allows_owner_and_member(
    session: AsyncSession,
    project_context: dict[str, UUID],
) -> None:
    access = ProjectAccess(session)

    owner_project = await access.require_project(
        project_context["project_id"], project_context["owner_id"]
    )
    member_project = await access.require_project(
        project_context["project_id"], project_context["member_id"]
    )

    assert owner_project.id == project_context["project_id"]
    assert member_project.id == project_context["project_id"]


@pytest.mark.asyncio
async def test_project_access_allows_owner_role_for_owner(
    session: AsyncSession,
    project_context: dict[str, UUID],
) -> None:
    project = await ProjectAccess(session).require_project(
        project_context["project_id"],
        project_context["owner_id"],
        role=ProjectRole.OWNER,
    )

    assert project.id == project_context["project_id"]


@pytest.mark.asyncio
async def test_project_access_owner_role_rejects_member_with_masked_not_found(
    session: AsyncSession,
    project_context: dict[str, UUID],
) -> None:
    access = ProjectAccess(session)

    with pytest.raises(HTTPException) as error:
        await access.require_project(
            project_context["project_id"],
            project_context["member_id"],
            role=ProjectRole.OWNER,
        )

    assert error.value.status_code == 404
    assert error.value.detail == "Project not found"


@pytest.mark.asyncio
async def test_project_access_masks_missing_and_forbidden_projects(
    session: AsyncSession,
    project_context: dict[str, UUID],
) -> None:
    access = ProjectAccess(session)

    for project_id, user_id in (
        (project_context["project_id"], project_context["stranger_id"]),
        (UUID("00000000-0000-0000-0000-000000000000"), project_context["owner_id"]),
    ):
        with pytest.raises(HTTPException) as error:
            await access.require_project(project_id, user_id)

        assert error.value.status_code == 404
        assert error.value.detail == "Project not found"


@pytest.mark.asyncio
async def test_project_access_validates_known_and_unknown_users(
    session: AsyncSession,
    project_context: dict[str, UUID],
) -> None:
    access = ProjectAccess(session)

    await access.validate_users_exist(
        {project_context["owner_id"], project_context["member_id"]}
    )

    unknown_user_id = UUID("00000000-0000-0000-0000-000000000000")
    with pytest.raises(HTTPException) as error:
        await access.validate_users_exist(
            {project_context["owner_id"], unknown_user_id}
        )

    assert error.value.status_code == 422
    assert error.value.detail == f"Unknown user id: {unknown_user_id}"


@pytest.mark.asyncio
async def test_project_access_replaces_membership_and_preserves_acting_owner(
    session: AsyncSession,
    project_context: dict[str, UUID],
) -> None:
    replacement_owner = User(externalId="replacement-owner")
    replacement_member = User(externalId="replacement-member")
    session.add_all([replacement_owner, replacement_member])
    await session.flush()
    assert replacement_owner.id is not None
    assert replacement_member.id is not None

    await ProjectAccess(session).replace_membership(
        project_context["project_id"],
        acting_user_id=project_context["owner_id"],
        owner_ids={replacement_owner.id},
        member_ids={replacement_member.id},
    )

    await session.flush()

    owner_rows = await session.scalars(
        select(ProjectOwner).filter_by(project_id=project_context["project_id"])
    )
    member_rows = await session.scalars(
        select(ProjectMember).filter_by(project_id=project_context["project_id"])
    )

    assert {row.user_id for row in owner_rows} == {
        project_context["owner_id"],
        replacement_owner.id,
    }
    assert {row.user_id for row in member_rows} == {replacement_member.id}


@pytest.mark.asyncio
async def test_task_service_uses_project_access_for_denial(
    session: AsyncSession,
    project_context: dict[str, UUID],
) -> None:
    with pytest.raises(HTTPException) as error:
        await create_task(
            session,
            project_id=project_context["project_id"],
            user_id=project_context["stranger_id"],
            payload=TaskCreate(title="Hidden task"),
        )

    assert error.value.status_code == 404
    assert error.value.detail == "Project not found"
