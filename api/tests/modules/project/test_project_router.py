import asyncio
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import cast
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel, col
from starlette.websockets import WebSocketDisconnect

import app.api.v1.endpoints.projects as project_routes
from app.api import deps
from app.api.v1.endpoints.projects import project_router
from app.core.exceptions import InvalidTokenException
from app.core.security import AuthMiddleware
from app.db.session import get_db
from app.models.project import (
    Project,
    ProjectChatMessage,
    ProjectMember,
    ProjectOwner,
    ProjectSprint,
    ProjectSprintTaskSnapshot,
    ProjectTaskChangeEvent,
    SprintLifecycleState,
)
from app.models.task import Task, TaskDependency
from app.models.user import User
from app.schemas.auth import AuthenticatedContext
from app.services.auth_service import RequestAuthBoundary, WebSocketAuthBoundary
from app.services.project_chat_fanout import ProjectChatFanout
from app.services.project_chat_service import ProjectChatService


class StubAuthenticateRequest:
    async def execute(self, bearer_token: str) -> AuthenticatedContext:
        if bearer_token == "invalid-token":
            raise InvalidTokenException("Token is invalid")

        subject = {
            "member-token": "member",
            "outsider-token": "outsider",
        }.get(bearer_token, "creator")
        return AuthenticatedContext(
            subject=subject,
            issuer="https://issuer.test",
            expires_at=datetime.now(UTC) + timedelta(minutes=5),
            audience="kanai-api",
            claims={"scope": "openid"},
        )


class FakeProjectChatSocket:
    def __init__(self) -> None:
        self.payloads: list[dict[str, object]] = []

    async def send_json(self, data: object) -> None:
        assert isinstance(data, dict)
        self.payloads.append(cast("dict[str, object]", data))


class FakeProjectChatFanoutBroker:
    def __init__(self) -> None:
        self.published_events: list[dict[str, object]] = []
        self._subscribers: list[asyncio.Queue[dict[str, object] | None]] = []

    async def publish(self, event: dict[str, object]) -> None:
        self.published_events.append(event)
        for subscriber in self._subscribers:
            await subscriber.put(event)

    async def subscribe(self) -> AsyncIterator[dict[str, object]]:
        subscriber: asyncio.Queue[dict[str, object] | None] = asyncio.Queue()
        self._subscribers.append(subscriber)
        try:
            while True:
                event = await subscriber.get()
                if event is None:
                    return
                yield event
        finally:
            self._subscribers.remove(subscriber)

    async def aclose(self) -> None:
        for subscriber in self._subscribers:
            await subscriber.put(None)


@pytest_asyncio.fixture
async def session_factory(
    tmp_path: Path,
) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    database_path = tmp_path / "project_router.sqlite3"
    engine = create_async_engine(f"sqlite+aiosqlite:///{database_path}")
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)

    yield factory

    await engine.dispose()


@pytest_asyncio.fixture
async def app(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncIterator[FastAPI]:
    app = FastAPI()
    authenticate_request = StubAuthenticateRequest()
    app.add_middleware(
        AuthMiddleware,
        auth_boundary=RequestAuthBoundary(authenticate_request),
    )
    app.include_router(project_router)

    async def override_get_db() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    original_websocket_auth_boundary = deps.websocket_auth_boundary
    original_project_chat_fanout = project_routes.project_chat_fanout
    deps.websocket_auth_boundary = WebSocketAuthBoundary(authenticate_request)
    project_routes.project_chat_fanout = ProjectChatFanout(
        FakeProjectChatFanoutBroker()
    )

    yield app

    deps.websocket_auth_boundary = original_websocket_auth_boundary
    await project_routes.project_chat_fanout.aclose()
    project_routes.project_chat_fanout = original_project_chat_fanout


@pytest_asyncio.fixture
async def client(
    app: FastAPI,
) -> AsyncIterator[AsyncClient]:

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest_asyncio.fixture
async def websocket_client(app: FastAPI) -> TestClient:
    return TestClient(app)


@pytest_asyncio.fixture
async def users(
    session_factory: async_sessionmaker[AsyncSession],
) -> dict[str, User]:
    async with session_factory() as session:
        creator = User(externalId="creator")
        owner = User(externalId="owner")
        member = User(externalId="member")
        outsider = User(externalId="outsider")
        assignee = User(externalId="assignee")
        session.add_all([creator, owner, member, outsider, assignee])
        await session.commit()
        await session.refresh(creator)
        await session.refresh(owner)
        await session.refresh(member)
        await session.refresh(outsider)
        await session.refresh(assignee)

    return {
        "creator": creator,
        "owner": owner,
        "member": member,
        "outsider": outsider,
        "assignee": assignee,
    }


@pytest.mark.asyncio
async def test_project_crud_endpoints(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    creator_id = users["creator"].id
    owner_id = users["owner"].id
    member_id = users["member"].id
    assert creator_id is not None
    assert owner_id is not None
    assert member_id is not None

    create_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Enterprise Launch",
            "code": "ENT",
            "description": "Launch work",
            "status": "paused",
            "owner_ids": [str(owner_id)],
            "member_ids": [str(member_id)],
        },
    )

    assert create_response.status_code == 201
    created_project = create_response.json()
    assert created_project["code"] == "ENT"
    assert "priority" not in created_project
    assert created_project["status"] == "paused"
    assert set(created_project["owner_ids"]) == {str(creator_id), str(owner_id)}
    assert created_project["member_ids"] == [str(member_id)]

    list_response = await client.get(
        "/projects",
        headers={"Authorization": "Bearer token"},
    )

    assert list_response.status_code == 200
    assert [project["id"] for project in list_response.json()] == [
        created_project["id"]
    ]

    get_response = await client.get(
        f"/projects/{created_project['id']}",
        headers={"Authorization": "Bearer token"},
    )

    assert get_response.status_code == 200
    assert get_response.json()["name"] == "Enterprise Launch"
    assert "priority" not in get_response.json()

    update_response = await client.patch(
        f"/projects/{created_project['id']}",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch Updated", "owner_ids": []},
    )

    assert update_response.status_code == 200
    updated_project = update_response.json()
    assert updated_project["name"] == "Enterprise Launch Updated"
    assert updated_project["code"] == "ENT"
    assert updated_project["owner_ids"] == [str(creator_id)]

    delete_response = await client.delete(
        f"/projects/{created_project['id']}",
        headers={"Authorization": "Bearer token"},
    )

    assert delete_response.status_code == 204

    project_id = UUID(created_project["id"])
    async with session_factory() as session:
        project = await session.get(Project, project_id)
        project_owners = await session.scalars(
            select(ProjectOwner).filter_by(project_id=project_id)
        )
        project_members = await session.scalars(
            select(ProjectMember).filter_by(project_id=project_id)
        )

    assert project is None
    assert project_owners.all() == []
    assert project_members.all() == []


