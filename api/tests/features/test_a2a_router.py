import json
from collections.abc import AsyncIterator
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
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
    ProjectTaskShapingGenerationContext,
    ProjectTaskShapingOutput,
    TaskShapingGenerationContext,
    TaskShapingTurnOutput,
    a2a_router,
    build_acceptance_criteria_prompt,
    build_task_shaping_prompt,
    get_acceptance_criteria_generator,
    get_project_task_shaping_generator,
    get_task_shaping_generator,
)
from app.features.a2a.task_shaping import PydanticAiTaskShapingGenerator
from app.models.project import (
    Project,
    ProjectColumn,
    ProjectMember,
    ProjectOwner,
    ProjectSprint,
)
from app.models.task import Task
from app.models.user import User
from app.schemas.auth import AuthenticatedContext
from app.services.auth_service import RequestAuthBoundary

A2A_HEADERS = {
    "Authorization": "Bearer member-token",
    "A2A-Version": "1.0",
}


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


class StubTaskShapingGenerator:
    def __init__(self) -> None:
        self.contexts: list[TaskShapingGenerationContext] = []
        self.next_output: Any | None = None

    async def start_shaping(
        self, context: TaskShapingGenerationContext
    ) -> TaskShapingTurnOutput:
        self.contexts.append(context)
        if self.next_output is not None:
            return cast("TaskShapingTurnOutput", self.next_output)

        return TaskShapingTurnOutput.model_validate(
            {
                "assistantMessage": "What user outcome should this task improve?",
                "question": {
                    "text": "What user outcome should this task improve?",
                    "answerOptions": [
                        {
                            "identifier": "Outcome / Pain",
                            "label": "Start with the workflow pain",
                            "detail": "Name the user outcome and current workflow pain.",
                            "responseText": "Name the user outcome and current workflow pain.",
                            "isRecommended": True,
                        },
                        {
                            "identifier": "Outcome / Pain",
                            "label": "Start with a constraint",
                            "detail": None,
                            "responseText": "Start with a constraint.",
                            "isRecommended": True,
                        },
                    ],
                },
                "fieldDrafts": {
                    "title": "Improve workflow pain",
                    "description": "Clarify the user outcome and handoff context.",
                    "acceptanceCriteria": "- User outcome is testable",
                },
                "metadata": {
                    "isReady": False,
                    "readinessReason": "Needs one more answer",
                    "staleFieldNames": ["title"],
                },
            }
        )


