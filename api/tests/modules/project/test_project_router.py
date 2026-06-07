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
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from starlette.websockets import WebSocketDisconnect

import app.api.v1.endpoints.projects as project_routes
from app.api import deps
from app.api.v1.endpoints.projects import project_router
from app.core.exceptions import InvalidTokenException
from app.core.security import AuthMiddleware
from app.db.session import get_db
from app.models.project import Project, ProjectChatMessage, ProjectMember, ProjectOwner
from app.models.task import Task
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
    project_routes.project_chat_fanout = ProjectChatFanout(FakeProjectChatFanoutBroker())

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
            "priority": "medium",
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
        json={"name": "Enterprise Launch", "code": "ENT", "priority": "medium"},
    )
    project_id = project_response.json()["id"]

    response = await client.get(
        f"/projects/{project_id}/chat/messages",
        headers={"Authorization": "Bearer outsider-token"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Project not found"}


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
        json={"name": "Enterprise Launch", "code": "ENT", "priority": "medium"},
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
        json={"name": "Enterprise Launch", "code": "ENT", "priority": "medium"},
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
        json={"name": "Enterprise Launch", "code": "ENT", "priority": "medium"},
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
            "priority": "medium",
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
            "priority": "medium",
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
            "priority": "medium",
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
            "priority": "medium",
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
            "priority": "medium",
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
            "priority": "medium",
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
        json={"name": "Enterprise Launch", "code": "ENT", "priority": "medium"},
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
        json={"name": "First", "code": "ONE", "priority": "medium"},
    )
    second_project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Second", "code": "TWO", "priority": "medium"},
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
        json={"name": "Cursor Chat", "code": "CUR", "priority": "medium"},
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
        json={"name": "Tie Chat", "code": "TIE", "priority": "medium"},
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
        json={"name": "Enterprise Launch", "code": "ENT", "priority": "medium"},
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
            "priority": "medium",
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
        json={"name": "Enterprise Launch", "code": "ENT", "priority": "medium"},
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
        json={"name": "Enterprise Launch", "code": "ENT", "priority": "medium"},
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
            "priority": "medium",
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
            "priority": "medium",
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
async def test_project_column_rename_rejects_empty_names(
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
        json={"name": "Enterprise Launch", "code": "ENT", "priority": "medium"},
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
            "priority": "medium",
            "member_ids": [str(member_id)],
        },
    )
    project_id = project_response.json()["id"]
    other_project_response = await client.post(
        "/projects",
        headers={"Authorization": "Bearer token"},
        json={"name": "Platform Launch", "code": "PLT", "priority": "medium"},
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
        json={"name": "Enterprise Launch", "code": "ENT", "priority": "medium"},
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
            "priority": "medium",
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

    update_response = await client.patch(
        f"/projects/{project_id}/tasks/{created_task['id']}",
        headers={"Authorization": "Bearer token"},
        json={"priority": "low"},
    )

    assert update_response.status_code == 200
    updated_task = update_response.json()
    assert "status" not in updated_task
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
            "priority": "medium",
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
        json={"name": "Rank Contract", "code": "RNK", "priority": "medium"},
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