@pytest.mark.asyncio
async def test_project_dashboard_returns_empty_chart_contract_for_participant(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    member_id = users["member"].id
    assert member_id is not None
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Dashboard Project",
            "code": "DSH",
            "member_ids": [str(member_id)],
        },
    )
    project_id = project_response.json()["id"]

    response = await client.get(
        f"/projects/{project_id}/dashboard",
        headers={"Authorization": "Bearer member-token"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["project_id"] == project_id
    assert [chart["title"] for chart in payload["charts"]] == [
        "Burndown chart",
        "Burnup chart",
        "Scope change chart",
        "Velocity chart",
        "Cumulative Flow Diagram",
        "Cycle time chart",
        "Throughput chart",
        "Blocked work chart",
        "Defect / rework chart",
        "Forecast cone",
        "Work aging chart",
    ]
    for chart in payload["charts"]:
        assert chart["series"] == []
        assert chart["entries"] == []
        assert chart["empty_state"]["reason"] == "no_project_task_change_events"
        assert chart["empty_state"]["message"]


@pytest.mark.asyncio
async def test_project_dashboard_does_not_backfill_current_scope_without_events(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "No Backfill Project", "code": "NBF"},
    )
    project_id = project_response.json()["id"]
    task_response = await client.post(
        f"/projects/{project_id}/backlog/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Existing estimated task", "story_points": 5},
    )
    sprint_response = await client.post(
        f"/projects/{project_id}/sprints",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-06-01",
            "planned_end_date": "2026-06-14",
            "task_ids": [task_response.json()["id"]],
        },
    )
    assert task_response.status_code == 201
    assert sprint_response.status_code == 201
    async with session_factory() as session:
        await session.execute(
            delete(ProjectTaskChangeEvent).where(
                col(ProjectTaskChangeEvent.project_id) == UUID(project_id)
            )
        )
        await session.commit()

    response = await client.get(
        f"/projects/{project_id}/dashboard",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 200
    scope_chart = next(
        chart
        for chart in response.json()["charts"]
        if chart["title"] == "Scope change chart"
    )
    assert scope_chart["series"] == []
    assert scope_chart["entries"] == []
    assert scope_chart["empty_state"]["reason"] == "no_project_task_change_events"


@pytest.mark.asyncio
async def test_project_dashboard_computes_scope_charts_from_task_change_events(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Dashboard Project", "code": "EVT"},
    )
    project_id = UUID(project_response.json()["id"])
    done_column_response = await client.get(
        f"/projects/{project_id}/done-column",
        headers={"Authorization": "Bearer token"},
    )
    assert done_column_response.status_code == 200
    sprint_id = uuid4()
    estimated_task_id = uuid4()
    unestimated_task_id = uuid4()

    async with session_factory() as session:
        session.add_all(
            [
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=estimated_task_id,
                    event_type="sprint_scope_added",
                    sprint_id=sprint_id,
                    new_sprint_id=sprint_id,
                    new_story_points=5,
                    occurred_at=datetime(2026, 6, 22, 10, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=unestimated_task_id,
                    event_type="sprint_scope_added",
                    sprint_id=sprint_id,
                    new_sprint_id=sprint_id,
                    new_story_points=None,
                    occurred_at=datetime(2026, 6, 22, 11, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=estimated_task_id,
                    event_type="story_points_changed",
                    sprint_id=sprint_id,
                    previous_story_points=5,
                    new_story_points=8,
                    occurred_at=datetime(2026, 6, 23, 10, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=estimated_task_id,
                    event_type="sprint_scope_removed",
                    sprint_id=sprint_id,
                    previous_sprint_id=sprint_id,
                    previous_story_points=8,
                    occurred_at=datetime(2026, 6, 24, 10, tzinfo=UTC),
                ),
            ]
        )
        await session.commit()

    response = await client.get(
        f"/projects/{project_id}/dashboard",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 200
    charts = {chart["title"]: chart for chart in response.json()["charts"]}
    burndown = charts["Burndown chart"]
    burnup = charts["Burnup chart"]
    scope_change = charts["Scope change chart"]
    assert burndown["empty_state"] is None
    assert burndown["series"][0]["name"] == "Remaining Sprint Scope"
    assert [
        entry["values"]["remaining_story_points"] for entry in burndown["entries"]
    ] == [
        0,
    ]
    assert burndown["entries"][0]["values"]["unestimated_tasks"] == 1
    assert [series["name"] for series in burnup["series"]] == [
        "Completed Story Points",
        "Sprint Scope",
    ]
    assert [
        entry["values"]["completed_story_points"]
        for entry in burnup["series"][0]["entries"]
    ] == [0]
    assert [series["name"] for series in scope_change["series"]] == [
        "Added Story Points",
        "Removed Story Points",
    ]
    assert scope_change["entries"][0]["label"] == "2026-06-22"
    assert scope_change["entries"][0]["values"] == {
        "sprint_scope": 0,
        "scope_delta": 0,
        "added_story_points": 8,
        "removed_story_points": 8,
        "tasks_added": 2,
        "tasks_removed": 1,
        "unestimated_tasks": 1,
        "unestimated_tasks_added": 1,
        "unestimated_tasks_removed": 0,
    }
    assert scope_change["series"][0]["entries"][0]["values"] == {
        "added_story_points": 8,
        "tasks_added": 2,
        "unestimated_tasks_added": 1,
    }
    assert scope_change["series"][1]["entries"][0]["values"] == {
        "removed_story_points": 8,
        "tasks_removed": 1,
        "unestimated_tasks_removed": 0,
    }
    blocked_work = charts["Blocked work chart"]
    assert blocked_work["entries"] == []
    assert blocked_work["empty_state"]["reason"] == "no_blocked_project_task_events"


@pytest.mark.asyncio
async def test_project_dashboard_burndown_and_burnup_follow_done_column_events(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Completion Project", "code": "BCP"},
    )
    project_id = UUID(project_response.json()["id"])
    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    columns = columns_response.json()
    todo_column_id = UUID(columns[0]["id"])
    done_column_id = UUID(columns[-1]["id"])
    done_column_response = await client.patch(
        f"/projects/{project_id}/done-column",
        headers={"Authorization": "Bearer token"},
        json={"done_column_id": str(done_column_id)},
    )
    assert done_column_response.status_code == 200
    sprint_id = uuid4()
    first_task_id = uuid4()
    second_task_id = uuid4()

    async with session_factory() as session:
        session.add_all(
            [
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=first_task_id,
                    event_type="sprint_scope_added",
                    sprint_id=sprint_id,
                    new_sprint_id=sprint_id,
                    new_story_points=5,
                    occurred_at=datetime(2026, 6, 22, 10, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=second_task_id,
                    event_type="sprint_scope_added",
                    sprint_id=sprint_id,
                    new_sprint_id=sprint_id,
                    new_story_points=3,
                    occurred_at=datetime(2026, 6, 22, 11, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=first_task_id,
                    event_type="workflow_column_changed",
                    sprint_id=sprint_id,
                    previous_column_id=todo_column_id,
                    previous_column_name="To Do",
                    previous_column_position=0,
                    new_column_id=done_column_id,
                    new_column_name="Done",
                    new_column_position=2,
                    occurred_at=datetime(2026, 6, 29, 10, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=first_task_id,
                    event_type="workflow_column_changed",
                    sprint_id=sprint_id,
                    previous_column_id=done_column_id,
                    previous_column_name="Done",
                    previous_column_position=2,
                    new_column_id=todo_column_id,
                    new_column_name="To Do",
                    new_column_position=0,
                    occurred_at=datetime(2026, 7, 6, 10, tzinfo=UTC),
                ),
            ]
        )
        await session.commit()

    response = await client.get(
        f"/projects/{project_id}/dashboard",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 200
    charts = {chart["title"]: chart for chart in response.json()["charts"]}
    burndown = charts["Burndown chart"]
    burnup = charts["Burnup chart"]
    assert [entry["label"] for entry in burndown["entries"]] == [
        "2026-06-22",
        "2026-06-29",
        "2026-07-06",
    ]
    assert [
        entry["values"]["remaining_story_points"] for entry in burndown["entries"]
    ] == [8, 3, 8]
    assert [
        entry["values"]["completed_story_points"]
        for entry in burnup["series"][0]["entries"]
    ] == [0, 5, 0]
    assert [
        entry["values"]["sprint_scope"] for entry in burnup["series"][1]["entries"]
    ] == [8, 8, 8]


@pytest.mark.asyncio
async def test_project_dashboard_burndown_and_burnup_need_done_column(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Missing Done Project", "code": "MDP"},
    )
    project_id = UUID(project_response.json()["id"])
    sprint_id = uuid4()
    task_id = uuid4()

    async with session_factory() as session:
        session.add(
            ProjectTaskChangeEvent(
                project_id=project_id,
                task_id=task_id,
                event_type="sprint_scope_added",
                sprint_id=sprint_id,
                new_sprint_id=sprint_id,
                new_story_points=5,
                occurred_at=datetime(2026, 6, 22, 10, tzinfo=UTC),
            )
        )
        await session.commit()

    response = await client.get(
        f"/projects/{project_id}/dashboard",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 200
    charts = {chart["title"]: chart for chart in response.json()["charts"]}
    assert charts["Burndown chart"]["entries"] == []
    assert charts["Burnup chart"]["series"] == []
    assert charts["Burndown chart"]["empty_state"]["reason"] == "no_done_column"
    assert charts["Burnup chart"]["empty_state"]["reason"] == "no_done_column"


@pytest.mark.asyncio
async def test_project_dashboard_scope_chart_limits_to_current_plus_last_six_sprints(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Recent Scope Project", "code": "RSP"},
    )
    project_id = UUID(project_response.json()["id"])
    sprint_ids = [uuid4() for _ in range(8)]

    async with session_factory() as session:
        session.add_all(
            [
                ProjectSprint(
                    id=sprint_id,
                    project_id=project_id,
                    name=f"Sprint {index + 1}",
                    lifecycle_state=(
                        SprintLifecycleState.ACTIVE
                        if index == 7
                        else SprintLifecycleState.CLOSED
                    ),
                    planned_start_date=(
                        datetime(2026, 1, 5) + timedelta(days=index * 7)
                    ).date(),
                    planned_end_date=(
                        datetime(2026, 1, 11) + timedelta(days=index * 7)
                    ).date(),
                    closed_at=(
                        datetime(2026, 1, 11, 17, tzinfo=UTC)
                        + timedelta(days=index * 7)
                        if index < 7
                        else None
                    ),
                )
                for index, sprint_id in enumerate(sprint_ids)
            ]
            + [
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=uuid4(),
                    event_type="sprint_scope_added",
                    sprint_id=sprint_id,
                    new_sprint_id=sprint_id,
                    new_story_points=1,
                    occurred_at=datetime(2026, 1, 5, 10, tzinfo=UTC)
                    + timedelta(days=index * 7),
                )
                for index, sprint_id in enumerate(sprint_ids)
            ]
        )
        await session.commit()

    response = await client.get(
        f"/projects/{project_id}/dashboard",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 200
    scope_chart = next(
        chart
        for chart in response.json()["charts"]
        if chart["title"] == "Scope change chart"
    )
    assert [entry["label"] for entry in scope_chart["entries"]] == [
        "2026-01-12",
        "2026-01-19",
        "2026-01-26",
        "2026-02-02",
        "2026-02-09",
        "2026-02-16",
        "2026-02-23",
    ]
    assert scope_chart["entries"][-1]["values"]["sprint_scope"] == 7


@pytest.mark.asyncio
async def test_project_dashboard_cfd_preserves_arbitrary_workflow_columns(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Flow Project", "code": "CFD"},
    )
    project_id = UUID(project_response.json()["id"])
    discovery_response = await client.post(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
        json={"name": "Discovery"},
    )
    build_response = await client.post(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
        json={"name": "Build"},
    )
    signoff_response = await client.post(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
        json={"name": "Customer Sign-off"},
    )
    discovery = discovery_response.json()
    build = build_response.json()
    signoff = signoff_response.json()
    first_task_id = uuid4()
    second_task_id = uuid4()

    async with session_factory() as session:
        session.add_all(
            [
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=first_task_id,
                    event_type="workflow_column_changed",
                    previous_column_id=UUID(discovery["id"]),
                    previous_column_name=discovery["name"],
                    previous_column_position=discovery["position"],
                    new_column_id=UUID(build["id"]),
                    new_column_name=build["name"],
                    new_column_position=build["position"],
                    occurred_at=datetime(2026, 6, 22, 10, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=second_task_id,
                    event_type="workflow_column_changed",
                    previous_column_id=UUID(build["id"]),
                    previous_column_name=build["name"],
                    previous_column_position=build["position"],
                    new_column_id=UUID(signoff["id"]),
                    new_column_name=signoff["name"],
                    new_column_position=signoff["position"],
                    occurred_at=datetime(2026, 6, 22, 11, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=first_task_id,
                    event_type="workflow_column_changed",
                    previous_column_id=UUID(build["id"]),
                    previous_column_name="Build - renamed in history",
                    previous_column_position=build["position"],
                    new_column_id=UUID(signoff["id"]),
                    new_column_name=signoff["name"],
                    new_column_position=signoff["position"],
                    occurred_at=datetime(2026, 6, 22, 12, tzinfo=UTC),
                ),
            ]
        )
        await session.commit()

    response = await client.get(
        f"/projects/{project_id}/dashboard",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 200
    charts = {chart["title"]: chart for chart in response.json()["charts"]}
    cfd = charts["Cumulative Flow Diagram"]
    assert cfd["empty_state"] is None
    assert [series["name"] for series in cfd["series"]] == [
        "Discovery",
        "Build - renamed in history",
        "Customer Sign-off",
    ]
    assert "To Do" not in [series["name"] for series in cfd["series"]]
    assert cfd["series"][0]["entries"][-1]["values"] == {
        "workflow_column_id": discovery["id"],
        "workflow_column_name": "Discovery",
        "workflow_column_position": discovery["position"],
        "task_count": 0,
    }
    assert cfd["series"][1]["entries"][-1]["values"]["task_count"] == 0
    assert cfd["series"][2]["entries"][-1]["values"]["task_count"] == 2
    assert cfd["entries"][-1]["values"]["from_column_name"] == (
        "Build - renamed in history"
    )
    assert cfd["entries"][-1]["values"]["to_column_name"] == "Customer Sign-off"


@pytest.mark.asyncio
async def test_project_dashboard_computes_cycle_time_from_first_workflow_entry_to_done_column(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Cycle Time Project", "code": "CTP"},
    )
    project_id = UUID(project_response.json()["id"])
    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    columns = columns_response.json()
    todo_column = next(column for column in columns if column["name"] == "To Do")
    progress_column = next(
        column for column in columns if column["name"] == "In Progress"
    )
    done_column = next(column for column in columns if column["name"] == "Done")
    await client.patch(
        f"/projects/{project_id}/done-column",
        headers={"Authorization": "Bearer token"},
        json={"done_column_id": done_column["id"]},
    )
    sprint_id = uuid4()
    closed_sprint_id = uuid4()
    active_task_id = uuid4()
    finished_task_id = uuid4()
    backlog_task_id = uuid4()
    backlog_workflow_task_id = uuid4()
    backlog_sprint_task_id = uuid4()
    removed_sprint_task_id = uuid4()
    closed_sprint_task_id = uuid4()

    async with session_factory() as session:
        session.add_all(
            [
                ProjectSprint(
                    id=sprint_id,
                    project_id=project_id,
                    name="Active Sprint",
                    lifecycle_state=SprintLifecycleState.ACTIVE,
                    planned_start_date=datetime(2026, 1, 1).date(),
                    planned_end_date=datetime(2026, 1, 14).date(),
                ),
                ProjectSprint(
                    id=closed_sprint_id,
                    project_id=project_id,
                    name="Closed Sprint",
                    lifecycle_state=SprintLifecycleState.CLOSED,
                    planned_start_date=datetime(2025, 12, 1).date(),
                    planned_end_date=datetime(2025, 12, 14).date(),
                    closed_at=datetime(2025, 12, 14, 17, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=active_task_id,
                    event_type="sprint_scope_added",
                    sprint_id=sprint_id,
                    new_sprint_id=sprint_id,
                    occurred_at=datetime(2026, 1, 1, 9, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=active_task_id,
                    event_type="workflow_column_changed",
                    previous_column_id=None,
                    previous_column_name="Backlog",
                    previous_column_position=0,
                    new_column_id=UUID(todo_column["id"]),
                    new_column_name=todo_column["name"],
                    new_column_position=todo_column["position"],
                    occurred_at=datetime(2026, 1, 2, 9, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=active_task_id,
                    event_type="workflow_column_changed",
                    previous_column_id=UUID(todo_column["id"]),
                    previous_column_name=todo_column["name"],
                    previous_column_position=todo_column["position"],
                    new_column_id=UUID(progress_column["id"]),
                    new_column_name=progress_column["name"],
                    new_column_position=progress_column["position"],
                    occurred_at=datetime(2026, 1, 4, 9, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=finished_task_id,
                    event_type="sprint_scope_added",
                    sprint_id=sprint_id,
                    new_sprint_id=sprint_id,
                    occurred_at=datetime(2026, 1, 1, 10, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=finished_task_id,
                    event_type="workflow_column_changed",
                    previous_column_id=None,
                    previous_column_name="Backlog",
                    previous_column_position=0,
                    new_column_id=UUID(progress_column["id"]),
                    new_column_name=progress_column["name"],
                    new_column_position=progress_column["position"],
                    occurred_at=datetime(2026, 1, 3, 9, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=finished_task_id,
                    event_type="workflow_column_changed",
                    previous_column_id=UUID(progress_column["id"]),
                    previous_column_name=progress_column["name"],
                    previous_column_position=progress_column["position"],
                    new_column_id=UUID(done_column["id"]),
                    new_column_name=done_column["name"],
                    new_column_position=done_column["position"],
                    occurred_at=datetime(2026, 1, 5, 9, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=backlog_sprint_task_id,
                    event_type="sprint_scope_added",
                    sprint_id=sprint_id,
                    new_sprint_id=sprint_id,
                    occurred_at=datetime(2026, 1, 1, 11, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=removed_sprint_task_id,
                    event_type="sprint_scope_added",
                    sprint_id=sprint_id,
                    new_sprint_id=sprint_id,
                    occurred_at=datetime(2026, 1, 1, 12, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=removed_sprint_task_id,
                    event_type="workflow_column_changed",
                    previous_column_id=None,
                    previous_column_name="Backlog",
                    previous_column_position=0,
                    new_column_id=UUID(progress_column["id"]),
                    new_column_name=progress_column["name"],
                    new_column_position=progress_column["position"],
                    occurred_at=datetime(2026, 1, 3, 12, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=removed_sprint_task_id,
                    event_type="sprint_scope_removed",
                    sprint_id=sprint_id,
                    previous_sprint_id=sprint_id,
                    occurred_at=datetime(2026, 1, 4, 12, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=closed_sprint_task_id,
                    event_type="sprint_scope_added",
                    sprint_id=closed_sprint_id,
                    new_sprint_id=closed_sprint_id,
                    occurred_at=datetime(2025, 12, 1, 9, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=closed_sprint_task_id,
                    event_type="workflow_column_changed",
                    previous_column_id=None,
                    previous_column_name="Backlog",
                    previous_column_position=0,
                    new_column_id=UUID(progress_column["id"]),
                    new_column_name=progress_column["name"],
                    new_column_position=progress_column["position"],
                    occurred_at=datetime(2025, 12, 2, 9, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=backlog_task_id,
                    event_type="blocked_state_changed",
                    is_blocked=True,
                    occurred_at=datetime(2026, 1, 6, 9, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=backlog_workflow_task_id,
                    event_type="workflow_column_changed",
                    previous_column_id=None,
                    previous_column_name="Backlog",
                    previous_column_position=0,
                    new_column_id=UUID(progress_column["id"]),
                    new_column_name=progress_column["name"],
                    new_column_position=progress_column["position"],
                    occurred_at=datetime(2026, 1, 6, 10, tzinfo=UTC),
                ),
            ]
        )
        await session.commit()

    response = await client.get(
        f"/projects/{project_id}/dashboard",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 200
    charts = {chart["title"]: chart for chart in response.json()["charts"]}
    cycle_time = charts["Cycle time chart"]
    work_aging = charts["Work aging chart"]
    assert cycle_time["empty_state"] is None
    assert cycle_time["series"][0]["name"] == "Project Task Cycle Time"
    assert cycle_time["entries"] == [
        {
            "label": "2026-01-05",
            "values": {
                "task_id": str(finished_task_id),
                "cycle_time_seconds": 172800,
                "cycle_time_days": 2,
                "completed_task_count": 1,
                "average_cycle_time_seconds": 172800,
                "average_cycle_time_days": 2,
            },
        }
    ]
    assert work_aging["empty_state"] is None
    assert work_aging["series"][0]["name"] == "Active Sprint Task Age"
    assert [entry["values"]["task_id"] for entry in work_aging["entries"]] == [
        str(active_task_id)
    ]
    assert work_aging["entries"][0]["values"]["started_at"] == (
        "2026-01-02T09:00:00+00:00"
    )
    assert work_aging["entries"][0]["values"]["work_age_days"] > 0


@pytest.mark.asyncio
async def test_project_dashboard_explains_missing_done_column_for_cycle_time_and_work_aging(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Missing Done Project", "code": "MDP"},
    )
    project_id = UUID(project_response.json()["id"])
    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    progress_column = next(
        column for column in columns_response.json() if column["name"] == "In Progress"
    )
    task_id = uuid4()

    async with session_factory() as session:
        session.add(
            ProjectTaskChangeEvent(
                project_id=project_id,
                task_id=task_id,
                event_type="workflow_column_changed",
                previous_column_id=None,
                previous_column_name="Backlog",
                previous_column_position=0,
                new_column_id=UUID(progress_column["id"]),
                new_column_name=progress_column["name"],
                new_column_position=progress_column["position"],
                occurred_at=datetime(2026, 1, 7, 9, tzinfo=UTC),
            )
        )
        await session.commit()

    response = await client.get(
        f"/projects/{project_id}/dashboard",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 200
    charts = {chart["title"]: chart for chart in response.json()["charts"]}
    assert charts["Cycle time chart"]["entries"] == []
    assert charts["Cycle time chart"]["empty_state"]["reason"] == (
        "missing_done_column_configuration"
    )
    assert charts["Work aging chart"]["entries"] == []
    assert charts["Work aging chart"]["empty_state"]["reason"] == (
        "missing_done_column_configuration"
    )
    assert charts["Defect / rework chart"]["entries"] == []
    assert charts["Defect / rework chart"]["empty_state"]["reason"] == (
        "missing_done_column_configuration"
    )


@pytest.mark.asyncio
async def test_project_dashboard_groups_reworked_tasks_when_finished_tasks_leave_done(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Rework Project", "code": "RWK"},
    )
    project_id = UUID(project_response.json()["id"])
    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    columns = columns_response.json()
    todo_column = next(column for column in columns if column["name"] == "To Do")
    progress_column = next(
        column for column in columns if column["name"] == "In Progress"
    )
    done_column = next(column for column in columns if column["name"] == "Done")
    await client.patch(
        f"/projects/{project_id}/done-column",
        headers={"Authorization": "Bearer token"},
        json={"done_column_id": done_column["id"]},
    )
    first_task_id = uuid4()
    second_task_id = uuid4()
    active_task_id = uuid4()

    async with session_factory() as session:
        session.add_all(
            [
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=first_task_id,
                    event_type="workflow_column_changed",
                    previous_column_id=UUID(progress_column["id"]),
                    previous_column_name=progress_column["name"],
                    previous_column_position=progress_column["position"],
                    new_column_id=UUID(done_column["id"]),
                    new_column_name=done_column["name"],
                    new_column_position=done_column["position"],
                    occurred_at=datetime(2026, 1, 5, 9, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=first_task_id,
                    event_type="workflow_column_changed",
                    previous_column_id=UUID(done_column["id"]),
                    previous_column_name=done_column["name"],
                    previous_column_position=done_column["position"],
                    new_column_id=UUID(progress_column["id"]),
                    new_column_name=progress_column["name"],
                    new_column_position=progress_column["position"],
                    occurred_at=datetime(2026, 1, 7, 9, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=active_task_id,
                    event_type="workflow_column_changed",
                    previous_column_id=UUID(todo_column["id"]),
                    previous_column_name=todo_column["name"],
                    previous_column_position=todo_column["position"],
                    new_column_id=UUID(progress_column["id"]),
                    new_column_name=progress_column["name"],
                    new_column_position=progress_column["position"],
                    occurred_at=datetime(2026, 1, 8, 9, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=second_task_id,
                    event_type="workflow_column_changed",
                    previous_column_id=UUID(done_column["id"]),
                    previous_column_name=done_column["name"],
                    previous_column_position=done_column["position"],
                    new_column_id=UUID(todo_column["id"]),
                    new_column_name=todo_column["name"],
                    new_column_position=todo_column["position"],
                    occurred_at=datetime(2026, 1, 12, 9, tzinfo=UTC),
                ),
            ]
        )
        await session.commit()

    response = await client.get(
        f"/projects/{project_id}/dashboard",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 200
    charts = {chart["title"]: chart for chart in response.json()["charts"]}
    rework = charts["Defect / rework chart"]
    assert rework["empty_state"] is None
    assert rework["series"][0]["name"] == "Reworked Tasks"
    assert rework["entries"] == [
        {
            "label": "2026-01-05",
            "values": {
                "reworked_task_count": 1,
                "cumulative_reworked_task_count": 1,
            },
        },
        {
            "label": "2026-01-12",
            "values": {
                "reworked_task_count": 1,
                "cumulative_reworked_task_count": 2,
            },
        },
    ]


@pytest.mark.asyncio
async def test_project_dashboard_does_not_count_non_done_workflow_movement_as_rework(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Non Rework Project", "code": "NRW"},
    )
    project_id = UUID(project_response.json()["id"])
    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    columns = columns_response.json()
    todo_column = next(column for column in columns if column["name"] == "To Do")
    progress_column = next(
        column for column in columns if column["name"] == "In Progress"
    )
    done_column = next(column for column in columns if column["name"] == "Done")
    await client.patch(
        f"/projects/{project_id}/done-column",
        headers={"Authorization": "Bearer token"},
        json={"done_column_id": done_column["id"]},
    )

    async with session_factory() as session:
        session.add(
            ProjectTaskChangeEvent(
                project_id=project_id,
                task_id=uuid4(),
                event_type="workflow_column_changed",
                previous_column_id=UUID(todo_column["id"]),
                previous_column_name=todo_column["name"],
                previous_column_position=todo_column["position"],
                new_column_id=UUID(progress_column["id"]),
                new_column_name=progress_column["name"],
                new_column_position=progress_column["position"],
                occurred_at=datetime(2026, 1, 8, 9, tzinfo=UTC),
            )
        )
        await session.commit()

    response = await client.get(
        f"/projects/{project_id}/dashboard",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 200
    charts = {chart["title"]: chart for chart in response.json()["charts"]}
    rework = charts["Defect / rework chart"]
    assert rework["entries"] == []
    assert rework["series"] == []
    assert rework["empty_state"]["reason"] == "no_reworked_task_events"


@pytest.mark.asyncio
async def test_project_dashboard_does_not_infer_blocked_work_from_project_status_or_prerequisites(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Blocked Status Project", "code": "BLK", "status": "blocked"},
    )
    project_id = project_response.json()["id"]
    first_task_response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Prerequisite"},
    )
    await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={
            "title": "Waiting task",
            "prerequisite_task_ids": [first_task_response.json()["id"]],
        },
    )

    response = await client.get(
        f"/projects/{project_id}/dashboard",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 200
    charts = {chart["title"]: chart for chart in response.json()["charts"]}
    blocked_work = charts["Blocked work chart"]
    assert blocked_work["entries"] == []
    assert blocked_work["series"] == []
    assert blocked_work["empty_state"]["reason"] == "no_project_task_change_events"


@pytest.mark.asyncio
async def test_task_api_marks_blocked_and_unblocked_with_reason_events(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Blocked API Project", "code": "BAP"},
    )
    project_id = project_response.json()["id"]
    task_response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Investigate outage"},
    )
    task_id = task_response.json()["id"]

    marked_response = await client.patch(
        f"/projects/{project_id}/tasks/{task_id}",
        headers={"Authorization": "Bearer token"},
        json={"is_blocked": True, "blocked_reason": "Waiting on vendor"},
    )
    unblocked_response = await client.patch(
        f"/projects/{project_id}/tasks/{task_id}",
        headers={"Authorization": "Bearer token"},
        json={"is_blocked": False, "blocked_reason": "ignored"},
    )

    assert marked_response.status_code == 200
    assert marked_response.json()["is_blocked"] is True
    assert marked_response.json()["blocked_reason"] == "Waiting on vendor"
    assert unblocked_response.status_code == 200
    assert unblocked_response.json()["is_blocked"] is False
    assert unblocked_response.json()["blocked_reason"] is None

    async with session_factory() as session:
        events = (
            await session.scalars(
                select(ProjectTaskChangeEvent)
                .filter_by(project_id=UUID(project_id))
                .order_by(
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
    assert events[0].blocked_reason == "Waiting on vendor"
    assert events[1].blocked_reason is None


@pytest.mark.asyncio
async def test_project_dashboard_computes_blocked_count_and_age_from_blocked_events(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Blocked Work Project", "code": "BWA", "status": "blocked"},
    )
    project_id = UUID(project_response.json()["id"])
    first_task_id = uuid4()
    second_task_id = uuid4()

    async with session_factory() as session:
        session.add_all(
            [
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=first_task_id,
                    event_type="blocked_state_changed",
                    is_blocked=True,
                    blocked_reason="Waiting on customer access",
                    occurred_at=datetime(2026, 1, 1, 9, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=second_task_id,
                    event_type="blocked_state_changed",
                    is_blocked=True,
                    blocked_reason=None,
                    occurred_at=datetime(2026, 1, 3, 9, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=first_task_id,
                    event_type="blocked_state_changed",
                    is_blocked=False,
                    occurred_at=datetime(2026, 1, 6, 9, tzinfo=UTC),
                ),
            ]
        )
        await session.commit()

    response = await client.get(
        f"/projects/{project_id}/dashboard",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 200
    charts = {chart["title"]: chart for chart in response.json()["charts"]}
    blocked_work = charts["Blocked work chart"]
    assert blocked_work["empty_state"] is None
    assert blocked_work["series"][0]["name"] == "Blocked Project Tasks"
    assert [
        entry["values"]["blocked_count"] for entry in blocked_work["entries"][:3]
    ] == [1, 2, 1]
    assert blocked_work["entries"][2]["values"]["oldest_blocked_age_days"] == 3
    assert blocked_work["entries"][-1]["label"] == "Current"
    assert blocked_work["entries"][-1]["values"]["blocked_count"] == 1
    assert blocked_work["entries"][-1]["values"]["oldest_blocked_age_days"] >= 3


@pytest.mark.asyncio
async def test_project_dashboard_computes_velocity_throughput_and_forecast_from_completion_events(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Delivery Analytics Project", "code": "DAP"},
    )
    project_id = UUID(project_response.json()["id"])
    sprint_ids = [uuid4(), uuid4(), uuid4()]
    finished_task_ids = [uuid4(), uuid4(), uuid4(), uuid4()]
    remaining_estimated_task_id = uuid4()
    remaining_unestimated_task_id = uuid4()

    async with session_factory() as session:
        session.add_all(
            [
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=finished_task_ids[0],
                    event_type="sprint_scope_added",
                    sprint_id=sprint_ids[0],
                    new_sprint_id=sprint_ids[0],
                    new_story_points=4,
                    occurred_at=datetime(2026, 1, 5, 9, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=finished_task_ids[1],
                    event_type="sprint_scope_added",
                    sprint_id=sprint_ids[0],
                    new_sprint_id=sprint_ids[0],
                    new_story_points=6,
                    occurred_at=datetime(2026, 1, 5, 10, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=finished_task_ids[2],
                    event_type="sprint_scope_added",
                    sprint_id=sprint_ids[1],
                    new_sprint_id=sprint_ids[1],
                    new_story_points=5,
                    occurred_at=datetime(2026, 1, 12, 9, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=finished_task_ids[3],
                    event_type="sprint_scope_added",
                    sprint_id=sprint_ids[2],
                    new_sprint_id=sprint_ids[2],
                    new_story_points=20,
                    occurred_at=datetime(2026, 1, 19, 9, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=remaining_estimated_task_id,
                    event_type="sprint_scope_added",
                    sprint_id=sprint_ids[2],
                    new_sprint_id=sprint_ids[2],
                    new_story_points=30,
                    occurred_at=datetime(2026, 1, 19, 10, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=remaining_unestimated_task_id,
                    event_type="sprint_scope_added",
                    sprint_id=sprint_ids[2],
                    new_sprint_id=sprint_ids[2],
                    new_story_points=None,
                    occurred_at=datetime(2026, 1, 19, 11, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=finished_task_ids[0],
                    event_type="sprint_task_finished",
                    sprint_id=sprint_ids[0],
                    new_story_points=4,
                    occurred_at=datetime(2026, 1, 12, 12, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=finished_task_ids[1],
                    event_type="sprint_task_finished",
                    sprint_id=sprint_ids[0],
                    new_story_points=6,
                    occurred_at=datetime(2026, 1, 12, 12, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=finished_task_ids[2],
                    event_type="sprint_task_finished",
                    sprint_id=sprint_ids[1],
                    new_story_points=5,
                    occurred_at=datetime(2026, 1, 19, 12, tzinfo=UTC),
                ),
                ProjectTaskChangeEvent(
                    project_id=project_id,
                    task_id=finished_task_ids[3],
                    event_type="sprint_task_finished",
                    sprint_id=sprint_ids[2],
                    new_story_points=20,
                    occurred_at=datetime(2026, 1, 26, 12, tzinfo=UTC),
                ),
            ]
        )
        await session.commit()

    response = await client.get(
        f"/projects/{project_id}/dashboard",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 200
    payload = response.json()
    charts = {chart["title"]: chart for chart in payload["charts"]}
    velocity = charts["Velocity chart"]
    throughput = charts["Throughput chart"]
    forecast = charts["Forecast cone"]
    assert velocity["empty_state"] is None
    assert velocity["series"][0]["name"] == "Completed Story Points"
    assert [
        entry["values"]["completed_story_points"] for entry in velocity["entries"]
    ] == [
        10,
        5,
        20,
    ]
    assert velocity["entries"][0]["values"]["finished_task_count"] == 2
    assert throughput["empty_state"] is None
    assert throughput["series"][0]["name"] == "Finished Tasks"
    assert [
        entry["values"]["finished_task_count"] for entry in throughput["entries"]
    ] == [2, 1, 1]
    assert [entry["label"] for entry in throughput["entries"]] == [
        "2026-01-12",
        "2026-01-19",
        "2026-01-26",
    ]
    assert forecast["empty_state"] is None
    forecast_values = forecast["entries"][0]["values"]
    generated_date = datetime.fromisoformat(
        payload["generated_at"].replace("Z", "+00:00")
    ).date()
    assert forecast_values["estimated_remaining_story_points"] == 30
    assert forecast_values["unestimated_tasks"] == 1
    assert forecast_values["sprints_used"] == 3
    assert (
        forecast_values["best_forecast_date"]
        == (generated_date + timedelta(days=14)).isoformat()
    )
    assert (
        forecast_values["likely_forecast_date"]
        == (generated_date + timedelta(days=21)).isoformat()
    )
    assert (
        forecast_values["worst_forecast_date"]
        == (generated_date + timedelta(days=42)).isoformat()
    )


@pytest.mark.asyncio
async def test_project_dashboard_keeps_throughput_but_explains_no_estimated_velocity(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Unestimated Delivery Project", "code": "UDP"},
    )
    project_id = UUID(project_response.json()["id"])
    sprint_id = uuid4()
    task_id = uuid4()

    async with session_factory() as session:
        session.add(
            ProjectTaskChangeEvent(
                project_id=project_id,
                task_id=task_id,
                event_type="sprint_task_finished",
                sprint_id=sprint_id,
                new_story_points=None,
                occurred_at=datetime(2026, 2, 2, 12, tzinfo=UTC),
            )
        )
        await session.commit()

    response = await client.get(
        f"/projects/{project_id}/dashboard",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 200
    charts = {chart["title"]: chart for chart in response.json()["charts"]}
    assert charts["Velocity chart"]["empty_state"]["reason"] == "no_estimated_velocity"
    assert charts["Forecast cone"]["empty_state"]["reason"] == "no_estimated_velocity"
    assert charts["Throughput chart"]["empty_state"] is None
    assert charts["Throughput chart"]["entries"][0]["values"] == {
        "finished_task_count": 1
    }


@pytest.mark.asyncio
async def test_sprint_membership_mutations_append_project_task_change_events(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Dashboard Project", "code": "EV2"},
    )
    project_id = project_response.json()["id"]
    first_task_response = await client.post(
        f"/projects/{project_id}/backlog/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "First task", "story_points": 5},
    )
    sprint_response = await client.post(
        f"/projects/{project_id}/sprints",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-06-01",
            "planned_end_date": "2026-06-14",
            "task_ids": [first_task_response.json()["id"]],
        },
    )
    second_task_response = await client.post(
        f"/projects/{project_id}/backlog/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Second task"},
    )

    add_response = await client.post(
        f"/projects/{project_id}/sprints/active/tasks",
        headers={"Authorization": "Bearer token"},
        json={"task_id": second_task_response.json()["id"]},
    )
    created_sprint_task_response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={
            "title": "Created sprint task",
            "include_in_active_sprint": True,
            "story_points": 3,
        },
    )
    update_response = await client.patch(
        f"/projects/{project_id}/tasks/{created_sprint_task_response.json()['id']}",
        headers={"Authorization": "Bearer token"},
        json={"story_points": 8},
    )
    unchanged_update_response = await client.patch(
        f"/projects/{project_id}/tasks/{created_sprint_task_response.json()['id']}",
        headers={"Authorization": "Bearer token"},
        json={"story_points": 8},
    )
    remove_response = await client.delete(
        f"/projects/{project_id}/sprints/active/tasks/{first_task_response.json()['id']}",
        headers={"Authorization": "Bearer token"},
    )

    assert sprint_response.status_code == 201
    assert add_response.status_code == 200
    assert created_sprint_task_response.status_code == 201
    assert update_response.status_code == 200
    assert unchanged_update_response.status_code == 200
    assert remove_response.status_code == 200
    async with session_factory() as session:
        events = (
            await session.scalars(
                select(ProjectTaskChangeEvent)
                .filter_by(project_id=UUID(project_id))
                .order_by(
                    col(ProjectTaskChangeEvent.occurred_at),
                    col(ProjectTaskChangeEvent.id),
                )
            )
        ).all()

    assert [event.event_type for event in events] == [
        "story_points_changed",
        "sprint_scope_added",
        "sprint_scope_added",
        "story_points_changed",
        "sprint_scope_added",
        "story_points_changed",
        "sprint_scope_removed",
    ]
    assert events[0].task_id == UUID(first_task_response.json()["id"])
    assert events[0].previous_story_points is None
    assert events[0].new_story_points == 5
    assert events[1].task_id == UUID(first_task_response.json()["id"])
    assert events[1].new_story_points == 5
    assert events[2].task_id == UUID(second_task_response.json()["id"])
    assert events[2].new_story_points is None
    assert events[3].task_id == UUID(created_sprint_task_response.json()["id"])
    assert events[3].previous_story_points is None
    assert events[3].new_story_points == 3
    assert events[4].task_id == UUID(created_sprint_task_response.json()["id"])
    assert events[4].new_story_points == 3
    assert events[5].previous_story_points == 3
    assert events[5].new_story_points == 8
    assert events[6].previous_story_points == 5


@pytest.mark.asyncio
async def test_project_dashboard_denies_outsiders_like_project_reads(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Dashboard Project", "code": "DAO"},
    )
    project_id = project_response.json()["id"]

    response = await client.get(
        f"/projects/{project_id}/dashboard",
        headers={"Authorization": "Bearer outsider-token"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Project not found"}


@pytest.mark.asyncio
async def test_project_contract_rejects_priority_and_invalid_status(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    create_with_priority_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "PRI", "priority": "medium"},
    )
    invalid_status_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "BAD", "status": "on-track"},
    )
    create_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "STA"},
    )
    project_id = create_response.json()["id"]
    update_with_priority_response = await client.patch(
        f"/projects/{project_id}",
        headers={"Authorization": "Bearer token"},
        json={"priority": "high"},
    )
    update_status_response = await client.patch(
        f"/projects/{project_id}",
        headers={"Authorization": "Bearer token"},
        json={"status": "blocked"},
    )

    assert create_with_priority_response.status_code == 422
    assert invalid_status_response.status_code == 422
    assert create_response.status_code == 201
    assert create_response.json()["status"] == "active"
    assert update_with_priority_response.status_code == 422
    assert update_status_response.status_code == 200
    assert update_status_response.json()["status"] == "blocked"


@pytest.mark.asyncio
async def test_project_reads_normalize_blank_and_null_status_to_active(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    del users
    blank_status_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Blank Status", "code": "BLS"},
    )
    null_status_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Null Status", "code": "NLS"},
    )
    blank_status_project_id = UUID(blank_status_response.json()["id"])
    null_status_project_id = UUID(null_status_response.json()["id"])

    async with session_factory() as session:
        blank_status_project = await session.get(Project, blank_status_project_id)
        null_status_project = await session.get(Project, null_status_project_id)
        assert blank_status_project is not None
        assert null_status_project is not None
        blank_status_project.status = "   "
        null_status_project.status = None
        await session.commit()

    blank_status_read_response = await client.get(
        f"/projects/{blank_status_project_id}",
        headers={"Authorization": "Bearer token"},
    )
    null_status_read_response = await client.get(
        f"/projects/{null_status_project_id}",
        headers={"Authorization": "Bearer token"},
    )
    list_response = await client.get(
        "/projects",
        headers={"Authorization": "Bearer token"},
    )

    assert blank_status_read_response.status_code == 200
    assert blank_status_read_response.json()["status"] == "active"
    assert null_status_read_response.status_code == 200
    assert null_status_read_response.json()["status"] == "active"
    assert list_response.status_code == 200
    assert {project["status"] for project in list_response.json()} == {"active"}


@pytest.mark.asyncio
async def test_project_update_preserves_omitted_description_and_clears_explicit_null(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    create_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Enterprise Launch",
            "code": "EOM",
            "description": "Launch work",
        },
    )
    project_id = create_response.json()["id"]

    rename_response = await client.patch(
        f"/projects/{project_id}",
        headers={"Authorization": "Bearer token"},
        json={"name": "  Enterprise Launch Updated  "},
    )

    assert rename_response.status_code == 200
    assert rename_response.json()["name"] == "Enterprise Launch Updated"
    assert rename_response.json()["description"] == "Launch work"

    clear_response = await client.patch(
        f"/projects/{project_id}",
        headers={"Authorization": "Bearer token"},
        json={"description": None},
    )

    assert clear_response.status_code == 200
    assert clear_response.json()["description"] is None


@pytest.mark.asyncio
async def test_project_update_rejects_blank_and_null_names(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    create_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "ERJ"},
    )
    project_id = create_response.json()["id"]

    blank_response = await client.patch(
        f"/projects/{project_id}",
        headers={"Authorization": "Bearer token"},
        json={"name": "   "},
    )
    null_response = await client.patch(
        f"/projects/{project_id}",
        headers={"Authorization": "Bearer token"},
        json={"name": None},
    )

    assert blank_response.status_code == 422
    assert null_response.status_code == 422


@pytest.mark.asyncio
async def test_project_chat_history_allows_owners_and_members(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    member_id = users["member"].id
    creator_id = users["creator"].id
    assert member_id is not None
    assert creator_id is not None

    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Enterprise Launch",
            "code": "ENT",
            "member_ids": [str(member_id)],
        },
    )
    project_id = UUID(project_response.json()["id"])
    created_at = datetime(2026, 1, 1, 9, 30, tzinfo=UTC)

    async with session_factory() as session:
        session.add(
            ProjectChatMessage(
                project_id=project_id,
                author_id=creator_id,
                author_display_name="Jane Owner",
                body="Kickoff is ready.",
                created_at=created_at,
            )
        )
        await session.commit()

    owner_response = await client.get(
        f"/projects/{project_id}/chat/messages",
        headers={"Authorization": "Bearer token"},
    )
    member_response = await client.get(
        f"/projects/{project_id}/chat/messages",
        headers={"Authorization": "Bearer member-token"},
    )

    assert owner_response.status_code == 200
    assert member_response.status_code == 200
    assert owner_response.json() == member_response.json()
    message = owner_response.json()[0]
    assert message == {
        "id": message["id"],
        "project_id": str(project_id),
        "body": "Kickoff is ready.",
        "created_at": "2026-01-01T09:30:00",
        "author": {
            "id": str(creator_id),
            "display_name": "Jane Owner",
            "initials": "JO",
            "deleted": False,
        },
    }


@pytest.mark.asyncio
async def test_project_chat_history_denies_outsiders(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    assert users["outsider"].id is not None
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "ENT"},
    )
    project_id = project_response.json()["id"]

    response = await client.get(
        f"/projects/{project_id}/chat/messages",
        headers={"Authorization": "Bearer outsider-token"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Project not found"}


@pytest.mark.asyncio
async def test_project_owner_creates_empty_active_sprint(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "SP1"},
    )
    project_id = project_response.json()["id"]

    response = await client.post(
        f"/projects/{project_id}/sprints",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-06-01",
            "planned_end_date": "2026-06-14",
            "goal": "  Ship sprint planning  ",
        },
    )

    assert response.status_code == 201
    sprint = response.json()
    assert sprint["project_id"] == project_id
    assert sprint["name"] == "Sprint 1"
    assert sprint["lifecycle_state"] == "active"
    assert sprint["planned_start_date"] == "2026-06-01"
    assert sprint["planned_end_date"] == "2026-06-14"
    assert sprint["goal"] == "Ship sprint planning"

    async with session_factory() as session:
        persisted = await session.get(ProjectSprint, UUID(sprint["id"]))

    assert persisted is not None
    assert persisted.name == "Sprint 1"


@pytest.mark.asyncio
async def test_project_participants_can_read_active_sprint_but_only_owners_create(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    member_id = users["member"].id
    assert member_id is not None
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Enterprise Launch",
            "code": "SPR",
            "member_ids": [str(member_id)],
        },
    )
    project_id = project_response.json()["id"]
    create_response = await client.post(
        f"/projects/{project_id}/sprints",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-06-01",
            "planned_end_date": "2026-06-14",
        },
    )

    member_read_response = await client.get(
        f"/projects/{project_id}/sprints/active",
        headers={"Authorization": "Bearer member-token"},
    )
    member_create_response = await client.post(
        f"/projects/{project_id}/sprints",
        headers={"Authorization": "Bearer member-token"},
        json={
            "planned_start_date": "2026-06-15",
            "planned_end_date": "2026-06-28",
        },
    )
    outsider_read_response = await client.get(
        f"/projects/{project_id}/sprints/active",
        headers={"Authorization": "Bearer outsider-token"},
    )

    assert create_response.status_code == 201
    assert member_read_response.status_code == 200
    assert member_read_response.json()["name"] == "Sprint 1"
    assert member_create_response.status_code == 404
    assert outsider_read_response.status_code == 404


@pytest.mark.asyncio
async def test_project_sprint_creation_rejects_invalid_dates_and_second_active_sprint(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "SP2"},
    )
    project_id = project_response.json()["id"]

    invalid_date_response = await client.post(
        f"/projects/{project_id}/sprints",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-06-14",
            "planned_end_date": "2026-06-01",
        },
    )
    first_response = await client.post(
        f"/projects/{project_id}/sprints",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-05-01",
            "planned_end_date": "2026-05-14",
        },
    )
    duplicate_response = await client.post(
        f"/projects/{project_id}/sprints",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-06-01",
            "planned_end_date": "2026-06-14",
        },
    )

    assert invalid_date_response.status_code == 422
    assert invalid_date_response.json() == {
        "detail": "Sprint end date must be on or after start date"
    }
    assert first_response.status_code == 201
    assert duplicate_response.status_code == 409
    assert duplicate_response.json() == {
        "detail": "Project already has an active sprint"
    }


@pytest.mark.asyncio
async def test_project_owner_creates_active_sprint_with_initial_backlog_tasks(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "SP3"},
    )
    project_id = project_response.json()["id"]
    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    todo_column = next(
        column for column in columns_response.json() if column["name"] == "To Do"
    )
    backlog_task_response = await client.post(
        f"/projects/{project_id}/backlog/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Selected backlog task"},
    )

    sprint_response = await client.post(
        f"/projects/{project_id}/sprints",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-06-01",
            "planned_end_date": "2026-06-14",
            "task_ids": [backlog_task_response.json()["id"]],
        },
    )
    sprint_tasks_response = await client.get(
        f"/projects/{project_id}/tasks/active-sprint",
        headers={"Authorization": "Bearer token"},
    )
    backlog_response = await client.get(
        f"/projects/{project_id}/backlog",
        headers={"Authorization": "Bearer token"},
    )

    assert sprint_response.status_code == 201
    sprint_id = sprint_response.json()["id"]
    assert sprint_tasks_response.status_code == 200
    expected_sprint_task = {
        **backlog_task_response.json(),
        "sprint_id": sprint_id,
        "backlog_rank": None,
    }
    actual_sprint_task = sprint_tasks_response.json()[0]
    expected_sprint_task["updated_at"] = actual_sprint_task["updated_at"]
    assert sprint_tasks_response.json() == [
        {
            **expected_sprint_task,
        }
    ]
    assert sprint_tasks_response.json()[0]["column_id"] == todo_column["id"]
    assert backlog_response.json() == []


@pytest.mark.asyncio
async def test_active_sprint_task_list_filters_project_tasks_by_sprint_membership(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "SB1"},
    )
    project_id = project_response.json()["id"]
    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    todo_column = next(
        column for column in columns_response.json() if column["name"] == "To Do"
    )
    sprint_response = await client.post(
        f"/projects/{project_id}/sprints",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-06-01",
            "planned_end_date": "2026-06-14",
        },
    )
    sprint_id = sprint_response.json()["id"]
    sprint_task_response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={
            "title": "Sprint task",
            "column_id": todo_column["id"],
            "include_in_active_sprint": True,
        },
    )
    backlog_task_response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Backlog task", "column_id": todo_column["id"]},
    )

    all_tasks_response = await client.get(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
    )
    sprint_tasks_response = await client.get(
        f"/projects/{project_id}/tasks/active-sprint",
        headers={"Authorization": "Bearer token"},
    )

    assert sprint_task_response.status_code == 201
    assert sprint_task_response.json()["sprint_id"] == sprint_id
    assert backlog_task_response.status_code == 201
    assert backlog_task_response.json()["sprint_id"] is None
    assert {task["title"] for task in all_tasks_response.json()} == {
        "Sprint task",
        "Backlog task",
    }
    assert [task["title"] for task in sprint_tasks_response.json()] == ["Sprint task"]


@pytest.mark.asyncio
async def test_sprint_task_creation_without_column_uses_first_non_done_column(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "SB2"},
    )
    project_id = project_response.json()["id"]
    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    todo_column = next(
        column for column in columns_response.json() if column["name"] == "To Do"
    )
    done_column = next(
        column for column in columns_response.json() if column["name"] == "Done"
    )
    await client.patch(
        f"/projects/{project_id}/done-column",
        headers={"Authorization": "Bearer token"},
        json={"done_column_id": done_column["id"]},
    )
    sprint_response = await client.post(
        f"/projects/{project_id}/sprints",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-06-01",
            "planned_end_date": "2026-06-14",
        },
    )

    response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "General sprint task", "include_in_active_sprint": True},
    )

    assert response.status_code == 201
    task = response.json()
    assert task["sprint_id"] == sprint_response.json()["id"]
    assert task["column_id"] == todo_column["id"]


@pytest.mark.asyncio
async def test_sprint_task_creation_requires_active_sprint(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "SB3"},
    )
    project_id = project_response.json()["id"]

    response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Missing sprint task", "include_in_active_sprint": True},
    )
    list_response = await client.get(
        f"/projects/{project_id}/tasks/active-sprint",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Project has no active sprint"}
    assert list_response.status_code == 404
    assert list_response.json() == {"detail": "Active sprint not found"}


@pytest.mark.asyncio
async def test_project_member_adds_backlog_task_to_active_sprint_preserving_column(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    member_id = users["member"].id
    assert member_id is not None
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Enterprise Launch",
            "code": "SB4",
            "member_ids": [str(member_id)],
        },
    )
    project_id = project_response.json()["id"]
    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    todo_column = next(
        column for column in columns_response.json() if column["name"] == "To Do"
    )
    backlog_task_response = await client.post(
        f"/projects/{project_id}/backlog/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Member selected task", "column_id": todo_column["id"]},
    )
    sprint_response = await client.post(
        f"/projects/{project_id}/sprints",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-06-01",
            "planned_end_date": "2026-06-14",
        },
    )

    add_response = await client.post(
        f"/projects/{project_id}/sprints/active/tasks",
        headers={"Authorization": "Bearer member-token"},
        json={"task_id": backlog_task_response.json()["id"]},
    )
    backlog_response = await client.get(
        f"/projects/{project_id}/backlog",
        headers={"Authorization": "Bearer member-token"},
    )
    outsider_response = await client.post(
        f"/projects/{project_id}/sprints/active/tasks",
        headers={"Authorization": "Bearer outsider-token"},
        json={"task_id": backlog_task_response.json()["id"]},
    )

    assert add_response.status_code == 200
    assert add_response.json()["sprint_id"] == sprint_response.json()["id"]
    assert add_response.json()["column_id"] == todo_column["id"]
    assert add_response.json()["rank"] == backlog_task_response.json()["rank"]
    assert add_response.json()["backlog_rank"] is None
    assert backlog_response.json() == []
    assert outsider_response.status_code == 404


@pytest.mark.asyncio
async def test_done_backlog_task_cannot_be_added_to_active_sprint(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "SB5"},
    )
    project_id = project_response.json()["id"]
    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    done_column = next(
        column for column in columns_response.json() if column["name"] == "Done"
    )
    await client.patch(
        f"/projects/{project_id}/done-column",
        headers={"Authorization": "Bearer token"},
        json={"done_column_id": done_column["id"]},
    )
    await client.post(
        f"/projects/{project_id}/sprints",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-06-01",
            "planned_end_date": "2026-06-14",
        },
    )
    done_task_response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Finished task", "column_id": done_column["id"]},
    )

    response = await client.post(
        f"/projects/{project_id}/sprints/active/tasks",
        headers={"Authorization": "Bearer token"},
        json={"task_id": done_task_response.json()["id"]},
    )

    assert response.status_code == 422
    assert response.json() == {
        "detail": "Done tasks cannot be added to the active sprint"
    }


@pytest.mark.asyncio
async def test_project_member_removes_active_sprint_task_to_top_of_backlog(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    member_id = users["member"].id
    assert member_id is not None
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Enterprise Launch",
            "code": "SB6",
            "member_ids": [str(member_id)],
        },
    )
    project_id = project_response.json()["id"]
    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    todo_column = next(
        column for column in columns_response.json() if column["name"] == "To Do"
    )
    await client.post(
        f"/projects/{project_id}/sprints",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-06-01",
            "planned_end_date": "2026-06-14",
        },
    )
    existing_backlog_response = await client.post(
        f"/projects/{project_id}/backlog/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Existing backlog"},
    )
    sprint_task_response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={
            "title": "Removed sprint task",
            "column_id": todo_column["id"],
            "include_in_active_sprint": True,
        },
    )

    remove_response = await client.delete(
        f"/projects/{project_id}/sprints/active/tasks/{sprint_task_response.json()['id']}",
        headers={"Authorization": "Bearer member-token"},
    )
    active_sprint_response = await client.get(
        f"/projects/{project_id}/tasks/active-sprint",
        headers={"Authorization": "Bearer member-token"},
    )
    backlog_response = await client.get(
        f"/projects/{project_id}/backlog",
        headers={"Authorization": "Bearer member-token"},
    )
    outsider_response = await client.delete(
        f"/projects/{project_id}/sprints/active/tasks/{sprint_task_response.json()['id']}",
        headers={"Authorization": "Bearer outsider-token"},
    )

    assert remove_response.status_code == 200
    assert remove_response.json()["sprint_id"] is None
    assert remove_response.json()["column_id"] == todo_column["id"]
    assert remove_response.json()["rank"] == sprint_task_response.json()["rank"]
    assert (
        remove_response.json()["backlog_rank"]
        < existing_backlog_response.json()["backlog_rank"]
    )
    assert active_sprint_response.json() == []
    assert [task["title"] for task in backlog_response.json()] == [
        "Removed sprint task",
        "Existing backlog",
    ]
    assert outsider_response.status_code == 404


@pytest.mark.asyncio
async def test_remove_from_active_sprint_rejects_non_sprint_tasks(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "SB7"},
    )
    project_id = project_response.json()["id"]
    await client.post(
        f"/projects/{project_id}/sprints",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-06-01",
            "planned_end_date": "2026-06-14",
        },
    )
    backlog_task_response = await client.post(
        f"/projects/{project_id}/backlog/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Backlog only"},
    )

    response = await client.delete(
        f"/projects/{project_id}/sprints/active/tasks/{backlog_task_response.json()['id']}",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Task is not in the active sprint"}


@pytest.mark.asyncio
async def test_project_backlog_lists_unfinished_non_sprint_tasks_in_backlog_order(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "BL1"},
    )
    project_id = project_response.json()["id"]
    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    todo_column = next(
        column for column in columns_response.json() if column["name"] == "To Do"
    )
    done_column = next(
        column for column in columns_response.json() if column["name"] == "Done"
    )
    await client.patch(
        f"/projects/{project_id}/done-column",
        headers={"Authorization": "Bearer token"},
        json={"done_column_id": done_column["id"]},
    )
    await client.post(
        f"/projects/{project_id}/sprints",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-06-01",
            "planned_end_date": "2026-06-14",
        },
    )
    first_response = await client.post(
        f"/projects/{project_id}/backlog/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "First backlog task"},
    )
    second_response = await client.post(
        f"/projects/{project_id}/backlog/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Second backlog task"},
    )
    sprint_response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={
            "title": "Sprint task",
            "column_id": todo_column["id"],
            "include_in_active_sprint": True,
        },
    )
    done_task_response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Done task", "column_id": done_column["id"]},
    )

    backlog_response = await client.get(
        f"/projects/{project_id}/backlog",
        headers={"Authorization": "Bearer token"},
    )

    assert first_response.status_code == 201
    assert second_response.status_code == 201
    assert second_response.json()["column_id"] == todo_column["id"]
    assert (
        second_response.json()["backlog_rank"] < first_response.json()["backlog_rank"]
    )
    assert sprint_response.json()["sprint_id"] is not None
    assert done_task_response.json()["column_id"] == done_column["id"]
    assert [task["title"] for task in backlog_response.json()] == [
        "Second backlog task",
        "First backlog task",
    ]


