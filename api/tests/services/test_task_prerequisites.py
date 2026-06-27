"""Tests for task prerequisite persistence and search."""

from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel, col

from app.features.tasks import TaskService
from app.models.project import (
    Project,
    ProjectColumn,
    ProjectOwner,
    ProjectTaskChangeEvent,
)
from app.models.task import Task, TaskDependency
from app.models.user import User
from app.schemas.task import TaskCreate, TaskUpdate


@pytest_asyncio.fixture
async def session_factory(
    tmp_path: Path,
) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    database_path = tmp_path / "task_prerequisites.sqlite3"
    engine = create_async_engine(f"sqlite+aiosqlite:///{database_path}")
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)

    yield factory

    await engine.dispose()


async def create_board(
    session: AsyncSession,
) -> tuple[User, Project, ProjectColumn]:
    owner = User(externalId="owner")
    project = Project(name="Board", code="BRD", priority="medium")
    session.add_all([owner, project])
    await session.commit()
    await session.refresh(owner)
    await session.refresh(project)
    assert owner.id is not None
    assert project.id is not None
    column = ProjectColumn(project_id=project.id, name="Backlog", position=0)
    session.add_all([ProjectOwner(project_id=project.id, user_id=owner.id), column])
    await session.commit()
    await session.refresh(column)
    assert column.id is not None
    return owner, project, column


async def add_task(
    session: AsyncSession,
    project: Project,
    column: ProjectColumn,
    title: str,
    *,
    updated_at: datetime | None = None,
) -> Task:
    assert project.id is not None
    assert column.id is not None
    task = Task(
        project_id=project.id,
        column_id=column.id,
        title=title,
        priority="medium",
        rank=title,
        updated_at=updated_at,
        created_at=updated_at,
    )
    session.add(task)
    await session.commit()
    await session.refresh(task)
    assert task.id is not None
    return task


