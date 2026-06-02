"""Tests for persisted task board movement."""

from collections.abc import AsyncIterator
from pathlib import Path

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

from app.models.project import Project, ProjectColumn, ProjectMember, ProjectOwner
from app.models.task import Task
from app.models.user import User
from app.schemas.task import TaskDestination
from app.features.tasks import TaskService


@pytest_asyncio.fixture
async def session_factory(
    tmp_path: Path,
) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    database_path = tmp_path / "task_move.sqlite3"
    engine = create_async_engine(f"sqlite+aiosqlite:///{database_path}")
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)

    yield factory

    await engine.dispose()


@pytest.mark.asyncio
async def test_move_task_persists_cross_column_top_placement(
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
        session.add(ProjectOwner(project_id=project.id, user_id=owner.id))
        todo_column = ProjectColumn(project_id=project.id, name="todo", position=0)
        done_column = ProjectColumn(project_id=project.id, name="done", position=1)
        session.add_all([todo_column, done_column])
        await session.commit()
        await session.refresh(todo_column)
        await session.refresh(done_column)
        assert todo_column.id is not None
        assert done_column.id is not None
        moved = Task(
            project_id=project.id,
            column_id=todo_column.id,
            title="Moved",
            status="todo",
            priority="medium",
            rank="U",
        )
        first_done = Task(
            project_id=project.id,
            column_id=done_column.id,
            title="First done",
            status="done",
            priority="medium",
            rank="U",
        )
        session.add_all([moved, first_done])
        await session.commit()
        await session.refresh(moved)
        await session.refresh(first_done)
        assert moved.id is not None
        assert first_done.id is not None

        updated = await TaskService(session).move(
            project_id=project.id,
            task_id=moved.id,
            user_id=owner.id,
            destination=TaskDestination(
                column_id=done_column.id,
                before_task_id=None,
                after_task_id=first_done.id,
            ),
        )

        assert updated.column_id == done_column.id
        assert updated.rank < first_done.rank
        persisted = await session.get(Task, moved.id)
        assert persisted is not None
        assert persisted.column_id == done_column.id
        assert persisted.rank == updated.rank


@pytest.mark.asyncio
async def test_move_task_allows_member_access_and_preserves_noop_rank(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with session_factory() as session:
        owner = User(externalId="owner")
        member = User(externalId="member")
        project = Project(name="Board", code="BRD", priority="medium")
        session.add_all([owner, member, project])
        await session.commit()
        await session.refresh(owner)
        await session.refresh(member)
        await session.refresh(project)
        assert owner.id is not None
        assert member.id is not None
        assert project.id is not None
        session.add_all(
            [
                ProjectOwner(project_id=project.id, user_id=owner.id),
                ProjectMember(project_id=project.id, user_id=member.id),
            ]
        )
        todo_column = ProjectColumn(project_id=project.id, name="todo", position=0)
        session.add(todo_column)
        await session.commit()
        await session.refresh(todo_column)
        assert todo_column.id is not None
        moved = Task(
            project_id=project.id,
            column_id=todo_column.id,
            title="Moved",
            status="todo",
            priority="medium",
            rank="U",
        )
        after = Task(
            project_id=project.id,
            column_id=todo_column.id,
            title="After",
            status="todo",
            priority="medium",
            rank="j",
        )
        session.add_all([moved, after])
        await session.commit()
        await session.refresh(moved)
        await session.refresh(after)
        assert moved.id is not None
        assert after.id is not None

        updated = await TaskService(session).move(
            project_id=project.id,
            task_id=moved.id,
            user_id=member.id,
            destination=TaskDestination(
                column_id=todo_column.id,
                before_task_id=None,
                after_task_id=after.id,
            ),
        )

        assert updated.column_id == todo_column.id
        assert updated.rank == "U"


@pytest.mark.asyncio
async def test_move_task_persists_within_column_bottom_placement(
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
        session.add(ProjectOwner(project_id=project.id, user_id=owner.id))
        todo_column = ProjectColumn(project_id=project.id, name="todo", position=0)
        session.add(todo_column)
        await session.commit()
        await session.refresh(todo_column)
        assert todo_column.id is not None
        first = Task(
            project_id=project.id,
            column_id=todo_column.id,
            title="First",
            status="todo",
            priority="medium",
            rank="U",
        )
        moved = Task(
            project_id=project.id,
            column_id=todo_column.id,
            title="Moved",
            status="todo",
            priority="medium",
            rank="j",
        )
        last = Task(
            project_id=project.id,
            column_id=todo_column.id,
            title="Last",
            status="todo",
            priority="medium",
            rank="z",
        )
        session.add_all([first, moved, last])
        await session.commit()
        await session.refresh(moved)
        await session.refresh(last)
        assert moved.id is not None
        assert last.id is not None

        updated = await TaskService(session).move(
            project_id=project.id,
            task_id=moved.id,
            user_id=owner.id,
            destination=TaskDestination(
                column_id=todo_column.id,
                before_task_id=last.id,
                after_task_id=None,
            ),
        )

        assert updated.column_id == todo_column.id
        assert updated.rank > last.rank


@pytest.mark.asyncio
async def test_move_task_denies_users_without_project_access(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with session_factory() as session:
        owner = User(externalId="owner")
        outsider = User(externalId="outsider")
        project = Project(name="Board", code="BRD", priority="medium")
        session.add_all([owner, outsider, project])
        await session.commit()
        await session.refresh(owner)
        await session.refresh(outsider)
        await session.refresh(project)
        assert owner.id is not None
        assert outsider.id is not None
        assert project.id is not None
        session.add(ProjectOwner(project_id=project.id, user_id=owner.id))
        todo_column = ProjectColumn(project_id=project.id, name="todo", position=0)
        session.add(todo_column)
        await session.commit()
        await session.refresh(todo_column)
        assert todo_column.id is not None
        task = Task(
            project_id=project.id,
            column_id=todo_column.id,
            title="Moved",
            status="todo",
            priority="medium",
            rank="U",
        )
        session.add(task)
        await session.commit()
        await session.refresh(task)
        assert task.id is not None

        with pytest.raises(HTTPException) as error:
            await TaskService(session).move(
                project_id=project.id,
                task_id=task.id,
                user_id=outsider.id,
                destination=TaskDestination(column_id=todo_column.id),
            )

        assert error.value.status_code == 404