@pytest.mark.asyncio
async def test_project_backlog_reorder_persists_independent_of_board_rank(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "BL2"},
    )
    project_id = project_response.json()["id"]
    first_response = await client.post(
        f"/projects/{project_id}/backlog/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "First"},
    )
    second_response = await client.post(
        f"/projects/{project_id}/backlog/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Second"},
    )
    first_id = first_response.json()["id"]
    second_id = second_response.json()["id"]

    reorder_response = await client.put(
        f"/projects/{project_id}/backlog/reorder",
        headers={"Authorization": "Bearer token"},
        json={"task_ids": [first_id, second_id]},
    )
    refetch_response = await client.get(
        f"/projects/{project_id}/backlog",
        headers={"Authorization": "Bearer token"},
    )

    assert reorder_response.status_code == 200
    assert [task["id"] for task in reorder_response.json()] == [first_id, second_id]
    assert [task["id"] for task in refetch_response.json()] == [first_id, second_id]
    assert refetch_response.json()[0]["rank"] == first_response.json()["rank"]


@pytest.mark.asyncio
async def test_project_backlog_reorder_requires_complete_backlog_task_set(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "BL3"},
    )
    project_id = project_response.json()["id"]
    first_response = await client.post(
        f"/projects/{project_id}/backlog/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "First"},
    )
    await client.post(
        f"/projects/{project_id}/backlog/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Second"},
    )

    response = await client.put(
        f"/projects/{project_id}/backlog/reorder",
        headers={"Authorization": "Bearer token"},
        json={"task_ids": [first_response.json()["id"]]},
    )

    assert response.status_code == 422
    assert response.json() == {
        "detail": "Backlog reorder must include each backlog task exactly once"
    }