@pytest.mark.asyncio
async def test_create_task_persists_prerequisites(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with session_factory() as session:
        owner, project, column = await create_board(session)
        assert owner.id is not None
        assert project.id is not None
        first = await add_task(session, project, column, "First")
        second = await add_task(session, project, column, "Second")
        assert first.id is not None
        assert second.id is not None
        first_id = first.id
        second_id = second.id

        created = await TaskService(session).create(
            project_id=project.id,
            user_id=owner.id,
            payload=TaskCreate(
                title="Blocked",
                column_id=column.id,
                prerequisite_task_ids=[first_id, second_id],
            ),
        )

        assert created.prerequisite_task_ids == [first_id, second_id]
        edges = list(
            (
                await session.scalars(
                    select(TaskDependency).filter_by(dependent_task_id=created.id)
                )
            ).all()
        )
        assert {edge.prerequisite_task_id for edge in edges} == {first_id, second_id}


@pytest.mark.asyncio
async def test_invalid_create_prerequisites_do_not_persist_task(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with session_factory() as session:
        owner, project, column = await create_board(session)
        assert owner.id is not None
        assert project.id is not None
        first = await add_task(session, project, column, "First")
        assert first.id is not None

        with pytest.raises(HTTPException, match="unique"):
            await TaskService(session).create(
                project_id=project.id,
                user_id=owner.id,
                payload=TaskCreate(
                    title="Should not persist",
                    column_id=column.id,
                    prerequisite_task_ids=[first.id, first.id],
                ),
            )

        persisted = await session.scalar(
            select(Task).filter_by(title="Should not persist")
        )
        assert persisted is None


@pytest.mark.asyncio
async def test_update_replaces_omits_and_clears_prerequisites(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with session_factory() as session:
        owner, project, column = await create_board(session)
        assert owner.id is not None
        assert project.id is not None
        first = await add_task(session, project, column, "First")
        second = await add_task(session, project, column, "Second")
        blocked = await add_task(session, project, column, "Blocked")
        assert first.id is not None
        assert second.id is not None
        assert blocked.id is not None
        first_id = first.id
        second_id = second.id
        service = TaskService(session)

        one_left = await service.update(
            project_id=project.id,
            task_id=blocked.id,
            user_id=owner.id,
            payload=TaskUpdate(prerequisite_task_ids=[first_id, second_id]),
        )
        assert set(one_left.prerequisite_task_ids) == {first_id, second_id}

        renamed = await service.update(
            project_id=project.id,
            task_id=blocked.id,
            user_id=owner.id,
            payload=TaskUpdate(title="Renamed"),
        )
        assert set(renamed.prerequisite_task_ids) == {first_id, second_id}

        cleared = await service.update(
            project_id=project.id,
            task_id=blocked.id,
            user_id=owner.id,
            payload=TaskUpdate(prerequisite_task_ids=[]),
        )
        assert cleared.prerequisite_task_ids == []


@pytest.mark.asyncio
async def test_blocked_marker_is_separate_from_prerequisites_and_appends_events(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with session_factory() as session:
        owner, project, column = await create_board(session)
        assert owner.id is not None
        assert project.id is not None
        prerequisite = await add_task(session, project, column, "Prerequisite")
        blocked = await add_task(session, project, column, "Blocked")
        assert prerequisite.id is not None
        assert blocked.id is not None
        service = TaskService(session)

        marked = await service.update(
            project_id=project.id,
            task_id=blocked.id,
            user_id=owner.id,
            payload=TaskUpdate(
                is_blocked=True,
                blocked_reason="  Waiting on customer access  ",
                prerequisite_task_ids=[prerequisite.id],
            ),
        )
        unchanged = await service.update(
            project_id=project.id,
            task_id=blocked.id,
            user_id=owner.id,
            payload=TaskUpdate(blocked_reason="New reason without state change"),
        )
        unblocked = await service.update(
            project_id=project.id,
            task_id=blocked.id,
            user_id=owner.id,
            payload=TaskUpdate(is_blocked=False, blocked_reason="ignored"),
        )

        assert marked.is_blocked is True
        assert marked.blocked_reason == "Waiting on customer access"
        assert marked.prerequisite_task_ids == [prerequisite.id]
        assert unchanged.is_blocked is True
        assert unchanged.blocked_reason == "New reason without state change"
        assert unchanged.prerequisite_task_ids == [prerequisite.id]
        assert unblocked.is_blocked is False
        assert unblocked.blocked_reason is None
        assert unblocked.prerequisite_task_ids == [prerequisite.id]

        events = (
            await session.scalars(
                select(ProjectTaskChangeEvent).order_by(
                    col(ProjectTaskChangeEvent.occurred_at),
                    col(ProjectTaskChangeEvent.id),
                )
            )
        ).all()
        assert [event.event_type for event in events] == [
            "blocked_state_changed",
            "blocked_state_changed",
        ]
        assert [event.is_blocked for event in events] == [True, False]
        assert events[0].blocked_reason == "Waiting on customer access"
        assert events[1].blocked_reason is None


@pytest.mark.asyncio
async def test_invalid_prerequisite_graphs_are_rejected_atomically(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with session_factory() as session:
        owner, project, column = await create_board(session)
        assert owner.id is not None
        assert project.id is not None
        project_id = project.id
        owner_id = owner.id
        first = await add_task(session, project, column, "First")
        second = await add_task(session, project, column, "Second")
        assert first.id is not None
        assert second.id is not None
        first_id = first.id
        second_id = second.id
        service = TaskService(session)

        with pytest.raises(HTTPException, match="unique"):
            await service.update(
                project_id=project_id,
                task_id=second_id,
                user_id=owner_id,
                payload=TaskUpdate(prerequisite_task_ids=[first_id, first_id]),
            )
        with pytest.raises(HTTPException, match="belong"):
            await service.update(
                project_id=project_id,
                task_id=second_id,
                user_id=owner_id,
                payload=TaskUpdate(prerequisite_task_ids=[uuid4()]),
            )
        with pytest.raises(HTTPException, match="itself"):
            await service.update(
                project_id=project_id,
                task_id=second_id,
                user_id=owner_id,
                payload=TaskUpdate(prerequisite_task_ids=[second_id]),
            )

        await service.update(
            project_id=project_id,
            task_id=second_id,
            user_id=owner_id,
            payload=TaskUpdate(prerequisite_task_ids=[first_id]),
        )
        with pytest.raises(HTTPException, match="cycle"):
            await service.update(
                project_id=project_id,
                task_id=first_id,
                user_id=owner_id,
                payload=TaskUpdate(
                    title="Not persisted", prerequisite_task_ids=[second_id]
                ),
            )
        persisted = await session.get(Task, first_id)
        assert persisted is not None
        assert persisted.title == "First"


@pytest.mark.asyncio
async def test_prerequisite_candidate_search_orders_and_excludes(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with session_factory() as session:
        owner, project, column = await create_board(session)
        assert owner.id is not None
        assert project.id is not None
        now = datetime(2026, 1, 1, tzinfo=UTC)
        older = await add_task(session, project, column, "Other draft", updated_at=now)
        prefix = await add_task(
            session, project, column, "Draft plan", updated_at=now - timedelta(days=1)
        )
        excluded = await add_task(
            session,
            project,
            column,
            "Draft excluded",
            updated_at=now + timedelta(days=1),
        )

        searched = await TaskService(session).list(
            project_id=project.id,
            user_id=owner.id,
            title="draft",
            limit=10,
            exclude_task_id=excluded.id,
        )
        recent = await TaskService(session).list(
            project_id=project.id,
            user_id=owner.id,
            limit=2,
        )

        assert [task.id for task in searched] == [prefix.id, older.id]
        assert [task.id for task in recent] == [excluded.id, older.id]
