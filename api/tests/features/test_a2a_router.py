import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

from app.core.config import AuthSettings, Environment, Settings
from app.core.exceptions import InvalidTokenException
from app.core.security import AuthMiddleware
from app.api.deps import get_current_user
from app.db.session import get_db
from app.features.a2a import (
    AcceptanceCriteriaGenerationContext,
    a2a_router,
    build_acceptance_criteria_prompt,
    get_acceptance_criteria_generator,
)
from app.models.project import Project, ProjectMember, ProjectOwner
from app.models.user import User
from app.schemas.auth import AuthenticatedContext
from app.services.auth_service import RequestAuthBoundary


class StubAuthenticateRequest:
    async def execute(self, bearer_token: str) -> AuthenticatedContext:
        if bearer_token == "invalid-token":
            raise InvalidTokenException("Token is invalid")
        subject = "outsider" if bearer_token == "outsider-token" else "member"
        return AuthenticatedContext(
            subject=subject,
            issuer="https://issuer.test",
            expires_at=datetime.now(UTC) + timedelta(minutes=5),
            audience="kanai-api",
            claims={"scope": "openid"},
        )


class StubAcceptanceCriteriaGenerator:
    def __init__(self) -> None:
        self.contexts: list[AcceptanceCriteriaGenerationContext] = []

    async def stream_criteria(
        self, context: AcceptanceCriteriaGenerationContext
    ) -> AsyncIterator[str]:
        self.contexts.append(context)
        yield "- Users can create tasks"
        yield "\n- Saved tasks show on the board"


def build_client() -> TestClient:
    app = FastAPI()
    app.include_router(a2a_router)

    async def override_get_current_user() -> User:
        return User(id=uuid4(), externalId="test-user")

    async def override_get_db() -> AsyncIterator[object]:
        yield object()

    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


@pytest_asyncio.fixture
async def session_factory(
    tmp_path: Path,
) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    database_path = tmp_path / "a2a_router.sqlite3"
    engine = create_async_engine(f"sqlite+aiosqlite:///{database_path}")
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)

    yield factory

    await engine.dispose()


@pytest_asyncio.fixture
async def seeded_users(
    session_factory: async_sessionmaker[AsyncSession],
) -> dict[str, UUID]:
    async with session_factory() as session:
        member = User(externalId="member")
        outsider = User(externalId="outsider")
        session.add_all([member, outsider])
        await session.commit()
        await session.refresh(member)
        await session.refresh(outsider)
        assert member.id is not None
        assert outsider.id is not None
        return {"member": member.id, "outsider": outsider.id}


@pytest_asyncio.fixture
async def seeded_project(
    session_factory: async_sessionmaker[AsyncSession],
    seeded_users: dict[str, UUID],
) -> UUID:
    async with session_factory() as session:
        project = Project(
            name="Project",
            code="PRJ",
            priority="medium",
            description="Project context",
            status="active",
        )
        session.add(project)
        await session.commit()
        await session.refresh(project)
        assert project.id is not None
        session.add_all(
            [
                ProjectOwner(project_id=project.id, user_id=seeded_users["member"]),
                ProjectMember(project_id=project.id, user_id=seeded_users["member"]),
            ]
        )
        await session.commit()
        return project.id


@pytest_asyncio.fixture
async def protected_client(
    session_factory: async_sessionmaker[AsyncSession],
    seeded_users: dict[str, UUID],
) -> AsyncIterator[tuple[AsyncClient, StubAcceptanceCriteriaGenerator]]:
    del seeded_users

    app = FastAPI()
    app.add_middleware(
        AuthMiddleware,
        auth_boundary=RequestAuthBoundary(
            StubAuthenticateRequest(),
            whitelist_paths={"/a2a/acceptance-criteria/.well-known/agent-card.json"},
        ),
    )
    app.include_router(a2a_router)

    async def override_get_db() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            yield session

    stub_generator = StubAcceptanceCriteriaGenerator()
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_acceptance_criteria_generator] = lambda: stub_generator

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client, stub_generator


def test_acceptance_criteria_agent_card_is_reachable_without_bearer_auth() -> None:
    client = build_client()

    response = client.get("/a2a/acceptance-criteria/.well-known/agent-card.json")

    assert response.status_code == 200
    body = response.json()
    assert body["url"] == "/a2a/acceptance-criteria"
    assert body["skills"][0]["id"] == "acceptance-criteria"


def test_unknown_a2a_agent_card_slug_returns_not_found() -> None:
    client = build_client()

    response = client.get("/a2a/unknown/.well-known/agent-card.json")

    assert response.status_code == 404
    assert response.json() == {"detail": "A2A agent not found"}