@pytest.mark.asyncio
async def test_project_backlog_bulk_create_persists_dependency_edges(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "BL4"},
    )
    project_id = project_response.json()["id"]
    existing_response = await client.post(
        f"/projects/{project_id}/backlog/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Existing discovery"},
    )

    response = await client.post(
        f"/projects/{project_id}/backlog/tasks/bulk",
        headers={"Authorization": "Bearer token"},
        json={
            "tasks": [
                {
                    "key": "api",
                    "title": "Build auth API",
                    "acceptance_criteria": "API returns session",
                    "prerequisites": [],
                },
                {
                    "key": "ui",
                    "title": "Build login UI",
                    "description": "Wire login form",
                    "prerequisites": [
                        {"type": "draft", "key": "api"},
                        {
                            "type": "existing",
                            "task_id": existing_response.json()["id"],
                        },
                    ],
                },
            ]
        },
    )
    refetch_response = await client.get(
        f"/projects/{project_id}/backlog",
        headers={"Authorization": "Bearer token"},
    )
    await client.post(
        f"/projects/{project_id}/sprints",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-06-01",
            "planned_end_date": "2026-06-14",
        },
    )

    assert response.status_code == 201
    created = response.json()
    assert [task["title"] for task in created] == ["Build auth API", "Build login UI"]
    assert set(created[1]["prerequisite_task_ids"]) == {
        created[0]["id"],
        existing_response.json()["id"],
    }
    sprint_add_response = await client.post(
        f"/projects/{project_id}/sprints/active/tasks",
        headers={"Authorization": "Bearer token"},
        json={"task_id": created[1]["id"]},
    )
    assert set(sprint_add_response.json()["prerequisite_task_ids"]) == {
        created[0]["id"],
        existing_response.json()["id"],
    }
    assert [task["title"] for task in refetch_response.json()][:2] == [
        "Build auth API",
        "Build login UI",
    ]
    async with session_factory() as session:
        edges = list(
            (
                await session.scalars(
                    select(TaskDependency).filter_by(project_id=UUID(project_id))
                )
            ).all()
        )
    assert len(edges) == 2


