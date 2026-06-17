"""Routes for A2A-exposed agents."""

from collections.abc import Callable
from dataclasses import dataclass
import json
from typing import Any

from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.context import ServerCallContext
from a2a.server.events import EventQueue
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.routes import create_jsonrpc_routes
from a2a.server.routes.common import DefaultServerCallContextBuilder
from a2a.server.tasks import InMemoryTaskStore, TaskUpdater
from a2a.types import AgentCapabilities, AgentCard, AgentInterface, AgentSkill
from a2a.types import Part, Task, TaskState, TaskStatus
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from google.protobuf.json_format import MessageToDict

from app.api.deps import CurrentUser, DatabaseSession
from app.core.config import settings
from app.features.a2a.acceptance_criteria import (
    AcceptanceCriteriaGenerator,
    get_acceptance_criteria_generator,
    parse_acceptance_criteria_context,
)
from app.features.a2a.task_shaping import (
    TaskShapingGenerator,
    get_task_shaping_generator,
    parse_task_shaping_context,
)
from app.services.project_access import ProjectAccess
from app.services.project_service import require_current_user_id

ACCEPTANCE_CRITERIA_SLUG = "acceptance-criteria"
TASK_SHAPING_SLUG = "task-shaping"

_REQUEST_STATE_KEY = "kanai_a2a_agent"

a2a_router = APIRouter(prefix="/a2a", tags=["a2a"])


@dataclass(frozen=True)
class A2AAgentRegistration:
    """Runtime registration for a Kanai A2A agent."""

    slug: str
    agent_card: AgentCard
    endpoint: Callable[[Request], Any]


def _agent_interface_url(slug: str) -> str:
    return f"{settings.public_api_base_url}/a2a/{slug}"


def _build_acceptance_criteria_agent_card() -> AgentCard:
    return AgentCard(
        name="Acceptance Criteria Agent",
        description="Generates and reviews acceptance criteria for Kanai PRD slices.",
        supported_interfaces=[
            AgentInterface(
                url=_agent_interface_url(ACCEPTANCE_CRITERIA_SLUG),
                protocol_binding="JSONRPC",
                protocol_version="1.0",
            )
        ],
        version="0.1.0",
        capabilities=AgentCapabilities(
            streaming=True,
            push_notifications=False,
        ),
        default_input_modes=["application/json"],
        default_output_modes=["text/plain"],
        skills=[
            AgentSkill(
                id=ACCEPTANCE_CRITERIA_SLUG,
                name="Acceptance Criteria",
                description="Drafts testable acceptance criteria from product context.",
                tags=["acceptance-criteria", "prd"],
                examples=["Write acceptance criteria for exposing an A2A agent card."],
                input_modes=["application/json"],
                output_modes=["text/plain"],
            )
        ],
    )


def _build_task_shaping_agent_card() -> AgentCard:
    return AgentCard(
        name="Task Shaping Chat Agent",
        description="Starts an ephemeral chat that shapes Project Task create-form text fields.",
        supported_interfaces=[
            AgentInterface(
                url=_agent_interface_url(TASK_SHAPING_SLUG),
                protocol_binding="JSONRPC",
                protocol_version="1.0",
            )
        ],
        version="0.1.0",
        capabilities=AgentCapabilities(
            streaming=True,
            push_notifications=False,
        ),
        default_input_modes=["application/json"],
        default_output_modes=["application/json"],
        skills=[
            AgentSkill(
                id=TASK_SHAPING_SLUG,
                name="Task Shaping Chat",
                description="Asks focused questions to shape a Project Task draft from current form context.",
                tags=["task-shaping", "project-task", "chat"],
                examples=["Start shaping a blank Project Task create form."],
                input_modes=["application/json"],
                output_modes=["application/json"],
            )
        ],
    )


def _agent_card_to_response(agent_card: AgentCard) -> dict[str, object]:
    return MessageToDict(agent_card, preserving_proto_field_name=False)


@a2a_router.get("/{agent_slug}/.well-known/agent-card.json")
async def get_agent_card(agent_slug: str) -> dict[str, object]:
    """Return the public A2A agent card for a known agent slug."""

    return _agent_card_to_response(_get_agent_registration(agent_slug).agent_card)


@a2a_router.post("/{agent_slug}")
async def invoke_agent(
    agent_slug: str,
    request: Request,
    session: DatabaseSession,
    current_user: CurrentUser,
    acceptance_criteria_generator: AcceptanceCriteriaGenerator = Depends(
        get_acceptance_criteria_generator
    ),
    task_shaping_generator: TaskShapingGenerator = Depends(get_task_shaping_generator),
) -> Response:
    """Delegate invocation to the registered A2A SDK JSON-RPC route."""

    registration = _get_agent_registration(agent_slug)
    request.scope[_REQUEST_STATE_KEY] = {
        "session": session,
        "current_user": current_user,
        "generators": {
            ACCEPTANCE_CRITERIA_SLUG: acceptance_criteria_generator,
            TASK_SHAPING_SLUG: task_shaping_generator,
        },
    }
    return await registration.endpoint(request)