def test_unknown_a2a_invocation_slug_returns_not_found() -> None:
    client = build_client()

    response = client.post(
        "/a2a/unknown",
        json={"jsonrpc": "2.0", "id": "test", "method": "message/stream"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "A2A agent not found"}


@pytest.mark.asyncio
async def test_acceptance_criteria_invocation_requires_bearer_auth(
    protected_client: tuple[AsyncClient, StubAcceptanceCriteriaGenerator],
) -> None:
    client, stub_generator = protected_client

    response = await client.post("/a2a/acceptance-criteria", json={})

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing Authorization header"}
    assert stub_generator.contexts == []


@pytest.mark.asyncio
async def test_project_id_metadata_is_required_before_model_invocation(
    protected_client: tuple[AsyncClient, StubAcceptanceCriteriaGenerator],
) -> None:
    client, stub_generator = protected_client

    response = await client.post(
        "/a2a/acceptance-criteria",
        headers={"Authorization": "Bearer member-token"},
        json=build_a2a_request(metadata={"task": {"title": "Ship task form"}}),
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "projectId metadata is required"}
    assert stub_generator.contexts == []


@pytest.mark.asyncio
async def test_project_access_is_required_before_model_invocation(
    protected_client: tuple[AsyncClient, StubAcceptanceCriteriaGenerator],
    seeded_project: UUID,
) -> None:
    client, stub_generator = protected_client

    response = await client.post(
        "/a2a/acceptance-criteria",
        headers={"Authorization": "Bearer outsider-token"},
        json=build_a2a_request(
            metadata={
                "projectId": str(seeded_project),
                "task": {"title": "Ship task form"},
            }
        ),
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Project not found"}
    assert stub_generator.contexts == []


@pytest.mark.asyncio
async def test_malformed_metadata_returns_safe_client_error(
    protected_client: tuple[AsyncClient, StubAcceptanceCriteriaGenerator],
    seeded_project: UUID,
) -> None:
    client, stub_generator = protected_client

    response = await client.post(
        "/a2a/acceptance-criteria",
        headers={"Authorization": "Bearer member-token"},
        json=build_a2a_request(
            metadata={
                "projectId": str(seeded_project),
                "task": {"title": "Ship task form", "projectDescription": "Nope"},
            }
        ),
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Unsupported task metadata field"}
    assert stub_generator.contexts == []


@pytest.mark.asyncio
async def test_insufficient_metadata_returns_safe_client_error(
    protected_client: tuple[AsyncClient, StubAcceptanceCriteriaGenerator],
    seeded_project: UUID,
) -> None:
    client, stub_generator = protected_client

    response = await client.post(
        "/a2a/acceptance-criteria",
        headers={"Authorization": "Bearer member-token"},
        json=build_a2a_request(
            metadata={
                "projectId": str(seeded_project),
                "task": {"priority": "high"},
            }
        ),
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Task title or description metadata is required"
    }
    assert stub_generator.contexts == []


@pytest.mark.asyncio
async def test_stubbed_output_streams_markdown_through_a2a_message_chunks(
    protected_client: tuple[AsyncClient, StubAcceptanceCriteriaGenerator],
    seeded_project: UUID,
) -> None:
    client, stub_generator = protected_client

    response = await client.post(
        "/a2a/acceptance-criteria",
        headers={"Authorization": "Bearer member-token"},
        json=build_a2a_request(
            metadata={
                "projectId": str(seeded_project),
                "task": {
                    "title": "Ship task form",
                    "description": "Users create tasks from the project board.",
                    "acceptanceCriteria": "- Existing draft can be refined",
                    "priority": "high",
                    "storyPoints": 3,
                    "tag": "tasks",
                    "workflowColumn": "Todo",
                    "mode": "create",
                },
            }
        ),
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/x-ndjson")
    chunks = [line for line in response.text.splitlines() if line]
    decoded = [cast("dict[str, Any]", json.loads(line)) for line in chunks]
    assert [
        decoded[0]["result"]["message"]["parts"][0]["text"],
        decoded[1]["result"]["message"]["parts"][0]["text"],
    ] == [
        "- Users can create tasks",
        "\n- Saved tasks show on the board",
    ]
    assert len(stub_generator.contexts) == 1
    context = stub_generator.contexts[0]
    assert context.project_id == seeded_project
    assert context.title == "Ship task form"
    assert context.workflow_column == "Todo"


def test_prompt_mapping_instructs_concise_markdown_without_boilerplate() -> None:
    context = AcceptanceCriteriaGenerationContext.model_validate(
        {
            "projectId": "00000000-0000-4000-8000-000000000001",
            "title": "Créer une tâche",
            "description": "Les membres ajoutent une tâche au tableau.",
            "acceptanceCriteria": "- Le formulaire reste modifiable",
            "priority": "medium",
            "storyPoints": 2,
            "tag": "kanban",
            "workflowColumn": "Todo",
            "mode": "edit",
        }
    )

    prompt = build_acceptance_criteria_prompt(context)

    assert "Output only 3-7 concise, testable Markdown bullet points" in prompt
    assert "Do not include a preamble" in prompt
    assert "Use the same language as the task context" in prompt
    assert "Avoid generic boilerplate" in prompt
    assert "Avoid implementation details unless they already appear" in prompt
    assert "Créer une tâche" in prompt
    assert "Workflow Column: Todo" in prompt


def test_ai_settings_are_required_at_settings_construction(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("AI__MODEL_NAME", raising=False)
    monkeypatch.delenv("AI__BASE_URL", raising=False)
    monkeypatch.delenv("AI__API_KEY", raising=False)

    with pytest.raises(ValidationError) as exc_info:
        cast("Any", Settings)(
            _env_file=None,
            database_url="sqlite+aiosqlite:///./test.db",
            redis_url="redis://localhost:6379/0",
            environment=Environment.LOCAL,
            auth=AuthSettings(
                discovery_endpoint="https://example.test/.well-known/openid-configuration",
                audience="kanai-api",
            ),
            client_origin="http://localhost:5173",
        )

    assert {error["loc"] for error in exc_info.value.errors()} == {("ai",)}


def build_a2a_request(metadata: dict[str, Any]) -> dict[str, Any]:
    return {
        "jsonrpc": "2.0",
        "id": "request-1",
        "method": "message/stream",
        "params": {
            "message": {
                "role": "user",
                "parts": [{"kind": "text", "text": "Generate acceptance criteria"}],
                "metadata": metadata,
            }
        },
    }