@pytest.mark.parametrize(
    ("drafts", "detail"),
    [
        (
            [
                {
                    "key": "api",
                    "title": "Build auth API",
                    "prerequisites": [{"type": "draft", "key": "api"}],
                }
            ],
            "Task cannot depend on itself",
        ),
        (
            [
                {
                    "key": "ui",
                    "title": "Build login UI",
                    "prerequisites": [{"type": "draft", "key": "missing"}],
                }
            ],
            "Invalid prerequisite reference",
        ),
        (
            [
                {
                    "key": "ui",
                    "title": "Build login UI",
                    "prerequisites": [
                        {"type": "draft", "key": "api"},
                        {"type": "draft", "key": "api"},
                    ],
                },
                {"key": "api", "title": "Build auth API", "prerequisites": []},
            ],
            "Duplicate prerequisite reference",
        ),
    ],
)
@pytest.mark.asyncio
async def test_project_backlog_bulk_create_rejects_invalid_prerequisites_atomically(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
    drafts: list[dict[str, object]],
    detail: str,
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "BL8"},
    )
    project_id = project_response.json()["id"]

    response = await client.post(
        f"/projects/{project_id}/backlog/tasks/bulk",
        headers={"Authorization": "Bearer token"},
        json={"tasks": drafts},
    )
    backlog_response = await client.get(
        f"/projects/{project_id}/backlog",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 422
    assert response.json() == {"detail": detail}
    assert backlog_response.json() == []
    async with session_factory() as session:
        edge_count = len(
            (
                await session.scalars(
                    select(TaskDependency).filter_by(project_id=UUID(project_id))
                )
            ).all()
        )
    assert edge_count == 0


@pytest.mark.asyncio
async def test_project_backlog_bulk_create_rejects_non_member_assignee(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    assignee_id = users["assignee"].id
    assert assignee_id is not None
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "BL7"},
    )
    project_id = project_response.json()["id"]

    response = await client.post(
        f"/projects/{project_id}/backlog/tasks/bulk",
        headers={"Authorization": "Bearer token"},
        json={
            "tasks": [
                {
                    "key": "api",
                    "title": "Build auth API",
                    "assignee_id": str(assignee_id),
                    "prerequisites": [],
                }
            ]
        },
    )
    backlog_response = await client.get(
        f"/projects/{project_id}/backlog",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Assignee must belong to the project"}
    assert backlog_response.json() == []


@pytest.mark.asyncio
async def test_project_backlog_read_does_not_leak_cross_project_dependency_edges(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "BL6"},
    )
    other_project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Other", "code": "OTH"},
    )
    task_response = await client.post(
        f"/projects/{project_response.json()['id']}/backlog/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Current task"},
    )
    other_task_response = await client.post(
        f"/projects/{other_project_response.json()['id']}/backlog/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Other task"},
    )
    async with session_factory() as session:
        session.add(
            TaskDependency(
                project_id=UUID(project_response.json()["id"]),
                dependent_task_id=UUID(task_response.json()["id"]),
                prerequisite_task_id=UUID(other_task_response.json()["id"]),
            )
        )
        await session.commit()

    response = await client.get(
        f"/projects/{project_response.json()['id']}/backlog",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 200
    assert response.json()[0]["prerequisite_task_ids"] == []


@pytest.mark.asyncio
async def test_project_backlog_bulk_create_rejects_cycles_atomically(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "BL5"},
    )
    project_id = project_response.json()["id"]

    response = await client.post(
        f"/projects/{project_id}/backlog/tasks/bulk",
        headers={"Authorization": "Bearer token"},
        json={
            "tasks": [
                {
                    "key": "api",
                    "title": "Build auth API",
                    "prerequisites": [{"type": "draft", "key": "ui"}],
                },
                {
                    "key": "ui",
                    "title": "Build login UI",
                    "prerequisites": [{"type": "draft", "key": "api"}],
                },
            ]
        },
    )
    backlog_response = await client.get(
        f"/projects/{project_id}/backlog",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Task dependencies cannot contain cycles"}
    assert backlog_response.json() == []
    async with session_factory() as session:
        edge_count = len(
            (
                await session.scalars(
                    select(TaskDependency).filter_by(project_id=UUID(project_id))
                )
            ).all()
        )
    assert edge_count == 0


@pytest.mark.asyncio
async def test_project_done_column_auto_detects_single_done_column(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "DC1"},
    )
    project_id = UUID(project_response.json()["id"])
    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    done_column = next(
        column for column in columns_response.json() if column["name"] == "Done"
    )

    response = await client.get(
        f"/projects/{project_id}/done-column",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "project_id": str(project_id),
        "done_column_id": done_column["id"],
        "requires_designation": False,
    }
    async with session_factory() as session:
        project = await session.get(Project, project_id)

    assert project is not None
    assert project.done_column_id == UUID(done_column["id"])


@pytest.mark.asyncio
async def test_project_done_column_requires_designation_when_done_name_is_missing(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "DC2"},
    )
    project_id = project_response.json()["id"]
    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    done_column = next(
        column for column in columns_response.json() if column["name"] == "Done"
    )
    await client.patch(
        f"/projects/{project_id}/columns/{done_column['id']}",
        headers={"Authorization": "Bearer token"},
        json={"name": "Complete", "description": None},
    )

    response = await client.get(
        f"/projects/{project_id}/done-column",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "project_id": project_id,
        "done_column_id": None,
        "requires_designation": True,
    }


@pytest.mark.asyncio
async def test_project_owner_updates_done_column_and_members_cannot(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    member_id = users["member"].id
    assert member_id is not None
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Enterprise Launch",
            "code": "DC3",
            "member_ids": [str(member_id)],
        },
    )
    project_id = project_response.json()["id"]
    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    todo_column = next(
        column for column in columns_response.json() if column["name"] == "To Do"
    )

    owner_response = await client.patch(
        f"/projects/{project_id}/done-column",
        headers={"Authorization": "Bearer token"},
        json={"done_column_id": todo_column["id"]},
    )
    member_response = await client.patch(
        f"/projects/{project_id}/done-column",
        headers={"Authorization": "Bearer member-token"},
        json={"done_column_id": todo_column["id"]},
    )
    member_get_response = await client.get(
        f"/projects/{project_id}/done-column",
        headers={"Authorization": "Bearer member-token"},
    )

    assert owner_response.status_code == 200
    assert owner_response.json()["done_column_id"] == todo_column["id"]
    assert owner_response.json()["requires_designation"] is False
    assert member_response.status_code == 404
    assert member_get_response.status_code == 200
    assert member_get_response.json()["done_column_id"] == todo_column["id"]


@pytest.mark.asyncio
async def test_current_done_column_deletion_is_blocked_until_reassigned(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "DC4"},
    )
    project_id = project_response.json()["id"]
    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    done_column = next(
        column for column in columns_response.json() if column["name"] == "Done"
    )
    todo_column = next(
        column for column in columns_response.json() if column["name"] == "To Do"
    )
    await client.get(
        f"/projects/{project_id}/done-column",
        headers={"Authorization": "Bearer token"},
    )

    blocked_response = await client.delete(
        f"/projects/{project_id}/columns/{done_column['id']}",
        headers={"Authorization": "Bearer token"},
    )
    await client.patch(
        f"/projects/{project_id}/done-column",
        headers={"Authorization": "Bearer token"},
        json={"done_column_id": todo_column["id"]},
    )
    delete_response = await client.delete(
        f"/projects/{project_id}/columns/{done_column['id']}",
        headers={"Authorization": "Bearer token"},
    )

    assert blocked_response.status_code == 409
    assert blocked_response.json() == {
        "detail": "Designate another Done Column before deleting this column"
    }
    assert delete_response.status_code == 204


@pytest.mark.asyncio
async def test_project_owner_updates_active_sprint_dates_and_goal(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "SE1"},
    )
    project_id = project_response.json()["id"]
    await client.post(
        f"/projects/{project_id}/sprints",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-06-01",
            "planned_end_date": "2026-06-14",
            "goal": "Initial goal",
        },
    )

    update_response = await client.patch(
        f"/projects/{project_id}/sprints/active",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-05-30",
            "planned_end_date": "2026-06-12",
            "goal": "  Updated goal  ",
        },
    )
    clear_goal_response = await client.patch(
        f"/projects/{project_id}/sprints/active",
        headers={"Authorization": "Bearer token"},
        json={"goal": None},
    )

    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["name"] == "Sprint 1"
    assert updated["lifecycle_state"] == "active"
    assert updated["planned_start_date"] == "2026-05-30"
    assert updated["planned_end_date"] == "2026-06-12"
    assert updated["goal"] == "Updated goal"
    assert clear_goal_response.status_code == 200
    assert clear_goal_response.json()["goal"] is None


@pytest.mark.asyncio
async def test_active_sprint_update_rejects_invalid_ranges_and_non_owners(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    member_id = users["member"].id
    assert member_id is not None
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Enterprise Launch",
            "code": "SE2",
            "member_ids": [str(member_id)],
        },
    )
    project_id = project_response.json()["id"]
    await client.post(
        f"/projects/{project_id}/sprints",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-06-01",
            "planned_end_date": "2026-06-14",
        },
    )

    invalid_response = await client.patch(
        f"/projects/{project_id}/sprints/active",
        headers={"Authorization": "Bearer token"},
        json={"planned_start_date": "2026-06-15"},
    )
    member_response = await client.patch(
        f"/projects/{project_id}/sprints/active",
        headers={"Authorization": "Bearer member-token"},
        json={"goal": "Member edit"},
    )

    assert invalid_response.status_code == 422
    assert invalid_response.json() == {
        "detail": "Sprint end date must be on or after start date"
    }
    assert member_response.status_code == 404


