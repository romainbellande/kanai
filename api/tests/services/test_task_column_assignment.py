"""Tests for assigning tasks to persisted project columns."""

from collections.abc import AsyncIterator
from pathlib import Path

import pytest
import pytest_asyncio
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

from app.features.tasks import TaskService
from app.models.project import Project, ProjectColumn, ProjectOwner
from app.models.task import Task
from app.models.user import User
from app.schemas.task import TaskCreate, TaskUpdate
from app.services.project_column_service import ProjectColumnService


@pytest_asyncio.fixture
async def session_factory(
    tmp_path: Path,
) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    database_path = tmp_path / "task_column_assignment.sqlite3"
    engine = create_async_engine(f"sqlite+aiosqlite:///{database_path}")
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)

    yield factory

    await engine.dispose()


@pytest.mark.asyncio
async def test_create_task_defaults_to_first_project_column(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with session_factory() as session:
        owner = User(externalId="owner")
        project = Project(name="Board", code="BRD", priority="medium")
        session.add_all([owner, project])
        await session.commit()
        await session.refresh(owner)
        await session.refresh(project)
        assert owner.id is not None
        assert project.id is not None
        first_column = ProjectColumn(project_id=project.id, name="Backlog", position=0)
        second_column = ProjectColumn(project_id=project.id, name="Done", position=1)
        session.add_all(
            [
                ProjectOwner(project_id=project.id, user_id=owner.id),
                first_column,
                second_column,
            ]
        )
        await session.commit()
        await session.refresh(first_column)
        assert first_column.id is not None

        created = await TaskService(session).create(
            project_id=project.id,
            user_id=owner.id,
            payload=TaskCreate(title="Plan launch"),
        )

        assert created.column_id == first_column.id
        assert "status" not in created.model_dump()
        persisted = await session.get(Task, created.id)
        assert persisted is not None
        assert persisted.column_id == first_column.id


@pytest.mark.asyncio
async def test_create_task_accepts_project_column(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with session_factory() as session:
        owner = User(externalId="owner")
        project = Project(name="Board", code="BRD", priority="medium")
        session.add_all([owner, project])
        await session.commit()
        await session.refresh(owner)
        await session.refresh(project)
        assert owner.id is not None
        assert project.id is not None
        first_column = ProjectColumn(project_id=project.id, name="Backlog", position=0)
        second_column = ProjectColumn(project_id=project.id, name="Review", position=1)
        session.add_all(
            [
                ProjectOwner(project_id=project.id, user_id=owner.id),
                first_column,
                second_column,
            ]
        )
        await session.commit()
        await session.refresh(second_column)
        assert second_column.id is not None

        created = await TaskService(session).create(
            project_id=project.id,
            user_id=owner.id,
            payload=TaskCreate(title="Review launch", column_id=second_column.id),
        )

        assert created.column_id == second_column.id
        assert "status" not in created.model_dump()


@pytest.mark.asyncio
async def test_create_task_rejects_foreign_project_column(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with session_factory() as session:
        owner = User(externalId="owner")
        project = Project(name="Board", code="BRD", priority="medium")
        other_project = Project(name="Other", code="OTH", priority="medium")
        session.add_all([owner, project, other_project])
        await session.commit()
        await session.refresh(owner)
        await session.refresh(project)
        await session.refresh(other_project)
        assert owner.id is not None
        assert project.id is not None
        assert other_project.id is not None
        project_column = ProjectColumn(
            project_id=project.id, name="Backlog", position=0
        )
        foreign_column = ProjectColumn(
            project_id=other_project.id, name="Foreign", position=0
        )
        session.add_all(
            [
                ProjectOwner(project_id=project.id, user_id=owner.id),
                project_column,
                foreign_column,
            ]
        )
        await session.commit()
        await session.refresh(foreign_column)
        assert foreign_column.id is not None

        with pytest.raises(HTTPException) as error:
            await TaskService(session).create(
                project_id=project.id,
                user_id=owner.id,
                payload=TaskCreate(title="Invalid", column_id=foreign_column.id),
            )

        assert error.value.status_code == 422


@pytest.mark.asyncio
async def test_update_task_moves_to_project_column(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with session_factory() as session:
        owner = User(externalId="owner")
        project = Project(name="Board", code="BRD", priority="medium")
        session.add_all([owner, project])
        await session.commit()
        await session.refresh(owner)
        await session.refresh(project)
        assert owner.id is not None
        assert project.id is not None
        first_column = ProjectColumn(project_id=project.id, name="Backlog", position=0)
        second_column = ProjectColumn(project_id=project.id, name="Review", position=1)
        session.add_all(
            [
                ProjectOwner(project_id=project.id, user_id=owner.id),
                first_column,
                second_column,
            ]
        )
        await session.commit()
        await session.refresh(first_column)
        await session.refresh(second_column)
        assert first_column.id is not None
        assert second_column.id is not None
        task = Task(
            project_id=project.id,
            column_id=first_column.id,
            title="Move me",
            priority="medium",
            rank="U",
        )
        session.add(task)
        await session.commit()
        await session.refresh(task)
        assert task.id is not None

        updated = await TaskService(session).update(
            project_id=project.id,
            task_id=task.id,
            user_id=owner.id,
            payload=TaskUpdate(column_id=second_column.id),
        )

        assert updated.column_id == second_column.id
        assert "status" not in updated.model_dump()

        listed = await TaskService(session).list(
            project_id=project.id,
            user_id=owner.id,
        )
        assert [task.column_id for task in listed] == [second_column.id]
        assert "status" not in listed[0].model_dump()

        fetched = await TaskService(session).get(
            project_id=project.id,
            task_id=task.id,
            user_id=owner.id,
        )
        assert fetched.column_id == second_column.id
        assert "status" not in fetched.model_dump()


def test_task_api_payloads_reject_legacy_status() -> None:
    with pytest.raises(ValidationError):
        TaskCreate.model_validate({"title": "Legacy", "status": "done"})

    with pytest.raises(ValidationError):
        TaskUpdate.model_validate({"status": "done"})


@pytest.mark.asyncio
async def test_update_task_rejects_foreign_project_column(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with session_factory() as session:
        owner = User(externalId="owner")
        project = Project(name="Board", code="BRD", priority="medium")
        other_project = Project(name="Other", code="OTH", priority="medium")
        session.add_all([owner, project, other_project])
        await session.commit()
        await session.refresh(owner)
        await session.refresh(project)
        await session.refresh(other_project)
        assert owner.id is not None
        assert project.id is not None
        assert other_project.id is not None
        project_column = ProjectColumn(
            project_id=project.id, name="Backlog", position=0
        )
        foreign_column = ProjectColumn(
            project_id=other_project.id, name="Foreign", position=0
        )
        session.add_all(
            [
                ProjectOwner(project_id=project.id, user_id=owner.id),
                project_column,
                foreign_column,
            ]
        )
        await session.commit()
        await session.refresh(project_column)
        await session.refresh(foreign_column)
        assert project_column.id is not None
        assert foreign_column.id is not None
        task = Task(
            project_id=project.id,
            column_id=project_column.id,
            title="Move me",
            priority="medium",
            rank="U",
        )
        session.add(task)
        await session.commit()
        await session.refresh(task)
        assert task.id is not None

        with pytest.raises(HTTPException) as error:
            await TaskService(session).update(
                project_id=project.id,
                task_id=task.id,
                user_id=owner.id,
                payload=TaskUpdate(column_id=foreign_column.id),
            )

        assert error.value.status_code == 422


@pytest.mark.asyncio
async def test_delete_project_column_rejects_non_empty_column(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with session_factory() as session:
        owner = User(externalId="owner")
        project = Project(name="Board", code="BRD", priority="medium")
        session.add_all([owner, project])
        await session.commit()
        await session.refresh(owner)
        await session.refresh(project)
        assert owner.id is not None
        assert project.id is not None
        first_column = ProjectColumn(project_id=project.id, name="Backlog", position=0)
        second_column = ProjectColumn(project_id=project.id, name="Done", position=1)
        session.add_all(
            [
                ProjectOwner(project_id=project.id, user_id=owner.id),
                first_column,
                second_column,
            ]
        )
        await session.commit()
        await session.refresh(first_column)
        assert first_column.id is not None
        task = Task(
            project_id=project.id,
            column_id=first_column.id,
            title="Blocks deletion",
            priority="medium",
            rank="U",
        )
        session.add(task)
        await session.commit()

        with pytest.raises(HTTPException) as error:
            await ProjectColumnService(session).delete(
                project.id,
                first_column.id,
                owner.id,
            )

        assert error.value.status_code == 409
        assert await session.get(ProjectColumn, first_column.id) is not None