class AcceptanceCriteriaAgentExecutor(AgentExecutor):
    """SDK executor for the Acceptance Criteria agent."""

    async def execute(self, context: RequestContext, event_queue: EventQueue) -> None:
        state = context.call_context.state[_REQUEST_STATE_KEY]
        session = state["session"]
        current_user = state["current_user"]
        generator = state["generators"][ACCEPTANCE_CRITERIA_SLUG]

        generation_context = parse_acceptance_criteria_context(context)
        await ProjectAccess(session).require_project(
            generation_context.project_id,
            require_current_user_id(current_user.id),
        )

        task_id = context.task_id or ACCEPTANCE_CRITERIA_SLUG
        context_id = context.context_id or task_id
        await event_queue.enqueue_event(
            Task(
                id=task_id,
                context_id=context_id,
                status=TaskStatus(state=TaskState.TASK_STATE_WORKING),
            )
        )

        updater = TaskUpdater(event_queue, task_id, context_id)
        full_text = ""
        artifact_id = "acceptance-criteria-delta"
        has_delta_artifact = False
        async for chunk in generator.stream_criteria(generation_context):
            full_text += chunk
            await updater.add_artifact(
                [Part(text=chunk)],
                artifact_id=artifact_id,
                name="acceptanceCriteriaDelta",
                append=has_delta_artifact,
                last_chunk=False,
            )
            has_delta_artifact = True

        if full_text:
            await updater.add_artifact(
                [Part(text=full_text)],
                artifact_id="acceptance-criteria-final",
                name="acceptanceCriteriaFinal",
                append=False,
                last_chunk=True,
            )
        await updater.complete()

    async def cancel(self, context: RequestContext, event_queue: EventQueue) -> None:
        task_id = context.task_id or ACCEPTANCE_CRITERIA_SLUG
        context_id = context.context_id or task_id
        updater = TaskUpdater(event_queue, task_id, context_id)
        await updater.update_status(TaskState.TASK_STATE_CANCELED)


class TaskShapingAgentExecutor(AgentExecutor):
    """SDK executor for the Task Shaping Chat agent."""

    async def execute(self, context: RequestContext, event_queue: EventQueue) -> None:
        state = context.call_context.state[_REQUEST_STATE_KEY]
        session = state["session"]
        current_user = state["current_user"]
        generator = state["generators"][TASK_SHAPING_SLUG]

        generation_context = parse_task_shaping_context(context)
        await ProjectAccess(session).require_project(
            generation_context.project_id,
            require_current_user_id(current_user.id),
        )

        task_id = context.task_id or TASK_SHAPING_SLUG
        context_id = context.context_id or task_id
        await event_queue.enqueue_event(
            Task(
                id=task_id,
                context_id=context_id,
                status=TaskStatus(state=TaskState.TASK_STATE_WORKING),
            )
        )

        updater = TaskUpdater(event_queue, task_id, context_id)
        turn_output = await generator.start_shaping(generation_context)
        await updater.add_artifact(
            [
                Part(
                    text=json.dumps(turn_output.model_dump(by_alias=True, mode="json")),
                    media_type="application/json",
                )
            ],
            artifact_id="task-shaping-turn",
            name="taskShapingTurn",
            append=False,
            last_chunk=True,
        )
        await updater.complete()

    async def cancel(self, context: RequestContext, event_queue: EventQueue) -> None:
        task_id = context.task_id or TASK_SHAPING_SLUG
        context_id = context.context_id or task_id
        updater = TaskUpdater(event_queue, task_id, context_id)
        await updater.update_status(TaskState.TASK_STATE_CANCELED)


class _KanaiServerCallContextBuilder(DefaultServerCallContextBuilder):
    def build(self, request: Request) -> ServerCallContext:
        context = super().build(request)
        context.state[_REQUEST_STATE_KEY] = request.scope[_REQUEST_STATE_KEY]
        return context


def _create_jsonrpc_endpoint(
    agent_executor: AgentExecutor,
    agent_card: AgentCard,
) -> Callable[[Request], Any]:
    request_handler = DefaultRequestHandler(
        agent_executor=agent_executor,
        task_store=InMemoryTaskStore(),
        agent_card=agent_card,
    )
    return create_jsonrpc_routes(
        request_handler,
        rpc_url="/",
        context_builder=_KanaiServerCallContextBuilder(),
        enable_v0_3_compat=False,
    )[0].endpoint


_ACCEPTANCE_CRITERIA_AGENT_CARD = _build_acceptance_criteria_agent_card()
_TASK_SHAPING_AGENT_CARD = _build_task_shaping_agent_card()
_AGENT_REGISTRY = {
    ACCEPTANCE_CRITERIA_SLUG: A2AAgentRegistration(
        slug=ACCEPTANCE_CRITERIA_SLUG,
        agent_card=_ACCEPTANCE_CRITERIA_AGENT_CARD,
        endpoint=_create_jsonrpc_endpoint(
            AcceptanceCriteriaAgentExecutor(),
            _ACCEPTANCE_CRITERIA_AGENT_CARD,
        ),
    ),
    TASK_SHAPING_SLUG: A2AAgentRegistration(
        slug=TASK_SHAPING_SLUG,
        agent_card=_TASK_SHAPING_AGENT_CARD,
        endpoint=_create_jsonrpc_endpoint(
            TaskShapingAgentExecutor(),
            _TASK_SHAPING_AGENT_CARD,
        ),
    ),
}


def _get_agent_registration(agent_slug: str) -> A2AAgentRegistration:
    try:
        return _AGENT_REGISTRY[agent_slug]
    except KeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="A2A agent not found",
        ) from exc