@pytest.mark.asyncio
async def test_closed_sprint_metadata_is_not_editable_through_active_endpoint(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "SE3"},
    )
    project_id = UUID(project_response.json()["id"])
    create_response = await client.post(
        f"/projects/{project_id}/sprints",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-06-01",
            "planned_end_date": "2026-06-14",
            "goal": "Closed goal",
        },
    )
    sprint_id = UUID(create_response.json()["id"])
    async with session_factory() as session:
        sprint = await session.get(ProjectSprint, sprint_id)
        assert sprint is not None
        sprint.lifecycle_state = SprintLifecycleState.CLOSED
        await session.commit()

    response = await client.patch(
        f"/projects/{project_id}/sprints/active",
        headers={"Authorization": "Bearer token"},
        json={"goal": "Changed after close"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Active sprint not found"}
    async with session_factory() as session:
        sprint = await session.get(ProjectSprint, sprint_id)

    assert sprint is not None
    assert sprint.lifecycle_state == SprintLifecycleState.CLOSED
    assert sprint.goal == "Closed goal"


@pytest.mark.asyncio
async def test_active_sprint_close_confirmation_counts_finished_and_unfinished(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "SC1"},
    )
    project_id = project_response.json()["id"]
    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    todo_column = next(
        column for column in columns_response.json() if column["name"] == "To Do"
    )
    done_column = next(
        column for column in columns_response.json() if column["name"] == "Done"
    )
    await client.patch(
        f"/projects/{project_id}/done-column",
        headers={"Authorization": "Bearer token"},
        json={"done_column_id": done_column["id"]},
    )
    sprint_response = await client.post(
        f"/projects/{project_id}/sprints",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-06-01",
            "planned_end_date": "2026-06-14",
            "goal": "Close goal",
        },
    )
    await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={
            "title": "Unfinished",
            "column_id": todo_column["id"],
            "include_in_active_sprint": True,
        },
    )
    await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={
            "title": "Finished",
            "column_id": done_column["id"],
            "include_in_active_sprint": True,
        },
    )

    response = await client.get(
        f"/projects/{project_id}/sprints/active/close-confirmation",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 200
    confirmation = response.json()
    assert confirmation["sprint"]["id"] == sprint_response.json()["id"]
    assert confirmation["sprint"]["name"] == "Sprint 1"
    assert confirmation["sprint"]["planned_start_date"] == "2026-06-01"
    assert confirmation["sprint"]["planned_end_date"] == "2026-06-14"
    assert confirmation["finished_count"] == 1
    assert confirmation["unfinished_count"] == 1
    assert [task["title"] for task in confirmation["unfinished_tasks"]] == [
        "Unfinished"
    ]
    assert "top of the Backlog" in confirmation["carryover_statement"]


@pytest.mark.asyncio
async def test_project_owner_closes_active_sprint_with_snapshots_and_carryover(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    member_id = users["member"].id
    assert member_id is not None
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Enterprise Launch",
            "code": "SC2",
            "member_ids": [str(member_id)],
        },
    )
    project_id = project_response.json()["id"]
    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    todo_column = next(
        column for column in columns_response.json() if column["name"] == "To Do"
    )
    done_column = next(
        column for column in columns_response.json() if column["name"] == "Done"
    )
    await client.patch(
        f"/projects/{project_id}/done-column",
        headers={"Authorization": "Bearer token"},
        json={"done_column_id": done_column["id"]},
    )
    sprint_response = await client.post(
        f"/projects/{project_id}/sprints",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-06-01",
            "planned_end_date": "2026-06-14",
        },
    )
    existing_backlog_response = await client.post(
        f"/projects/{project_id}/backlog/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Existing backlog"},
    )
    first_unfinished_response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={
            "title": "First unfinished",
            "column_id": todo_column["id"],
            "story_points": 5,
            "description": "Close-time notes",
            "include_in_active_sprint": True,
        },
    )
    second_unfinished_response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={
            "title": "Second unfinished",
            "column_id": todo_column["id"],
            "story_points": 8,
            "include_in_active_sprint": True,
        },
    )
    finished_response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={
            "title": "Finished task",
            "column_id": done_column["id"],
            "story_points": 3,
            "include_in_active_sprint": True,
        },
    )
    removed_response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={
            "title": "Removed before close",
            "column_id": todo_column["id"],
            "include_in_active_sprint": True,
        },
    )
    await client.delete(
        f"/projects/{project_id}/sprints/active/tasks/{removed_response.json()['id']}",
        headers={"Authorization": "Bearer token"},
    )

    member_close_response = await client.post(
        f"/projects/{project_id}/sprints/active/close",
        headers={"Authorization": "Bearer member-token"},
    )
    close_response = await client.post(
        f"/projects/{project_id}/sprints/active/close",
        headers={"Authorization": "Bearer token"},
    )
    active_sprint_response = await client.get(
        f"/projects/{project_id}/sprints/active",
        headers={"Authorization": "Bearer token"},
    )
    backlog_response = await client.get(
        f"/projects/{project_id}/backlog",
        headers={"Authorization": "Bearer token"},
    )

    assert member_close_response.status_code == 404
    assert close_response.status_code == 200
    close_payload = close_response.json()
    assert close_payload["sprint"]["id"] == sprint_response.json()["id"]
    assert close_payload["sprint"]["lifecycle_state"] == "closed"
    assert close_payload["sprint"]["closed_at"] is not None
    assert close_payload["finished_count"] == 1
    assert close_payload["unfinished_count"] == 2
    assert [snapshot["title"] for snapshot in close_payload["snapshots"]] == [
        "First unfinished",
        "Second unfinished",
        "Finished task",
    ]
    assert {
        snapshot["title"]: snapshot["outcome"]
        for snapshot in close_payload["snapshots"]
    } == {
        "First unfinished": "unfinished",
        "Second unfinished": "unfinished",
        "Finished task": "finished",
    }
    assert {
        snapshot["title"]: snapshot["story_points"]
        for snapshot in close_payload["snapshots"]
    } == {
        "First unfinished": 5,
        "Second unfinished": 8,
        "Finished task": 3,
    }
    assert active_sprint_response.json() is None
    assert [task["title"] for task in backlog_response.json()][:3] == [
        "First unfinished",
        "Second unfinished",
        "Removed before close",
    ]
    assert (
        backlog_response.json()[0]["backlog_rank"]
        < existing_backlog_response.json()["backlog_rank"]
    )
    assert backlog_response.json()[0]["column_id"] == todo_column["id"]

    async with session_factory() as session:
        first_task = await session.get(
            Task, UUID(first_unfinished_response.json()["id"])
        )
        second_task = await session.get(
            Task, UUID(second_unfinished_response.json()["id"])
        )
        finished_task = await session.get(Task, UUID(finished_response.json()["id"]))
        snapshots = (
            await session.scalars(
                select(ProjectSprintTaskSnapshot).filter_by(
                    sprint_id=UUID(sprint_response.json()["id"])
                )
            )
        ).all()
        completion_events = (
            await session.scalars(
                select(ProjectTaskChangeEvent)
                .filter_by(
                    project_id=UUID(project_id),
                    event_type="sprint_task_finished",
                )
                .order_by(col(ProjectTaskChangeEvent.occurred_at))
            )
        ).all()
        assert first_task is not None
        assert second_task is not None
        assert finished_task is not None
        assert first_task.sprint_id is None
        assert second_task.sprint_id is None
        assert finished_task.sprint_id == UUID(sprint_response.json()["id"])
        assert [event.task_id for event in completion_events] == [
            UUID(finished_response.json()["id"])
        ]
        assert completion_events[0].sprint_id == UUID(sprint_response.json()["id"])
        assert completion_events[0].new_story_points == 3
        first_task.title = "Edited after close"
        await session.delete(first_task)
        await session.commit()

    assert {snapshot.title for snapshot in snapshots} == {
        "First unfinished",
        "Second unfinished",
        "Finished task",
    }
    assert {snapshot.title: snapshot.story_points for snapshot in snapshots} == {
        "First unfinished": 5,
        "Second unfinished": 8,
        "Finished task": 3,
    }
    assert all(snapshot.title != "Removed before close" for snapshot in snapshots)

    await client.patch(
        f"/projects/{project_id}/tasks/{second_unfinished_response.json()['id']}",
        headers={"Authorization": "Bearer token"},
        json={"story_points": 13},
    )
    await client.patch(
        f"/projects/{project_id}/tasks/{finished_response.json()['id']}",
        headers={"Authorization": "Bearer token"},
        json={"story_points": 1},
    )

    async with session_factory() as session:
        persisted_snapshots = (
            await session.scalars(
                select(ProjectSprintTaskSnapshot).filter_by(
                    sprint_id=UUID(sprint_response.json()["id"])
                )
            )
        ).all()

    assert {snapshot.title for snapshot in persisted_snapshots} == {
        "First unfinished",
        "Second unfinished",
        "Finished task",
    }
    assert {
        snapshot.title: snapshot.story_points for snapshot in persisted_snapshots
    } == {
        "First unfinished": 5,
        "Second unfinished": 8,
        "Finished task": 3,
    }

    await client.patch(
        f"/projects/{project_id}/done-column",
        headers={"Authorization": "Bearer token"},
        json={"done_column_id": todo_column["id"]},
    )
    history_response = await client.get(
        f"/projects/{project_id}/sprints/history",
        headers={"Authorization": "Bearer member-token"},
    )
    outsider_history_response = await client.get(
        f"/projects/{project_id}/sprints/history",
        headers={"Authorization": "Bearer outsider-token"},
    )

    assert history_response.status_code == 200
    assert outsider_history_response.status_code == 404
    history = history_response.json()
    assert len(history) == 1
    assert history[0]["sprint"]["id"] == sprint_response.json()["id"]
    assert history[0]["finished_count"] == 1
    assert history[0]["unfinished_count"] == 2
    assert {
        snapshot["title"]: (
            snapshot["outcome"],
            snapshot["story_points"],
            snapshot["live_task_exists"],
        )
        for snapshot in history[0]["snapshots"]
    } == {
        "First unfinished": ("unfinished", 5, False),
        "Second unfinished": ("unfinished", 8, True),
        "Finished task": ("finished", 3, True),
    }

    dashboard_response = await client.get(
        f"/projects/{project_id}/dashboard",
        headers={"Authorization": "Bearer member-token"},
    )

    assert dashboard_response.status_code == 200
    dashboard_charts = {
        chart["title"]: chart for chart in dashboard_response.json()["charts"]
    }
    velocity = dashboard_charts["Velocity chart"]
    assert velocity["empty_state"] is None
    assert velocity["entries"][0]["values"] == {
        "completed_story_points": 3,
        "finished_task_count": 1,
        "unestimated_finished_tasks": 0,
    }


@pytest.mark.asyncio
async def test_subsequent_sprint_creation_uses_next_name_and_rejects_overlap(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "SC3"},
    )
    project_id = project_response.json()["id"]
    first_response = await client.post(
        f"/projects/{project_id}/sprints",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-06-01",
            "planned_end_date": "2026-06-14",
        },
    )
    await client.post(
        f"/projects/{project_id}/sprints/active/close",
        headers={"Authorization": "Bearer token"},
    )

    overlap_response = await client.post(
        f"/projects/{project_id}/sprints",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-06-14",
            "planned_end_date": "2026-06-28",
        },
    )
    second_response = await client.post(
        f"/projects/{project_id}/sprints",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-06-15",
            "planned_end_date": "2026-06-28",
        },
    )
    other_project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Other Launch", "code": "SC4"},
    )
    other_first_response = await client.post(
        f"/projects/{other_project_response.json()['id']}/sprints",
        headers={"Authorization": "Bearer token"},
        json={
            "planned_start_date": "2026-06-01",
            "planned_end_date": "2026-06-14",
        },
    )

    assert first_response.json()["name"] == "Sprint 1"
    assert overlap_response.status_code == 422
    assert overlap_response.json() == {
        "detail": "Sprint timebox overlaps an existing sprint"
    }
    assert second_response.status_code == 201
    assert second_response.json()["name"] == "Sprint 2"
    assert other_first_response.json()["name"] == "Sprint 1"


@pytest.mark.asyncio
async def test_project_chat_socket_denies_missing_subprotocol_token(
    client: AsyncClient,
    websocket_client: TestClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "ENT"},
    )
    project_id = project_response.json()["id"]

    with pytest.raises(WebSocketDisconnect) as exc_info:
        with websocket_client.websocket_connect(
            f"/projects/{project_id}/chat/socket",
            subprotocols=["kanai.project-chat"],
        ):
            pass

    assert exc_info.value.code == 1008


@pytest.mark.asyncio
async def test_project_chat_socket_denies_invalid_subprotocol_token(
    client: AsyncClient,
    websocket_client: TestClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "ENT"},
    )
    project_id = project_response.json()["id"]

    with pytest.raises(WebSocketDisconnect) as exc_info:
        with websocket_client.websocket_connect(
            f"/projects/{project_id}/chat/socket",
            subprotocols=["kanai.project-chat", "bearer.invalid-token"],
        ):
            pass

    assert exc_info.value.code == 1008


@pytest.mark.asyncio
async def test_project_chat_socket_denies_users_without_project_access(
    client: AsyncClient,
    websocket_client: TestClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "ENT"},
    )
    project_id = project_response.json()["id"]

    with pytest.raises(WebSocketDisconnect) as exc_info:
        with websocket_client.websocket_connect(
            f"/projects/{project_id}/chat/socket",
            subprotocols=["kanai.project-chat", "bearer.outsider-token"],
        ):
            pass

    assert exc_info.value.code == 1008


@pytest.mark.asyncio
async def test_project_chat_socket_allows_owner_and_member_connections(
    client: AsyncClient,
    websocket_client: TestClient,
    users: dict[str, User],
) -> None:
    member_id = users["member"].id
    assert member_id is not None
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Enterprise Launch",
            "code": "ENT",
            "member_ids": [str(member_id)],
        },
    )
    project_id = project_response.json()["id"]

    for token in ["token", "member-token"]:
        with websocket_client.websocket_connect(
            f"/projects/{project_id}/chat/socket",
            subprotocols=["kanai.project-chat", f"bearer.{token}"],
        ) as websocket:
            assert websocket.accepted_subprotocol == "kanai.project-chat"
            assert websocket.receive_json() == {
                "type": "ready",
                "project_id": project_id,
            }
            websocket.send_text("not-json")
            assert websocket.receive_json() == {
                "type": "error",
                "error": {
                    "code": "invalid_json",
                    "message": "Chat events must be valid JSON.",
                },
            }


@pytest.mark.asyncio
async def test_project_chat_service_creates_trimmed_persisted_messages_for_members(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    member = users["member"]
    member.preferred_username = "member-name"
    member.display_name = "Member Display"
    member_id = member.id
    assert member_id is not None
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Enterprise Launch",
            "code": "ENT",
            "member_ids": [str(member_id)],
        },
    )
    project_id = UUID(project_response.json()["id"])

    async with session_factory() as session:
        message = await ProjectChatService(session).create_text_message(
            project_id,
            member,
            "  Ready for review.\nPlease check the notes.  ",
        )

    async with session_factory() as session:
        persisted_message = await session.get(ProjectChatMessage, message.id)

    assert persisted_message is not None
    assert persisted_message.project_id == project_id
    assert persisted_message.author_id == member_id
    assert persisted_message.author_display_name == "member-name"
    assert persisted_message.body == "Ready for review.\nPlease check the notes."
    assert message.body == "Ready for review.\nPlease check the notes."
    assert message.author.display_name == "member-name"


@pytest.mark.asyncio
async def test_project_chat_author_snapshot_falls_back_to_display_external_and_user_id(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    member_id = users["member"].id
    creator_id = users["creator"].id
    assert member_id is not None
    assert creator_id is not None
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Enterprise Launch",
            "code": "ENT",
            "member_ids": [str(member_id)],
        },
    )
    project_id = UUID(project_response.json()["id"])

    async with session_factory() as session:
        display_author = User(
            externalId="display-author",
            display_name="Display Name",
        )
        external_author = User(externalId="external-author")
        id_author = User(externalId="   ")
        session.add_all([display_author, external_author, id_author])
        await session.commit()
        await session.refresh(display_author)
        await session.refresh(external_author)
        await session.refresh(id_author)
        assert display_author.id is not None
        assert external_author.id is not None
        assert id_author.id is not None
        session.add_all(
            [
                ProjectMember(project_id=project_id, user_id=display_author.id),
                ProjectMember(project_id=project_id, user_id=external_author.id),
                ProjectMember(project_id=project_id, user_id=id_author.id),
            ]
        )
        await session.commit()

        display_message = await ProjectChatService(session).create_text_message(
            project_id, display_author, "Display fallback"
        )
        external_message = await ProjectChatService(session).create_text_message(
            project_id, external_author, "External fallback"
        )
        id_message = await ProjectChatService(session).create_text_message(
            project_id, id_author, "ID fallback"
        )

    assert display_message.author.display_name == "Display Name"
    assert external_message.author.display_name == "external-author"
    assert id_message.author.display_name == str(id_author.id)

    async with session_factory() as session:
        snapshots = await session.scalars(
            select(ProjectChatMessage)
            .filter_by(project_id=project_id)
            .order_by(SQLModel.metadata.tables["project_chat_messages"].c.created_at)
        )

    assert [message.author_display_name for message in snapshots.all()] == [
        "Display Name",
        "external-author",
        str(id_author.id),
    ]


