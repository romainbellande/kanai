from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

from app.api.v1.endpoints.projects import project_router
from app.core.security import AuthMiddleware
from app.db.session import get_db
from app.models.project import Project, ProjectMember, ProjectOwner
from app.models.task import Task
from app.models.user import User
from app.schemas.auth import AuthenticatedContext
from app.services.auth_service import RequestAuthBoundary


class StubAuthenticateRequest:
    async def execute(self, bearer_token: str) -> AuthenticatedContext:
        subject = "member" if bearer_token == "member-token" else "creator"
        return AuthenticatedContext(
            subject=subject,
            issuer="https://issuer.test",
            expires_at=datetime.now(UTC) + timedelta(minutes=5),
            audience="kanai-api",
            claims={"scope": "openid"},
        )


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
async def client(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncIterator[AsyncClient]:
    app = FastAPI()
    app.add_middleware(
        AuthMiddleware,
        auth_boundary=RequestAuthBoundary(StubAuthenticateRequest()),
    )
    app.include_router(project_router)

    async def override_get_db() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest_asyncio.fixture
async def users(
    session_factory: async_sessionmaker[AsyncSession],
) -> dict[str, User]:
    async with session_factory() as session:
        creator = User(externalId="creator")
        owner = User(externalId="owner")
        member = User(externalId="member")
        assignee = User(externalId="assignee")
        session.add_all([creator, owner, member, assignee])
        await session.commit()
        await session.refresh(creator)
        await session.refresh(owner)
        await session.refresh(member)
        await session.refresh(assignee)

    return {
        "creator": creator,
        "owner": owner,
        "member": member,
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
            "priority": "medium",
            "description": "Launch work",
            "status": "On Track",
            "owner_ids": [str(owner_id)],
            "member_ids": [str(member_id)],
        },
    )

    assert create_response.status_code == 201
    created_project = create_response.json()
    assert created_project["code"] == "ENT"
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

    update_response = await client.patch(
        f"/projects/{created_project['id']}",
        headers={"Authorization": "Bearer token"},
        json={"name": "Enterprise Launch Updated", "owner_ids": []},
    )

    assert update_response.status_code == 200
    updated_project = update_response.json()
    assert updated_project["name"] == "Enterprise Launch Updated"
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
        json={"name": "Enterprise Launch", "code": "ENT", "priority": "medium"},
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
        json={"name": "Enterprise Launch", "code": "ENT", "priority": "medium"},
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
            "priority": "medium",
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
            "priority": "medium",
            "member_ids": [str(member_id)],
        },
    )
    project_id = project_response.json()["id"]

    response = await client.post(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer token"},
        json={"name": " Review "},
    )

    assert response.status_code == 201
    created_column = response.json()
    assert created_column["project_id"] == project_id
    assert created_column["name"] == "Review"
    assert created_column["position"] == 3

    list_response = await client.get(
        f"/projects/{project_id}/columns",
        headers={"Authorization": "Bearer member-token"},
    )

    assert [(column["name"], column["position"]) for column in list_response.json()] == [
        ("To Do", 0),
        ("In Progress", 1),
        ("Done", 2),
        ("Review", 3),
    ]


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
            "priority": "medium",
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
async def test_project_create_rejects_duplicate_global_code(
    client: AsyncClient,
    users: dict[str, User],
) -> None:
    del users
    payload = {
        "name": "Enterprise Launch",
        "code": "ENT",
        "priority": "medium",
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
        json={"name": "Enterprise Launch", "code": "ENT", "priority": "medium"},
    )
    project_id = project_response.json()["id"]

    create_response = await client.post(
        f"/projects/{project_id}/tasks",
        headers={"Authorization": "Bearer token"},
        json={
            "title": "Finalize launch checklist",
            "status": "todo",
            "priority": "urgent",
            "assignee_id": str(assignee_id),
            "description": "Launch handoff",
            "acceptance_criteria": "Checklist approved",
            "tag": "Strategic",
        },
    )

    assert create_response.status_code == 201
    created_task = create_response.json()
    assert created_task["title"] == "Finalize launch checklist"
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

    update_response = await client.patch(
        f"/projects/{project_id}/tasks/{created_task['id']}",
        headers={"Authorization": "Bearer token"},
        json={"status": "done", "priority": "low"},
    )

    assert update_response.status_code == 200
    updated_task = update_response.json()
    assert updated_task["status"] == "done"
    assert updated_task["priority"] == "low"

    clear_response = await client.patch(
        f"/projects/{project_id}/tasks/{created_task['id']}",
        headers={"Authorization": "Bearer token"},
        json={
            "assignee_id": None,
            "description": None,
            "acceptance_criteria": None,
            "tag": None,
        },
    )

    assert clear_response.status_code == 200
    cleared_task = clear_response.json()
    assert cleared_task["assignee_id"] is None
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
