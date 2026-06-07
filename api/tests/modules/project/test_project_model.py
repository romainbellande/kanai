from collections.abc import AsyncIterator
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy import UniqueConstraint, Uuid, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

from app.models.project import Project, ProjectColumn, ProjectMember, ProjectOwner
from app.models.task import Task
from app.models.user import User
from app.services.project_service import create_project


@pytest_asyncio.fixture
async def session(tmp_path: Path) -> AsyncIterator[AsyncSession]:
    database_path = tmp_path / "project_model.sqlite3"
    engine = create_async_engine(f"sqlite+aiosqlite:///{database_path}")
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)

    async with session_factory() as session:
        yield session

    await engine.dispose()


def test_project_model_uses_expected_columns() -> None:
    columns = SQLModel.metadata.tables["projects"].c

    assert Project.__tablename__ == "projects"
    assert isinstance(columns.id.type, Uuid)
    assert columns.name.nullable is False
    assert columns.code.nullable is False
    assert columns.code.unique is True
    assert columns.priority.nullable is False
    assert columns.description.nullable is True
    assert columns.status.nullable is True
    assert columns.created_at.nullable is False
    assert columns.updated_at.nullable is False


def test_project_owners_and_members_are_separate_tables() -> None:
    owner_columns = SQLModel.metadata.tables["project_owners"].c
    member_columns = SQLModel.metadata.tables["project_members"].c

    assert ProjectOwner.__tablename__ == "project_owners"
    assert ProjectMember.__tablename__ == "project_members"
    assert owner_columns.project_id.primary_key is True
    assert owner_columns.user_id.primary_key is True
    assert member_columns.project_id.primary_key is True
    assert member_columns.user_id.primary_key is True


def test_project_column_model_uses_expected_columns() -> None:
    columns = SQLModel.metadata.tables["project_columns"].c
    constraints = SQLModel.metadata.tables["project_columns"].constraints

    assert ProjectColumn.__tablename__ == "project_columns"
    assert isinstance(columns.id.type, Uuid)
    assert columns.project_id.nullable is False
    assert columns.name.nullable is False
    assert columns.description.nullable is True
    assert columns.position.nullable is False
    assert columns.created_at.nullable is False
    assert columns.updated_at.nullable is False
    assert {"project_id", "name"} in [
        {column.name for column in constraint.columns}
        for constraint in constraints
        if isinstance(constraint, UniqueConstraint)
    ]


def test_task_model_uses_client_fields_without_due_columns() -> None:
    columns = SQLModel.metadata.tables["tasks"].c

    assert Task.__tablename__ == "tasks"
    assert isinstance(columns.id.type, Uuid)
    assert columns.project_id.nullable is False
    assert columns.column_id.nullable is False
    assert columns.title.nullable is False
    assert "status" not in columns
    assert columns.priority.nullable is False
    assert columns.task_rank.nullable is False
    assert "rank" not in columns
    assert columns.assignee_id.nullable is True
    assert columns.description.nullable is True
    assert columns.acceptance_criteria.nullable is True
    assert columns.tag.nullable is True
    assert "due_label" not in columns
    assert "due_date" not in columns


@pytest.mark.asyncio
async def test_project_code_is_globally_unique(session: AsyncSession) -> None:
    session.add(Project(name="First", code="ONE", priority="medium"))
    session.add(Project(name="Second", code="ONE", priority="high"))

    with pytest.raises(IntegrityError):
        await session.commit()


@pytest.mark.asyncio
async def test_project_column_names_are_unique_within_project(
    session: AsyncSession,
) -> None:
    project = Project(name="First", code="ONE", priority="medium")
    session.add(project)
    await session.commit()
    await session.refresh(project)

    assert project.id is not None

    session.add_all(
        [
            ProjectColumn(project_id=project.id, name="Review", position=0),
            ProjectColumn(project_id=project.id, name="Review", position=1),
        ]
    )

    with pytest.raises(IntegrityError):
        await session.commit()


@pytest.mark.asyncio
async def test_project_column_names_can_repeat_across_projects(
    session: AsyncSession,
) -> None:
    first_project = Project(name="First", code="ONE", priority="medium")
    second_project = Project(name="Second", code="TWO", priority="high")
    session.add_all([first_project, second_project])
    await session.commit()
    await session.refresh(first_project)
    await session.refresh(second_project)

    assert first_project.id is not None
    assert second_project.id is not None

    session.add_all(
        [
            ProjectColumn(project_id=first_project.id, name="Review", position=0),
            ProjectColumn(project_id=second_project.id, name="Review", position=0),
        ]
    )

    await session.commit()


@pytest.mark.asyncio
async def test_create_project_adds_creator_to_owners_by_default(
    session: AsyncSession,
) -> None:
    creator = User(externalId="creator")
    owner = User(externalId="owner")
    member = User(externalId="member")
    session.add_all([creator, owner, member])
    await session.commit()
    await session.refresh(creator)
    await session.refresh(owner)
    await session.refresh(member)

    assert creator.id is not None
    assert owner.id is not None
    assert member.id is not None

    project = await create_project(
        session,
        creator_user_id=creator.id,
        name="Enterprise Launch",
        code="ENT",
        priority="medium",
        owner_ids=[owner.id],
        member_ids=[member.id],
    )

    assert project.id is not None

    owners = await session.scalars(
        select(ProjectOwner).filter_by(project_id=project.id)
    )
    members = await session.scalars(
        select(ProjectMember).filter_by(project_id=project.id)
    )

    assert {project_owner.user_id for project_owner in owners.all()} == {
        creator.id,
        owner.id,
    }
    assert {project_member.user_id for project_member in members.all()} == {member.id}


@pytest.mark.asyncio
async def test_create_project_adds_default_ordered_columns(
    session: AsyncSession,
) -> None:
    creator = User(externalId="creator")
    session.add(creator)
    await session.commit()
    await session.refresh(creator)

    assert creator.id is not None

    project = await create_project(
        session,
        creator_user_id=creator.id,
        name="Enterprise Launch",
        code="ENT",
        priority="medium",
    )

    assert project.id is not None

    columns = await session.scalars(
        select(ProjectColumn)
        .filter_by(project_id=project.id)
        .order_by(SQLModel.metadata.tables["project_columns"].c.position)
    )

    assert [(column.name, column.position) for column in columns.all()] == [
        ("To Do", 0),
        ("In Progress", 1),
        ("Done", 2),
    ]
