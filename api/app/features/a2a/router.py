"""Routes for A2A-exposed agents."""

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
from app.services.project_access import ProjectAccess
from app.services.project_service import require_current_user_id

ACCEPTANCE_CRITERIA_SLUG = "acceptance-criteria"

a2a_router = APIRouter(prefix="/a2a", tags=["a2a"])
_REQUEST_STATE_KEY = "kanai_a2a_acceptance_criteria"


def _require_known_agent(agent_slug: str) -> None:
    if agent_slug != ACCEPTANCE_CRITERIA_SLUG:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="A2A agent not found",
        )


@a2a_router.get("/{agent_slug}/.well-known/agent-card.json")
async def get_agent_card(agent_slug: str) -> dict[str, object]:
    """Return the public A2A agent card for a known agent slug."""
    _require_known_agent(agent_slug)
    return _agent_card_to_response(_build_acceptance_criteria_agent_card())


def _build_acceptance_criteria_agent_card() -> AgentCard:
    interface_url = f"{settings.public_api_base_url}/a2a/{ACCEPTANCE_CRITERIA_SLUG}"
    return AgentCard(
        name="Acceptance Criteria Agent",
        description="Generates and reviews acceptance criteria for Kanai PRD slices.",
        supported_interfaces=[
            AgentInterface(
                url=interface_url,
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


def _agent_card_to_response(agent_card: AgentCard) -> dict[str, object]:
    return MessageToDict(agent_card, preserving_proto_field_name=False)


@a2a_router.post("/{agent_slug}")
async def invoke_agent(
    agent_slug: str,
    request: Request,
    session: DatabaseSession,
    current_user: CurrentUser,
    generator: AcceptanceCriteriaGenerator = Depends(get_acceptance_criteria_generator),
) -> Response:
    """Delegate Acceptance Criteria invocation to the A2A SDK JSON-RPC route."""

    _require_known_agent(agent_slug)
    request.scope[_REQUEST_STATE_KEY] = {
        "session": session,
        "current_user": current_user,
        "generator": generator,
    }
    return await _acceptance_criteria_jsonrpc_endpoint(request)


class AcceptanceCriteriaAgentExecutor(AgentExecutor):
    """SDK executor for the Acceptance Criteria agent."""

    async def execute(self, context: RequestContext, event_queue: EventQueue) -> None:
        state = context.call_context.state[_REQUEST_STATE_KEY]
        session = state["session"]
        current_user = state["current_user"]
        generator = state["generator"]

        generation_context = parse_acceptance_criteria_context(context)
        await ProjectAccess(session).require_project(
            generation_context.project_id,
            require_current_user_id(current_user.id),
        )

        task_id = context.task_id or "acceptance-criteria"
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
        task_id = context.task_id or "acceptance-criteria"
        context_id = context.context_id or task_id
        updater = TaskUpdater(event_queue, task_id, context_id)
        await updater.update_status(TaskState.TASK_STATE_CANCELED)


class _KanaiServerCallContextBuilder(DefaultServerCallContextBuilder):
    def build(self, request: Request) -> ServerCallContext:
        context = super().build(request)
        context.state[_REQUEST_STATE_KEY] = request.scope[_REQUEST_STATE_KEY]
        return context


_acceptance_criteria_request_handler = DefaultRequestHandler(
    agent_executor=AcceptanceCriteriaAgentExecutor(),
    task_store=InMemoryTaskStore(),
    agent_card=_build_acceptance_criteria_agent_card(),
)
_acceptance_criteria_jsonrpc_endpoint = create_jsonrpc_routes(
    _acceptance_criteria_request_handler,
    rpc_url="/",
    context_builder=_KanaiServerCallContextBuilder(),
    enable_v0_3_compat=False,
)[0].endpoint