@pytest.mark.asyncio
async def test_project_chat_history_keeps_deleted_author_snapshot(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    member_id = users["member"].id
    creator_id = users["creator"].id
    assert member_id is not None
    assert creator_id is not None
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Enterprise Launch",
            "code": "ENT",
            "member_ids": [str(member_id)],
        },
    )
    project_id = UUID(project_response.json()["id"])
    created_at = datetime(2026, 1, 1, 10, 0, tzinfo=UTC)

    async with session_factory() as session:
        deleted_author = User(
            externalId="deleted-author",
            preferred_username="former-teammate",
        )
        session.add(deleted_author)
        await session.commit()
        await session.refresh(deleted_author)
        assert deleted_author.id is not None
        session.add(
            ProjectChatMessage(
                project_id=project_id,
                author_id=deleted_author.id,
                author_display_name="former-teammate",
                body="Historical decision",
                created_at=created_at,
            )
        )
        await session.delete(deleted_author)
        await session.commit()

    response = await client.get(
        f"/projects/{project_id}/chat/messages",
        headers={"Authorization": "Bearer member-token"},
    )

    assert response.status_code == 200
    assert response.json()[0]["author"] == {
        "id": str(deleted_author.id),
        "display_name": "former-teammate",
        "initials": "F",
        "deleted": True,
    }


@pytest.mark.asyncio
async def test_project_chat_socket_creates_persisted_message_before_delivery(
    client: AsyncClient,
    websocket_client: TestClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    member_id = users["member"].id
    assert member_id is not None
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Enterprise Launch",
            "code": "ENT",
            "member_ids": [str(member_id)],
        },
    )
    project_id = UUID(project_response.json()["id"])

    with websocket_client.websocket_connect(
        f"/projects/{project_id}/chat/socket",
        subprotocols=["kanai.project-chat", "bearer.member-token"],
    ) as websocket:
        assert websocket.receive_json()["type"] == "ready"
        websocket.send_json(
            {
                "type": "create-message",
                "body": "  Hello team.  ",
                "client_message_id": "client-1",
            }
        )
        event = websocket.receive_json()

    assert event["type"] == "created-message"
    assert event["client_message_id"] == "client-1"
    message = event["message"]
    assert message["project_id"] == str(project_id)
    assert message["body"] == "Hello team."
    assert message["author"] == {
        "id": str(member_id),
        "display_name": "member",
        "initials": "M",
        "deleted": False,
    }

    async with session_factory() as session:
        persisted_message = await session.get(ProjectChatMessage, UUID(message["id"]))

    assert persisted_message is not None
    assert persisted_message.body == "Hello team."
    assert persisted_message.project_id == project_id


@pytest.mark.asyncio
async def test_project_chat_socket_rechecks_access_before_message_send(
    client: AsyncClient,
    websocket_client: TestClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    member_id = users["member"].id
    assert member_id is not None
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Enterprise Launch",
            "code": "ENT",
            "member_ids": [str(member_id)],
        },
    )
    project_id = UUID(project_response.json()["id"])

    with websocket_client.websocket_connect(
        f"/projects/{project_id}/chat/socket",
        subprotocols=["kanai.project-chat", "bearer.member-token"],
    ) as websocket:
        assert websocket.receive_json()["type"] == "ready"

        async with session_factory() as session:
            membership = await session.scalar(
                select(ProjectMember).filter_by(
                    project_id=project_id,
                    user_id=member_id,
                )
            )
            assert membership is not None
            await session.delete(membership)
            await session.commit()

        websocket.send_json({"type": "create-message", "body": "After removal"})
        assert websocket.receive_json() == {
            "type": "error",
            "error": {
                "code": "message_rejected",
                "message": "Project not found",
            },
        }

    async with session_factory() as session:
        persisted_messages = await session.scalars(
            select(ProjectChatMessage).filter_by(project_id=project_id)
        )

    assert persisted_messages.all() == []


@pytest.mark.asyncio
async def test_project_chat_socket_rejects_invalid_message_bodies(
    client: AsyncClient,
    websocket_client: TestClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "ENT"},
    )
    project_id = project_response.json()["id"]

    with websocket_client.websocket_connect(
        f"/projects/{project_id}/chat/socket",
        subprotocols=["kanai.project-chat", "bearer.token"],
    ) as websocket:
        assert websocket.receive_json()["type"] == "ready"
        websocket.send_json({"type": "create-message", "body": "   "})
        assert websocket.receive_json() == {
            "type": "error",
            "error": {
                "code": "message_rejected",
                "message": "Message body cannot be blank",
            },
        }
        websocket.send_json({"type": "create-message", "body": "a" * 4001})
        assert websocket.receive_json() == {
            "type": "error",
            "error": {
                "code": "message_rejected",
                "message": "Message body cannot exceed 4000 characters",
            },
        }
        websocket.send_json(
            {"type": "create-message", "body": "Hello", "client_message_id": 42}
        )
        assert websocket.receive_json() == {
            "type": "error",
            "error": {
                "code": "invalid_message",
                "message": "Client message id must be a string.",
            },
        }


@pytest.mark.asyncio
async def test_project_chat_fanout_isolates_projects() -> None:
    first_project_id = uuid4()
    second_project_id = uuid4()
    first_socket = FakeProjectChatSocket()
    second_socket = FakeProjectChatSocket()
    fanout = ProjectChatFanout(FakeProjectChatFanoutBroker())

    await fanout.connect(first_project_id, first_socket)
    await fanout.connect(second_project_id, second_socket)
    await fanout.broadcast(first_project_id, {"type": "created-message"})

    assert first_socket.payloads == [{"type": "created-message"}]
    assert second_socket.payloads == []


@pytest.mark.asyncio
async def test_project_chat_fanout_delivers_published_events_across_workers() -> None:
    project_id = uuid4()
    broker = FakeProjectChatFanoutBroker()
    first_worker_fanout = ProjectChatFanout(broker)
    second_worker_fanout = ProjectChatFanout(broker)
    first_worker_socket = FakeProjectChatSocket()
    second_worker_socket = FakeProjectChatSocket()

    await first_worker_fanout.connect(project_id, first_worker_socket)
    await second_worker_fanout.connect(project_id, second_worker_socket)
    await asyncio.sleep(0)
    await first_worker_fanout.broadcast(project_id, {"type": "created-message"})

    for _ in range(10):
        if second_worker_socket.payloads:
            break
        await asyncio.sleep(0)

    assert broker.published_events == [
        {
            "project_id": str(project_id),
            "payload": {"type": "created-message"},
            "origin_worker_id": broker.published_events[0]["origin_worker_id"],
        }
    ]
    assert first_worker_socket.payloads == [{"type": "created-message"}]
    assert second_worker_socket.payloads == [{"type": "created-message"}]

    await first_worker_fanout.aclose()
    await second_worker_fanout.aclose()


@pytest.mark.asyncio
async def test_project_chat_history_returns_latest_50_oldest_to_newest_and_isolated(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    creator_id = users["creator"].id
    assert creator_id is not None
    first_project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "First", "code": "ONE"},
    )
    second_project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Second", "code": "TWO"},
    )
    project_id = UUID(first_project_response.json()["id"])
    other_project_id = UUID(second_project_response.json()["id"])
    base_time = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)

    async with session_factory() as session:
        session.add(
            ProjectChatMessage(
                project_id=other_project_id,
                author_id=creator_id,
                author_display_name="Jane Owner",
                body="Other project message",
                created_at=base_time + timedelta(minutes=99),
            )
        )
        session.add_all(
            [
                ProjectChatMessage(
                    project_id=project_id,
                    author_id=creator_id,
                    author_display_name="Jane Owner",
                    body=f"Message {index:02d}",
                    created_at=base_time + timedelta(minutes=index),
                )
                for index in range(60)
            ]
        )
        await session.commit()

    response = await client.get(
        f"/projects/{project_id}/chat/messages",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 200
    messages = response.json()
    assert len(messages) == 50
    assert [message["body"] for message in messages] == [
        f"Message {index:02d}" for index in range(10, 60)
    ]
    assert "Other project message" not in [message["body"] for message in messages]


@pytest.mark.asyncio
async def test_project_chat_history_cursor_returns_older_messages_deterministically(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    creator_id = users["creator"].id
    assert creator_id is not None
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Cursor Chat", "code": "CUR"},
    )
    project_id = UUID(project_response.json()["id"])
    base_time = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)
    boundary_message_id = uuid4()

    async with session_factory() as session:
        session.add_all(
            [
                ProjectChatMessage(
                    id=uuid4(),
                    project_id=project_id,
                    author_id=creator_id,
                    author_display_name="Jane Owner",
                    body=f"Message {index:02d}",
                    created_at=base_time + timedelta(minutes=index),
                )
                for index in range(10)
            ]
        )
        session.add(
            ProjectChatMessage(
                id=boundary_message_id,
                project_id=project_id,
                author_id=creator_id,
                author_display_name="Jane Owner",
                body="Message 10",
                created_at=base_time + timedelta(minutes=10),
            )
        )
        session.add_all(
            [
                ProjectChatMessage(
                    id=uuid4(),
                    project_id=project_id,
                    author_id=creator_id,
                    author_display_name="Jane Owner",
                    body=f"Message {index:02d}",
                    created_at=base_time + timedelta(minutes=index),
                )
                for index in range(11, 60)
            ]
        )
        await session.commit()

    response = await client.get(
        f"/projects/{project_id}/chat/messages?cursor={boundary_message_id}",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 200
    messages = response.json()
    assert len(messages) == 10
    assert [message["body"] for message in messages] == [
        f"Message {index:02d}" for index in range(10)
    ]


@pytest.mark.asyncio
async def test_project_chat_history_cursor_uses_id_tiebreaker_for_same_timestamp(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    creator_id = users["creator"].id
    assert creator_id is not None
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Tie Chat", "code": "TIE"},
    )
    project_id = UUID(project_response.json()["id"])
    created_at = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)
    cursor_id = UUID("00000000-0000-0000-0000-000000000003")

    async with session_factory() as session:
        session.add_all(
            [
                ProjectChatMessage(
                    id=UUID(f"00000000-0000-0000-0000-00000000000{index}"),
                    project_id=project_id,
                    author_id=creator_id,
                    author_display_name="Jane Owner",
                    body=f"Message {index}",
                    created_at=created_at,
                )
                for index in range(1, 5)
            ]
        )
        await session.commit()

    response = await client.get(
        f"/projects/{project_id}/chat/messages?cursor={cursor_id}",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 200
    assert [message["body"] for message in response.json()] == [
        "Message 1",
        "Message 2",
    ]


@pytest.mark.asyncio
async def test_project_delete_removes_project_chat_messages(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    creator_id = users["creator"].id
    assert creator_id is not None
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "ENT"},
    )
    project_id = UUID(project_response.json()["id"])

    async with session_factory() as session:
        session.add(
            ProjectChatMessage(
                project_id=project_id,
                author_id=creator_id,
                author_display_name="Jane Owner",
                body="Decision context",
                created_at=datetime(2026, 1, 1, 9, 30, tzinfo=UTC),
            )
        )
        await session.commit()

    delete_response = await client.delete(
        f"/projects/{project_id}",
        headers={"Authorization": "Bearer token"},
    )

    assert delete_response.status_code == 204
    async with session_factory() as session:
        messages = await session.scalars(
            select(ProjectChatMessage).filter_by(project_id=project_id)
        )
    assert messages.all() == []


@pytest.mark.asyncio
async def test_project_add_member_is_owner_only_and_idempotent(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    member_id = users["member"].id
    assignee_id = users["assignee"].id
    assert member_id is not None
    assert assignee_id is not None

    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "ENT"},
    )
    project_id = project_response.json()["id"]

    add_response = await client.post(
        f"/projects/{project_id}/members",
        headers={"Authorization": "Bearer token"},
        json={"user_id": str(member_id)},
    )

    assert add_response.status_code == 200
    assert add_response.json()["member_ids"] == [str(member_id)]

    duplicate_response = await client.post(
        f"/projects/{project_id}/members",
        headers={"Authorization": "Bearer token"},
        json={"user_id": str(member_id)},
    )

    assert duplicate_response.status_code == 200
    assert duplicate_response.json()["member_ids"] == [str(member_id)]

    unauthorized_response = await client.post(
        f"/projects/{project_id}/members",
        headers={"Authorization": "Bearer member-token"},
        json={"user_id": str(assignee_id)},
    )

    assert unauthorized_response.status_code == 404
    assert unauthorized_response.json() == {"detail": "Project not found"}


@pytest.mark.asyncio
async def test_project_add_member_validates_user_exists(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "ENT"},
    )
    project_id = project_response.json()["id"]

    response = await client.post(
        f"/projects/{project_id}/members",
        headers={"Authorization": "Bearer token"},
        json={"user_id": "00000000-0000-0000-0000-000000000000"},
    )

    assert response.status_code == 422
    assert response.json() == {
        "detail": "Unknown user id: 00000000-0000-0000-0000-000000000000"
    }


@pytest.mark.asyncio
async def test_project_members_can_list_default_columns(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    member_id = users["member"].id
    assert member_id is not None

    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Enterprise Launch",
            "code": "ENT",
            "member_ids": [str(member_id)],
        },
    )
    project_id = project_response.json()["id"]

    response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer member-token"},
    )

    assert response.status_code == 200
    assert [(column["name"], column["position"]) for column in response.json()] == [
        ("To Do", 0),
        ("In Progress", 1),
        ("Done", 2),
    ]
    assert [column["description"] for column in response.json()] == [None, None, None]
    assert all(column["id"] for column in response.json())
    assert all(column["project_id"] == project_id for column in response.json())


@pytest.mark.asyncio
async def test_project_owner_can_create_column_at_end(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    member_id = users["member"].id
    assert member_id is not None

    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Enterprise Launch",
            "code": "ENT",
            "member_ids": [str(member_id)],
        },
    )
    project_id = project_response.json()["id"]

    response = await client.post(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
        json={"name": " Review ", "description": " Cards awaiting QA "},
    )

    assert response.status_code == 201
    created_column = response.json()
    assert created_column["project_id"] == project_id
    assert created_column["name"] == "Review"
    assert created_column["description"] == "Cards awaiting QA"
    assert created_column["position"] == 3

    list_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer member-token"},
    )

    assert [
        (column["name"], column["description"], column["position"])
        for column in list_response.json()
    ] == [
        ("To Do", None, 0),
        ("In Progress", None, 1),
        ("Done", None, 2),
        ("Review", "Cards awaiting QA", 3),
    ]


@pytest.mark.asyncio
async def test_project_column_create_stores_blank_description_as_null(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "ENT"},
    )
    project_id = project_response.json()["id"]

    response = await client.post(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
        json={"name": "Review", "description": "   "},
    )

    assert response.status_code == 201
    assert response.json()["description"] is None


@pytest.mark.asyncio
async def test_project_column_description_rejects_values_over_500_characters(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "ENT"},
    )
    project_id = project_response.json()["id"]
    overlong_description = "a" * 501

    response = await client.post(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
        json={"name": "Review", "description": overlong_description},
    )

    assert response.status_code == 422
    assert response.json() == {
        "detail": "Column description must be 500 characters or fewer"
    }


@pytest.mark.asyncio
async def test_project_column_create_is_owner_only_and_rejects_duplicate_names(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    member_id = users["member"].id
    assert member_id is not None

    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Enterprise Launch",
            "code": "ENT",
            "member_ids": [str(member_id)],
        },
    )
    project_id = project_response.json()["id"]

    unauthorized_response = await client.post(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer member-token"},
        json={"name": "Review"},
    )
    duplicate_response = await client.post(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
        json={"name": " done "},
    )

    assert unauthorized_response.status_code == 404
    assert unauthorized_response.json() == {"detail": "Project not found"}
    assert duplicate_response.status_code == 409
    assert duplicate_response.json() == {"detail": "Column name already exists"}