class StubProjectTaskShapingGenerator:
    def __init__(self) -> None:
        self.contexts: list[ProjectTaskShapingGenerationContext] = []

    async def shape_project_tasks(
        self, context: ProjectTaskShapingGenerationContext
    ) -> ProjectTaskShapingOutput:
        self.contexts.append(context)
        if context.operation == "interview":
            return ProjectTaskShapingOutput.model_validate(
                {
                    "operation": "interview",
                    "assistantMessage": "What is the first boundary?",
                    "question": {"text": "What is the first boundary?"},
                    "sharedUnderstanding": None,
                    "drafts": [],
                }
            )
        return ProjectTaskShapingOutput.model_validate(
            {
                "operation": "generateDrafts",
                "assistantMessage": "Draft tasks are ready.",
                "sharedUnderstanding": context.shared_understanding,
                "drafts": [
                    {
                        "key": "api",
                        "title": "Build auth API",
                        "acceptanceCriteria": "API returns session",
                        "prerequisites": [],
                    }
                ],
            }
        )


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
) -> AsyncIterator[
    tuple[AsyncClient, StubAcceptanceCriteriaGenerator, StubTaskShapingGenerator]
]:
    del seeded_users

    app = FastAPI()
    app.add_middleware(
        AuthMiddleware,
        auth_boundary=RequestAuthBoundary(
            StubAuthenticateRequest(),
            whitelist_paths={
                "/a2a/acceptance-criteria/.well-known/agent-card.json",
                "/a2a/task-shaping/.well-known/agent-card.json",
            },
        ),
    )
    app.include_router(a2a_router)

    async def override_get_db() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            yield session

    stub_generator = StubAcceptanceCriteriaGenerator()
    stub_task_shaping_generator = StubTaskShapingGenerator()
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_acceptance_criteria_generator] = lambda: stub_generator
    app.dependency_overrides[get_task_shaping_generator] = lambda: (
        stub_task_shaping_generator
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client, stub_generator, stub_task_shaping_generator


@pytest_asyncio.fixture
async def protected_project_task_shaping_client(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncIterator[tuple[AsyncClient, StubProjectTaskShapingGenerator]]:
    app = FastAPI()
    app.add_middleware(
        AuthMiddleware,
        auth_boundary=RequestAuthBoundary(
            StubAuthenticateRequest(),
            whitelist_paths={
                "/a2a/project-task-shaping/.well-known/agent-card.json",
            },
        ),
    )
    app.include_router(a2a_router)

    async def override_get_db() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            yield session

    stub_generator = StubProjectTaskShapingGenerator()
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_project_task_shaping_generator] = lambda: (
        stub_generator
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client, stub_generator


def test_acceptance_criteria_agent_card_is_reachable_without_bearer_auth() -> None:
    client = build_client()

    response = client.get("/a2a/acceptance-criteria/.well-known/agent-card.json")

    assert response.status_code == 200
    body = response.json()
    assert body["supportedInterfaces"] == [
        {
            "url": "https://api.example.test/a2a/acceptance-criteria",
            "protocolBinding": "JSONRPC",
            "protocolVersion": "1.0",
        }
    ]
    assert body["defaultInputModes"] == ["application/json"]
    assert body["defaultOutputModes"] == ["text/plain"]
    skill = body["skills"][0]
    assert skill["id"] == "acceptance-criteria"
    assert skill["inputModes"] == ["application/json"]
    assert skill["outputModes"] == ["text/plain"]


def test_task_shaping_agent_card_is_reachable_without_bearer_auth() -> None:
    client = build_client()

    response = client.get("/a2a/task-shaping/.well-known/agent-card.json")

    assert response.status_code == 200
    body = response.json()
    assert body["supportedInterfaces"] == [
        {
            "url": "https://api.example.test/a2a/task-shaping",
            "protocolBinding": "JSONRPC",
            "protocolVersion": "1.0",
        }
    ]
    assert body["defaultInputModes"] == ["application/json"]
    assert body["defaultOutputModes"] == ["application/json"]
    skill = body["skills"][0]
    assert skill["id"] == "task-shaping"
    assert skill["name"] == "Task Shaping Chat"
    assert skill["inputModes"] == ["application/json"]
    assert skill["outputModes"] == ["application/json"]


def test_project_task_shaping_agent_card_is_static_public_metadata() -> None:
    client = build_client()

    response = client.get("/a2a/project-task-shaping/.well-known/agent-card.json")

    assert response.status_code == 200
    body = response.json()
    assert body["supportedInterfaces"] == [
        {
            "url": "https://api.example.test/a2a/project-task-shaping",
            "protocolBinding": "JSONRPC",
            "protocolVersion": "1.0",
        }
    ]
    assert body["defaultOutputModes"] == ["application/json"]
    assert body["skills"][0]["id"] == "project-task-shaping"
    assert "Project" in body["name"]
    assert "Project context" not in json.dumps(body)


def test_project_task_shaping_output_rejects_malformed_prerequisites() -> None:
    with pytest.raises(ValidationError):
        ProjectTaskShapingOutput.model_validate(
            {
                "operation": "generateDrafts",
                "assistantMessage": "Drafts are ready.",
                "drafts": [
                    {
                        "key": "api",
                        "title": "Build API",
                        "prerequisites": [{"type": "existing", "key": "api"}],
                    }
                ],
            }
        )


def test_project_task_shaping_output_rejects_duplicate_draft_keys() -> None:
    with pytest.raises(ValidationError):
        ProjectTaskShapingOutput.model_validate(
            {
                "operation": "generateDrafts",
                "assistantMessage": "Drafts are ready.",
                "drafts": [
                    {"key": "api", "title": "Build API"},
                    {"key": "API", "title": "Build API again"},
                ],
            }
        )


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
async def test_project_task_shaping_interview_streams_one_question(
    protected_project_task_shaping_client: tuple[
        AsyncClient, StubProjectTaskShapingGenerator
    ],
    seeded_project: UUID,
) -> None:
    client, stub_generator = protected_project_task_shaping_client

    response = await client.post(
        "/a2a/project-task-shaping",
        headers=A2A_HEADERS,
        json=build_a2a_request(
            project_task_shaping={
                "projectId": str(seeded_project),
                "operation": "interview",
                "idea": "Implement authentication",
                "transcript": [],
            }
        ),
    )

    assert response.status_code == 200
    artifact = extract_project_task_shaping_output(response.text)
    assert artifact["operation"] == "interview"
    assert artifact["question"] == {"text": "What is the first boundary?"}
    assert len(stub_generator.contexts) == 1
    assert stub_generator.contexts[0].idea == "Implement authentication"


@pytest.mark.asyncio
async def test_project_task_shaping_passes_only_eligible_backlog_context(
    protected_project_task_shaping_client: tuple[
        AsyncClient, StubProjectTaskShapingGenerator
    ],
    session_factory: async_sessionmaker[AsyncSession],
    seeded_project: UUID,
) -> None:
    client, stub_generator = protected_project_task_shaping_client
    async with session_factory() as session:
        column = ProjectColumn(project_id=seeded_project, name="To Do", position=0)
        session.add(column)
        await session.commit()
        await session.refresh(column)
        assert column.id is not None
        sprint = ProjectSprint(
            project_id=seeded_project,
            name="Sprint 1",
            planned_start_date=date(2026, 6, 1),
            planned_end_date=date(2026, 6, 14),
        )
        session.add(sprint)
        await session.commit()
        await session.refresh(sprint)
        assert sprint.id is not None
        backlog_task = Task(
            project_id=seeded_project,
            sprint_id=None,
            column_id=column.id,
            title="Eligible backlog task",
            priority="",
            rank="U",
            backlog_rank="U",
        )
        sprint_task = Task(
            project_id=seeded_project,
            sprint_id=sprint.id,
            column_id=column.id,
            title="Sprint task",
            priority="",
            rank="j",
            backlog_rank=None,
        )
        session.add_all([backlog_task, sprint_task])
        await session.commit()
        await session.refresh(backlog_task)
        assert backlog_task.id is not None

    response = await client.post(
        "/a2a/project-task-shaping",
        headers=A2A_HEADERS,
        json=build_a2a_request(
            project_task_shaping={
                "projectId": str(seeded_project),
                "operation": "generateDrafts",
                "sharedUnderstanding": "Ship authentication.",
                "transcript": [],
            }
        ),
    )

    assert response.status_code == 200
    assert [task.id for task in stub_generator.contexts[0].existing_backlog_tasks] == [
        backlog_task.id
    ]


@pytest.mark.asyncio
async def test_project_task_shaping_generates_drafts_from_reviewed_understanding(
    protected_project_task_shaping_client: tuple[
        AsyncClient, StubProjectTaskShapingGenerator
    ],
    seeded_project: UUID,
) -> None:
    client, stub_generator = protected_project_task_shaping_client

    response = await client.post(
        "/a2a/project-task-shaping",
        headers=A2A_HEADERS,
        json=build_a2a_request(
            project_task_shaping={
                "projectId": str(seeded_project),
                "operation": "generateDrafts",
                "sharedUnderstanding": "Ship authentication in reviewable slices.",
                "transcript": [
                    {"role": "assistant", "message": "What is the first boundary?"},
                    {"role": "user", "message": "Start with API before UI."},
                ],
            }
        ),
    )

    assert response.status_code == 200
    artifact = extract_project_task_shaping_output(response.text)
    assert artifact["drafts"][0]["title"] == "Build auth API"
    assert len(stub_generator.contexts) == 1
    context = stub_generator.contexts[0]
    assert context.project_id == seeded_project
    assert context.operation == "generateDrafts"
    assert context.shared_understanding == "Ship authentication in reviewable slices."
    assert context.existing_backlog_tasks == []


@pytest.mark.asyncio
async def test_project_task_shaping_project_access_is_required_before_generation(
    protected_project_task_shaping_client: tuple[
        AsyncClient, StubProjectTaskShapingGenerator
    ],
    seeded_project: UUID,
) -> None:
    client, stub_generator = protected_project_task_shaping_client

    response = await client.post(
        "/a2a/project-task-shaping",
        headers={"Authorization": "Bearer outsider-token", "A2A-Version": "1.0"},
        json=build_a2a_request(
            project_task_shaping={
                "projectId": str(seeded_project),
                "operation": "interview",
                "idea": "Implement authentication",
                "transcript": [],
            }
        ),
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Project not found"}
    assert stub_generator.contexts == []


@pytest.mark.asyncio
async def test_task_shaping_invocation_requires_bearer_auth(
    protected_client: tuple[
        AsyncClient, StubAcceptanceCriteriaGenerator, StubTaskShapingGenerator
    ],
) -> None:
    client, _stub_generator, stub_task_shaping_generator = protected_client

    response = await client.post("/a2a/task-shaping", json={})

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing Authorization header"}
    assert stub_task_shaping_generator.contexts == []


@pytest.mark.asyncio
async def test_task_shaping_project_access_is_required_before_model_invocation(
    protected_client: tuple[
        AsyncClient, StubAcceptanceCriteriaGenerator, StubTaskShapingGenerator
    ],
    seeded_project: UUID,
) -> None:
    client, _stub_generator, stub_task_shaping_generator = protected_client

    response = await client.post(
        "/a2a/task-shaping",
        headers={"Authorization": "Bearer outsider-token", "A2A-Version": "1.0"},
        json=build_a2a_request(
            project_id=str(seeded_project),
            task_shaping_turn={"form": {}, "drafts": {}, "transcript": []},
        ),
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Project not found"}
    assert stub_task_shaping_generator.contexts == []


@pytest.mark.asyncio
async def test_task_shaping_accepts_blank_create_form_payload(
    protected_client: tuple[
        AsyncClient, StubAcceptanceCriteriaGenerator, StubTaskShapingGenerator
    ],
    seeded_project: UUID,
) -> None:
    client, _stub_generator, stub_task_shaping_generator = protected_client

    response = await client.post(
        "/a2a/task-shaping",
        headers=A2A_HEADERS,
        json=build_a2a_request(
            project_id=str(seeded_project),
            task_shaping_turn={
                "form": {
                    "title": None,
                    "description": None,
                    "acceptanceCriteria": None,
                    "priority": None,
                    "storyPoints": None,
                    "workflowColumn": None,
                    "mode": "create",
                },
                "drafts": {"title": "Draft title"},
                "transcript": [
                    {"role": "assistant", "message": "What outcome matters?"},
                    {
                        "role": "user",
                        "message": "Name the user outcome and current workflow pain.",
                    },
                ],
            },
        ),
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "What user outcome should this task improve?" in response.text
    assert "Improve workflow pain" in response.text
    turn = extract_task_shaping_turn(response.text)
    assert turn["question"] == {
        "text": "What user outcome should this task improve?",
        "answerOptions": [
            {
                "identifier": "outcome-pain",
                "label": "Start with the workflow pain",
                "detail": "Name the user outcome and current workflow pain.",
                "responseText": "Name the user outcome and current workflow pain.",
                "isRecommended": True,
            },
            {
                "identifier": "outcome-pain-2",
                "label": "Start with a constraint",
                "detail": None,
                "responseText": "Start with a constraint.",
                "isRecommended": False,
            },
            {
                "identifier": "custom_response",
                "label": "Answer in my own words",
                "detail": "Write a custom response when the suggested answers do not fit.",
                "responseText": "",
                "isRecommended": False,
            },
        ],
    }
    assert (
        sum(option["isRecommended"] for option in turn["question"]["answerOptions"])
        == 1
    )
    assert len(stub_task_shaping_generator.contexts) == 1
    context = stub_task_shaping_generator.contexts[0]
    assert context.project_id == seeded_project
    assert context.form.title is None
    assert context.form.description is None
    assert context.form.mode == "create"
    assert context.drafts.title == "Draft title"
    assert [entry.message for entry in context.transcript] == [
        "What outcome matters?",
        "Name the user outcome and current workflow pain.",
    ]


def test_task_shaping_question_enforces_product_controlled_custom_response_option() -> (
    None
):
    turn = TaskShapingTurnOutput.model_validate(
        {
            "assistantMessage": "Choose an answer.",
            "question": {
                "text": "What should improve?",
                "answerOptions": [
                    {
                        "identifier": "custom_response",
                        "label": "Model-proposed custom copy",
                        "detail": "Do not preserve this.",
                        "responseText": "Do not send this metadata.",
                        "isRecommended": True,
                    },
                    {
                        "identifier": "Outcome / Pain",
                        "label": "Name the pain",
                        "responseText": "Name the pain.",
                    },
                ],
            },
        }
    )

    assert turn.question is not None
    assert [option.identifier for option in turn.question.answer_options] == [
        "outcome-pain",
        "custom_response",
    ]
    assert [option.is_recommended for option in turn.question.answer_options] == [
        True,
        False,
    ]
    custom_option = turn.question.answer_options[-1]
    assert custom_option.label == "Answer in my own words"
    assert custom_option.detail == (
        "Write a custom response when the suggested answers do not fit."
    )
    assert custom_option.response_text == ""


def test_task_shaping_prompt_starts_blank_create_with_desired_outcome() -> None:
    context = TaskShapingGenerationContext.model_validate(
        {
            "projectId": "00000000-0000-4000-8000-000000000001",
            "form": {
                "title": None,
                "description": None,
                "acceptanceCriteria": None,
                "priority": None,
                "storyPoints": None,
                "workflowColumn": None,
                "mode": "create",
            },
        }
    )

    prompt = build_task_shaping_prompt(context)

    assert "blank create form" in prompt
    assert "first ask what desired user outcome" in prompt
    assert "do not start by asking for a title" in prompt


def test_task_shaping_prompt_uses_domain_relevant_next_clarification() -> None:
    partial_context = TaskShapingGenerationContext.model_validate(
        {
            "projectId": "00000000-0000-4000-8000-000000000001",
            "form": {
                "title": "Improve task handoff",
                "description": "",
                "acceptanceCriteria": None,
                "priority": None,
                "storyPoints": None,
                "workflowColumn": None,
                "mode": "create",
            },
        }
    )
    edit_context = TaskShapingGenerationContext.model_validate(
        {
            "projectId": "00000000-0000-4000-8000-000000000001",
            "form": {
                "title": "Improve task handoff",
                "description": "Members can hand off task context.",
                "acceptanceCriteria": None,
                "priority": "medium",
                "storyPoints": None,
                "workflowColumn": "Ready",
                "mode": "edit",
            },
        }
    )

    partial_prompt = build_task_shaping_prompt(partial_context)
    edit_prompt = build_task_shaping_prompt(edit_context)

    assert "partially filled" in partial_prompt
    assert "next domain-relevant clarification" in partial_prompt
    assert "Do not mechanically ask for the first blank field" in partial_prompt
    assert "edit form" in edit_prompt
    assert "weakest next domain clarification" in edit_prompt
    assert "Do not mechanically ask for the first blank field" in edit_prompt


@pytest.mark.asyncio
async def test_pydantic_ai_task_shaping_generator_uses_native_structured_output(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import pydantic_ai
    import pydantic_ai.models.openai
    import pydantic_ai.providers.openai

    calls: dict[str, Any] = {}

    class FakeNativeOutput:
        def __init__(self, outputs: Any, **kwargs: Any) -> None:
            calls["native_output"] = {"outputs": outputs, **kwargs}

    class FakeOpenAIProvider:
        def __init__(self, **kwargs: Any) -> None:
            calls["provider"] = kwargs

    class FakeOpenAIChatModel:
        def __init__(self, model_name: str, *, provider: Any) -> None:
            calls["model"] = {"model_name": model_name, "provider": provider}

    class FakeAgent:
        def __init__(self, model: Any, **kwargs: Any) -> None:
            calls["agent"] = {"model": model, **kwargs}

        async def run(self, prompt: str) -> SimpleNamespace:
            calls["prompt"] = prompt
            return SimpleNamespace(
                output=TaskShapingTurnOutput.model_validate(
                    {
                        "assistantMessage": "What outcome should improve?",
                        "question": {
                            "text": "What outcome should improve?",
                            "answerOptions": [
                                {
                                    "identifier": "outcome",
                                    "label": "Describe the outcome",
                                    "responseText": "Describe the outcome.",
                                    "isRecommended": True,
                                }
                            ],
                        },
                        "fieldDrafts": {},
                        "metadata": {"isReady": False, "staleFieldNames": []},
                    }
                )
            )

    monkeypatch.setattr(pydantic_ai, "Agent", FakeAgent)
    monkeypatch.setattr(pydantic_ai, "NativeOutput", FakeNativeOutput)
    monkeypatch.setattr(
        pydantic_ai.providers.openai, "OpenAIProvider", FakeOpenAIProvider
    )
    monkeypatch.setattr(
        pydantic_ai.models.openai, "OpenAIChatModel", FakeOpenAIChatModel
    )
    context = TaskShapingGenerationContext.model_validate(
        {
            "projectId": "00000000-0000-4000-8000-000000000001",
            "form": {"mode": "create"},
        }
    )

    output = await PydanticAiTaskShapingGenerator().start_shaping(context)

    assert output.assistant_message == "What outcome should improve?"
    assert calls["native_output"] == {
        "outputs": TaskShapingTurnOutput,
        "name": "TaskShapingTurn",
        "description": "A complete structured Task Shaping Chat turn.",
        "strict": True,
    }
    assert calls["agent"]["output_type"] is not None
    assert calls["agent"]["retries"] == 2
    assert "first ask what desired user outcome" in calls["prompt"]


@pytest.mark.asyncio
async def test_task_shaping_invalid_structured_turn_streams_error_without_artifact(
    protected_client: tuple[
        AsyncClient, StubAcceptanceCriteriaGenerator, StubTaskShapingGenerator
    ],
    seeded_project: UUID,
) -> None:
    client, _stub_generator, stub_task_shaping_generator = protected_client
    stub_task_shaping_generator.next_output = {
        "fieldDrafts": {"title": "Do not stream this partial draft"},
        "metadata": {"isReady": False, "staleFieldNames": []},
    }

    response = await client.post(
        "/a2a/task-shaping",
        headers=A2A_HEADERS,
        json=build_a2a_request(
            project_id=str(seeded_project),
            task_shaping_turn={"form": {"mode": "create"}},
        ),
    )

    assert response.status_code == 200
    assert_stream_error(response.text, "assistantMessage")
    assert "task-shaping-turn" not in response.text
    assert "Do not stream this partial draft" not in response.text


@pytest.mark.asyncio
async def test_acceptance_criteria_invocation_requires_bearer_auth(
    protected_client: tuple[
        AsyncClient, StubAcceptanceCriteriaGenerator, StubTaskShapingGenerator
    ],
) -> None:
    client, stub_generator, _stub_task_shaping_generator = protected_client

    response = await client.post("/a2a/acceptance-criteria", json={})

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing Authorization header"}
    assert stub_generator.contexts == []


@pytest.mark.asyncio
async def test_acceptance_criteria_invocation_preserves_invalid_token_auth_response(
    protected_client: tuple[
        AsyncClient, StubAcceptanceCriteriaGenerator, StubTaskShapingGenerator
    ],
) -> None:
    client, stub_generator, _stub_task_shaping_generator = protected_client

    response = await client.post(
        "/a2a/acceptance-criteria",
        headers={"Authorization": "Bearer invalid-token", "A2A-Version": "1.0"},
        json={},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Token is invalid"}
    assert stub_generator.contexts == []


@pytest.mark.asyncio
async def test_malformed_a2a_message_returns_protocol_error(
    protected_client: tuple[
        AsyncClient, StubAcceptanceCriteriaGenerator, StubTaskShapingGenerator
    ],
) -> None:
    client, stub_generator, _stub_task_shaping_generator = protected_client

    response = await client.post(
        "/a2a/acceptance-criteria",
        headers=A2A_HEADERS,
        json={"jsonrpc": "2.0", "id": "request-1", "method": "SendStreamingMessage"},
    )

    assert response.status_code == 200
    assert_stream_error(response.text, "message")
    assert stub_generator.contexts == []


@pytest.mark.asyncio
async def test_project_id_data_is_required_before_model_invocation(
    protected_client: tuple[
        AsyncClient, StubAcceptanceCriteriaGenerator, StubTaskShapingGenerator
    ],
) -> None:
    client, stub_generator, _stub_task_shaping_generator = protected_client

    response = await client.post(
        "/a2a/acceptance-criteria",
        headers=A2A_HEADERS,
        json=build_a2a_request(project_task={"title": "Ship task form"}),
    )

    assert response.status_code == 200
    assert_stream_error(response.text, "projectId data is required")
    assert stub_generator.contexts == []


@pytest.mark.asyncio
async def test_project_access_is_required_before_model_invocation(
    protected_client: tuple[
        AsyncClient, StubAcceptanceCriteriaGenerator, StubTaskShapingGenerator
    ],
    seeded_project: UUID,
) -> None:
    client, stub_generator, _stub_task_shaping_generator = protected_client

    response = await client.post(
        "/a2a/acceptance-criteria",
        headers={"Authorization": "Bearer outsider-token", "A2A-Version": "1.0"},
        json=build_a2a_request(
            project_id=str(seeded_project),
            project_task={"title": "Ship task form"},
        ),
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Project not found"}
    assert stub_generator.contexts == []


@pytest.mark.asyncio
async def test_unknown_project_task_field_returns_safe_client_error(
    protected_client: tuple[
        AsyncClient, StubAcceptanceCriteriaGenerator, StubTaskShapingGenerator
    ],
    seeded_project: UUID,
) -> None:
    client, stub_generator, _stub_task_shaping_generator = protected_client

    response = await client.post(
        "/a2a/acceptance-criteria",
        headers=A2A_HEADERS,
        json=build_a2a_request(
            project_id=str(seeded_project),
            project_task={"title": "Ship task form", "projectDescription": "Nope"},
        ),
    )

    assert response.status_code == 200
    assert_stream_error(response.text, "Unsupported projectTask data field")
    assert stub_generator.contexts == []


@pytest.mark.asyncio
async def test_invalid_project_task_data_returns_safe_protocol_error(
    protected_client: tuple[
        AsyncClient, StubAcceptanceCriteriaGenerator, StubTaskShapingGenerator
    ],
    seeded_project: UUID,
) -> None:
    client, stub_generator, _stub_task_shaping_generator = protected_client

    response = await client.post(
        "/a2a/acceptance-criteria",
        headers=A2A_HEADERS,
        json=build_a2a_request(
            project_id=str(seeded_project),
            project_task="not-an-object",
        ),
    )

    assert response.status_code == 200
    assert_stream_error(response.text, "projectTask data is required")
    assert stub_generator.contexts == []


@pytest.mark.asyncio
async def test_insufficient_project_task_data_returns_safe_client_error(
    protected_client: tuple[
        AsyncClient, StubAcceptanceCriteriaGenerator, StubTaskShapingGenerator
    ],
    seeded_project: UUID,
) -> None:
    client, stub_generator, _stub_task_shaping_generator = protected_client

    response = await client.post(
        "/a2a/acceptance-criteria",
        headers=A2A_HEADERS,
        json=build_a2a_request(
            project_id=str(seeded_project),
            project_task={"priority": "high"},
        ),
    )

    assert response.status_code == 200
    assert_stream_error(response.text, "Task title or description data is required")
    assert stub_generator.contexts == []


@pytest.mark.asyncio
async def test_stubbed_output_streams_markdown_through_a2a_artifact_updates(
    protected_client: tuple[
        AsyncClient, StubAcceptanceCriteriaGenerator, StubTaskShapingGenerator
    ],
    seeded_project: UUID,
) -> None:
    client, stub_generator, _stub_task_shaping_generator = protected_client

    response = await client.post(
        "/a2a/acceptance-criteria",
        headers=A2A_HEADERS,
        json=build_a2a_request(
            project_id=str(seeded_project),
            project_task={
                "title": "Ship task form",
                "description": "Users create tasks from the project board.",
                "acceptanceCriteria": "- Existing draft can be refined",
                "priority": "high",
                "storyPoints": 3,
                "tag": "tasks",
                "workflowColumn": "Todo",
                "mode": "create",
            },
        ),
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "- Users can create tasks" in response.text
    assert "\\n- Saved tasks show on the board" in response.text
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
            public_api_base_url="https://api.example.test",
        )

    assert {error["loc"] for error in exc_info.value.errors()} == {("ai",)}


def test_public_api_base_url_is_required_at_settings_construction(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("PUBLIC_API_BASE_URL", raising=False)

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
            ai={
                "model_name": "test-model",
                "base_url": "https://ai.example.test/v1",
                "api_key": "test-api-key",
            },
            client_origin="http://localhost:5173",
        )

    assert {error["loc"] for error in exc_info.value.errors()} == {
        ("public_api_base_url",)
    }


def build_a2a_request(
    *,
    project_task: Any | None = None,
    project_task_shaping: Any | None = None,
    task_shaping_turn: Any | None = None,
    project_id: str | None = None,
) -> dict[str, Any]:
    data: dict[str, Any] = {}
    if project_task is not None:
        data["projectTask"] = project_task
    if project_task_shaping is not None:
        data["projectTaskShaping"] = project_task_shaping
    if task_shaping_turn is not None:
        data["taskShapingTurn"] = task_shaping_turn
    if project_id is not None:
        data["projectId"] = project_id

    return {
        "jsonrpc": "2.0",
        "id": "request-1",
        "method": "SendStreamingMessage",
        "params": {
            "message": {
                "messageId": "message-1",
                "role": "ROLE_USER",
                "parts": [
                    {"text": "Generate acceptance criteria"},
                    {"data": data},
                ],
            }
        },
    }


def parse_sse_jsonrpc_messages(body: str) -> list[dict[str, Any]]:
    if body.startswith("{"):
        return [cast("dict[str, Any]", json.loads(body))]

    messages = []
    for line in body.splitlines():
        if line.startswith("data: "):
            messages.append(
                cast("dict[str, Any]", json.loads(line.removeprefix("data: ")))
            )
    return messages


def extract_task_shaping_turn(body: str) -> dict[str, Any]:
    for message in parse_sse_jsonrpc_messages(body):
        artifact = (
            message.get("result", {}).get("artifactUpdate", {}).get("artifact", {})
        )
        if not isinstance(artifact, dict):
            continue
        if (
            artifact.get("artifactId") != "task-shaping-turn"
            and artifact.get("name") != "taskShapingTurn"
        ):
            continue

        for part in artifact.get("parts", []):
            if not isinstance(part, dict):
                continue
            if isinstance(part.get("data"), dict):
                return cast("dict[str, Any]", part["data"])
            if isinstance(part.get("text"), str):
                return cast("dict[str, Any]", json.loads(part["text"]))

    raise AssertionError("taskShapingTurn artifact was not streamed")


def extract_project_task_shaping_output(body: str) -> dict[str, Any]:
    for message in parse_sse_jsonrpc_messages(body):
        artifact = (
            message.get("result", {}).get("artifactUpdate", {}).get("artifact", {})
        )
        if not isinstance(artifact, dict):
            continue
        if (
            artifact.get("artifactId") != "project-task-shaping"
            and artifact.get("name") != "projectTaskShaping"
        ):
            continue

        for part in artifact.get("parts", []):
            if not isinstance(part, dict):
                continue
            if isinstance(part.get("data"), dict):
                return cast("dict[str, Any]", part["data"])
            if isinstance(part.get("text"), str):
                return cast("dict[str, Any]", json.loads(part["text"]))

    raise AssertionError("projectTaskShaping artifact was not streamed")


def assert_stream_error(body: str, expected_message: str) -> None:
    messages = parse_sse_jsonrpc_messages(body)
    errors = [message["error"] for message in messages if "error" in message]
    assert errors
    assert expected_message in json.dumps(errors)