@pytest.mark.asyncio
async def test_project_column_create_rejects_reserved_backlog_name(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "ENT"},
    )
    project_id = project_response.json()["id"]

    response = await client.post(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
        json={"name": " BACKLOG "},
    )

    assert response.status_code == 422
    assert response.json() == {
        "detail": "Backlog is reserved for the project backlog and cannot be used as a workflow column name"
    }


@pytest.mark.asyncio
async def test_project_owner_can_rename_column_without_reordering(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    member_id = users["member"].id
    assert member_id is not None

    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Enterprise Launch",
            "code": "ENT",
            "member_ids": [str(member_id)],
        },
    )
    project_id = project_response.json()["id"]

    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    column_id = columns_response.json()[1]["id"]

    response = await client.patch(
        f"/projects/{project_id}/columns/{column_id}",
        headers={"Authorization": "Bearer token"},
        json={"name": " Active ", "description": " Work currently underway "},
    )

    assert response.status_code == 200
    renamed_column = response.json()
    assert renamed_column["id"] == column_id
    assert renamed_column["project_id"] == project_id
    assert renamed_column["name"] == "Active"
    assert renamed_column["description"] == "Work currently underway"
    assert renamed_column["position"] == 1

    clear_response = await client.patch(
        f"/projects/{project_id}/columns/{column_id}",
        headers={"Authorization": "Bearer token"},
        json={"name": "Active", "description": "   "},
    )

    assert clear_response.status_code == 200
    assert clear_response.json()["description"] is None

    list_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer member-token"},
    )

    assert [
        (column["name"], column["description"], column["position"])
        for column in list_response.json()
    ] == [
        ("To Do", None, 0),
        ("Active", None, 1),
        ("Done", None, 2),
    ]


@pytest.mark.asyncio
async def test_project_column_rename_is_owner_only_and_rejects_duplicate_names(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    member_id = users["member"].id
    assert member_id is not None

    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Enterprise Launch",
            "code": "ENT",
            "member_ids": [str(member_id)],
        },
    )
    project_id = project_response.json()["id"]

    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    column_id = columns_response.json()[1]["id"]

    unauthorized_response = await client.patch(
        f"/projects/{project_id}/columns/{column_id}",
        headers={"Authorization": "Bearer member-token"},
        json={"name": "Active"},
    )
    duplicate_response = await client.patch(
        f"/projects/{project_id}/columns/{column_id}",
        headers={"Authorization": "Bearer token"},
        json={"name": " done "},
    )

    assert unauthorized_response.status_code == 404
    assert unauthorized_response.json() == {"detail": "Project not found"}
    assert duplicate_response.status_code == 409
    assert duplicate_response.json() == {"detail": "Column name already exists"}


@pytest.mark.asyncio
async def test_project_column_rename_rejects_reserved_backlog_name(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "ENT"},
    )
    project_id = project_response.json()["id"]

    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    column_id = columns_response.json()[1]["id"]

    response = await client.patch(
        f"/projects/{project_id}/columns/{column_id}",
        headers={"Authorization": "Bearer token"},
        json={"name": " backlog "},
    )

    assert response.status_code == 422
    assert response.json() == {
        "detail": "Backlog is reserved for the project backlog and cannot be used as a workflow column name"
    }


@pytest.mark.asyncio
async def test_project_column_rename_rejects_empty_names(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "ENT"},
    )
    project_id = project_response.json()["id"]

    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    column_id = columns_response.json()[0]["id"]

    response = await client.patch(
        f"/projects/{project_id}/columns/{column_id}",
        headers={"Authorization": "Bearer token"},
        json={"name": "   "},
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Column name is required"}


@pytest.mark.asyncio
async def test_project_owner_can_reorder_columns(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "ENT"},
    )
    project_id = project_response.json()["id"]

    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    column_ids = [column["id"] for column in columns_response.json()]

    response = await client.put(
        f"/projects/{project_id}/columns/reorder",
        headers={"Authorization": "Bearer token"},
        json={"column_ids": [column_ids[2], column_ids[0], column_ids[1]]},
    )

    assert response.status_code == 200
    assert [(column["name"], column["position"]) for column in response.json()] == [
        ("Done", 0),
        ("To Do", 1),
        ("In Progress", 2),
    ]

    list_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )

    assert [
        (column["name"], column["position"]) for column in list_response.json()
    ] == [
        ("Done", 0),
        ("To Do", 1),
        ("In Progress", 2),
    ]


@pytest.mark.asyncio
async def test_project_column_reorder_is_owner_only_and_requires_complete_project_ids(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    member_id = users["member"].id
    assert member_id is not None

    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Enterprise Launch",
            "code": "ENT",
            "member_ids": [str(member_id)],
        },
    )
    project_id = project_response.json()["id"]
    other_project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Platform Launch", "code": "PLT"},
    )
    other_project_id = other_project_response.json()["id"]

    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    column_ids = [column["id"] for column in columns_response.json()]
    other_columns_response = await client.get(
        f"/projects/{other_project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    foreign_column_id = other_columns_response.json()[0]["id"]

    unauthorized_response = await client.put(
        f"/projects/{project_id}/columns/reorder",
        headers={"Authorization": "Bearer member-token"},
        json={"column_ids": column_ids},
    )
    duplicate_response = await client.put(
        f"/projects/{project_id}/columns/reorder",
        headers={"Authorization": "Bearer token"},
        json={"column_ids": [column_ids[0], column_ids[0], column_ids[1]]},
    )
    missing_response = await client.put(
        f"/projects/{project_id}/columns/reorder",
        headers={"Authorization": "Bearer token"},
        json={"column_ids": column_ids[:2]},
    )
    foreign_response = await client.put(
        f"/projects/{project_id}/columns/reorder",
        headers={"Authorization": "Bearer token"},
        json={"column_ids": [column_ids[0], column_ids[1], foreign_column_id]},
    )

    assert unauthorized_response.status_code == 404
    assert unauthorized_response.json() == {"detail": "Project not found"}
    assert duplicate_response.status_code == 422
    assert missing_response.status_code == 422
    assert foreign_response.status_code == 422
    assert duplicate_response.json() == {
        "detail": "Column reorder must include each project column exactly once"
    }
    assert missing_response.json() == duplicate_response.json()
    assert foreign_response.json() == duplicate_response.json()


@pytest.mark.asyncio
async def test_project_owner_can_delete_empty_column_and_positions_are_normalized(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "ENT"},
    )
    project_id = project_response.json()["id"]

    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    column_id = columns_response.json()[1]["id"]

    response = await client.delete(
        f"/projects/{project_id}/columns/{column_id}",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 204

    list_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )

    assert [
        (column["name"], column["position"]) for column in list_response.json()
    ] == [
        ("To Do", 0),
        ("Done", 1),
    ]


@pytest.mark.asyncio
async def test_project_column_delete_is_owner_only_and_rejects_final_column(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    member_id = users["member"].id
    assert member_id is not None

    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Enterprise Launch",
            "code": "ENT",
            "member_ids": [str(member_id)],
        },
    )
    project_id = project_response.json()["id"]

    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    column_ids = [column["id"] for column in columns_response.json()]

    unauthorized_response = await client.delete(
        f"/projects/{project_id}/columns/{column_ids[0]}",
        headers={"Authorization": "Bearer member-token"},
    )
    first_delete_response = await client.delete(
        f"/projects/{project_id}/columns/{column_ids[0]}",
        headers={"Authorization": "Bearer token"},
    )
    second_delete_response = await client.delete(
        f"/projects/{project_id}/columns/{column_ids[1]}",
        headers={"Authorization": "Bearer token"},
    )
    final_delete_response = await client.delete(
        f"/projects/{project_id}/columns/{column_ids[2]}",
        headers={"Authorization": "Bearer token"},
    )

    assert unauthorized_response.status_code == 404
    assert unauthorized_response.json() == {"detail": "Project not found"}
    assert first_delete_response.status_code == 204
    assert second_delete_response.status_code == 204
    assert final_delete_response.status_code == 409
    assert final_delete_response.json() == {
        "detail": "Cannot delete the final project column"
    }


@pytest.mark.asyncio
async def test_project_create_rejects_duplicate_global_code(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    payload = {
        "name": "Enterprise Launch",
        "code": "ENT",
    }

    first_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json=payload,
    )
    second_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json=payload,
    )

    assert first_response.status_code == 201
    assert second_response.status_code == 409
    assert second_response.json() == {"detail": "Project code already exists"}


@pytest.mark.asyncio
async def test_task_crud_endpoints_do_not_expose_due_fields(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    assignee_id = users["assignee"].id
    assert assignee_id is not None

    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch", "code": "ENT"},
    )
    project_id = project_response.json()["id"]

    create_response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={
            "title": "Finalize launch checklist",
            "priority": "urgent",
            "story_points": 5,
            "assignee_id": str(assignee_id),
            "description": "Launch handoff",
            "acceptance_criteria": "Checklist approved",
            "tag": "Strategic",
        },
    )

    assert create_response.status_code == 201
    created_task = create_response.json()
    assert created_task["title"] == "Finalize launch checklist"
    assert created_task["priority"] == "critical"
    assert created_task["story_points"] == 5
    assert "column_id" in created_task
    assert "status" not in created_task
    assert "due_label" not in created_task
    assert "due_date" not in created_task

    list_response = await client.get(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
    )

    assert list_response.status_code == 200
    assert [task["id"] for task in list_response.json()] == [created_task["id"]]

    get_response = await client.get(
        f"/projects/{project_id}/tasks/{created_task['id']}",
        headers={"Authorization": "Bearer token"},
    )

    assert get_response.status_code == 200
    assert get_response.json()["tag"] == "Strategic"
    assert get_response.json()["story_points"] == 5

    update_response = await client.patch(
        f"/projects/{project_id}/tasks/{created_task['id']}",
        headers={"Authorization": "Bearer token"},
        json={"priority": "low", "story_points": 8},
    )

    assert update_response.status_code == 200
    updated_task = update_response.json()
    assert "status" not in updated_task
    assert updated_task["priority"] == "low"
    assert updated_task["story_points"] == 8

    clear_response = await client.patch(
        f"/projects/{project_id}/tasks/{created_task['id']}",
        headers={"Authorization": "Bearer token"},
        json={
            "assignee_id": None,
            "story_points": None,
            "description": None,
            "acceptance_criteria": None,
            "tag": None,
        },
    )

    assert clear_response.status_code == 200
    cleared_task = clear_response.json()
    assert cleared_task["assignee_id"] is None
    assert cleared_task["story_points"] is None
    assert cleared_task["description"] is None
    assert cleared_task["acceptance_criteria"] is None
    assert cleared_task["tag"] is None

    delete_response = await client.delete(
        f"/projects/{project_id}/tasks/{created_task['id']}",
        headers={"Authorization": "Bearer token"},
    )

    assert delete_response.status_code == 204

    async with session_factory() as session:
        task = await session.get(Task, UUID(created_task["id"]))

    assert task is None


@pytest.mark.asyncio
async def test_task_priority_is_optional_and_clearable(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Optional Priority",
            "code": f"O{uuid4().hex[:2].upper()}",
        },
    )
    project_id = project_response.json()["id"]

    create_response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Default no priority"},
    )

    assert create_response.status_code == 201
    created_task = create_response.json()
    assert created_task["priority"] is None

    async with session_factory() as session:
        stored_task = await session.get(Task, UUID(created_task["id"]))
        assert stored_task is not None
        assert stored_task.priority == ""

    for priority in ("low", "medium", "high", "critical"):
        update_response = await client.patch(
            f"/projects/{project_id}/tasks/{created_task['id']}",
            headers={"Authorization": "Bearer token"},
            json={"priority": priority},
        )
        assert update_response.status_code == 200
        assert update_response.json()["priority"] == priority

    clear_response = await client.patch(
        f"/projects/{project_id}/tasks/{created_task['id']}",
        headers={"Authorization": "Bearer token"},
        json={"priority": None},
    )

    assert clear_response.status_code == 200
    assert clear_response.json()["priority"] is None


@pytest.mark.asyncio
async def test_task_story_points_are_optional_clearable_and_validated(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Story Point Contract",
            "code": f"S{uuid4().hex[:2].upper()}",
        },
    )
    project_id = project_response.json()["id"]

    create_response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Estimated task", "story_points": 13},
    )
    blank_create_response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Blank estimate", "story_points": ""},
    )
    invalid_create_response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Invalid estimate", "story_points": 4},
    )

    assert create_response.status_code == 201
    created_task = create_response.json()
    assert created_task["story_points"] == 13
    assert blank_create_response.status_code == 201
    assert blank_create_response.json()["story_points"] is None
    assert invalid_create_response.status_code == 422

    async with session_factory() as session:
        stored_task = await session.get(Task, UUID(created_task["id"]))
        blank_task = await session.get(Task, UUID(blank_create_response.json()["id"]))
        assert stored_task is not None
        assert blank_task is not None
        assert stored_task.story_points == 13
        assert blank_task.story_points is None

    for story_points in (1, 2, 3, 5, 8, 13):
        update_response = await client.patch(
            f"/projects/{project_id}/tasks/{created_task['id']}",
            headers={"Authorization": "Bearer token"},
            json={"story_points": story_points},
        )
        assert update_response.status_code == 200
        assert update_response.json()["story_points"] == story_points

    read_response = await client.get(
        f"/projects/{project_id}/tasks/{created_task['id']}",
        headers={"Authorization": "Bearer token"},
    )
    list_response = await client.get(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
    )
    clear_response = await client.patch(
        f"/projects/{project_id}/tasks/{created_task['id']}",
        headers={"Authorization": "Bearer token"},
        json={"story_points": None},
    )
    invalid_update_response = await client.patch(
        f"/projects/{project_id}/tasks/{created_task['id']}",
        headers={"Authorization": "Bearer token"},
        json={"story_points": 21},
    )

    assert read_response.status_code == 200
    assert read_response.json()["story_points"] == 13
    assert list_response.status_code == 200
    assert {task["story_points"] for task in list_response.json()} == {13, None}
    assert clear_response.status_code == 200
    assert clear_response.json()["story_points"] is None
    assert invalid_update_response.status_code == 422


@pytest.mark.asyncio
async def test_task_move_endpoint_returns_server_ranked_task(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    member_id = users["member"].id
    assert member_id is not None

    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={
            "name": "Move Contract",
            "code": "MOV",
            "member_ids": [str(member_id)],
        },
    )
    project_id = project_response.json()["id"]
    columns_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
    )
    todo_column_id = columns_response.json()[0]["id"]
    done_column_id = columns_response.json()[2]["id"]
    moved_response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Moved", "column_id": todo_column_id},
    )
    first_done_response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "First done", "column_id": done_column_id},
    )
    last_done_response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Last done", "column_id": done_column_id},
    )

    move_response = await client.put(
        f"/projects/{project_id}/tasks/{moved_response.json()['id']}/move",
        headers={"Authorization": "Bearer member-token"},
        json={
            "column_id": done_column_id,
            "before_task_id": first_done_response.json()["id"],
            "after_task_id": last_done_response.json()["id"],
        },
    )

    assert move_response.status_code == 200
    moved_task = move_response.json()
    assert moved_task["id"] == moved_response.json()["id"]
    assert moved_task["column_id"] == done_column_id
    assert first_done_response.json()["rank"] < moved_task["rank"]
    assert moved_task["rank"] < last_done_response.json()["rank"]


@pytest.mark.asyncio
async def test_task_create_and_patch_reject_rank_payloads(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Rank Contract", "code": "RNK"},
    )
    project_id = project_response.json()["id"]

    create_response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Ranked", "rank": "j"},
    )
    valid_create_response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={"title": "Unranked"},
    )
    patch_response = await client.patch(
        f"/projects/{project_id}/tasks/{valid_create_response.json()['id']}",
        headers={"Authorization": "Bearer token"},
        json={"rank": "z"},
    )

    assert create_response.status_code == 422
    assert valid_create_response.status_code == 201
    assert patch_response.status_code == 422
