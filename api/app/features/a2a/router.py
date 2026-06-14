"""Routes for A2A-exposed agents."""

import json
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.api.deps import CurrentUser, DatabaseSession
from app.features.a2a.acceptance_criteria import (
    AcceptanceCriteriaGenerationContext,
    AcceptanceCriteriaGenerator,
    get_acceptance_criteria_generator,
    parse_acceptance_criteria_context,
)
from app.services.project_access import ProjectAccess
from app.services.project_service import require_current_user_id

ACCEPTANCE_CRITERIA_SLUG = "acceptance-criteria"

a2a_router = APIRouter(prefix="/a2a", tags=["a2a"])


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
    return {
        "name": "Acceptance Criteria Agent",
        "description": "Generates and reviews acceptance criteria for Kanai PRD slices.",
        "url": f"/a2a/{ACCEPTANCE_CRITERIA_SLUG}",
        "version": "0.1.0",
        "capabilities": {
            "streaming": True,
            "pushNotifications": False,
            "stateTransitionHistory": False,
        },
        "defaultInputModes": ["text/plain"],
        "defaultOutputModes": ["text/plain"],
        "skills": [
            {
                "id": ACCEPTANCE_CRITERIA_SLUG,
                "name": "Acceptance Criteria",
                "description": "Drafts testable acceptance criteria from product context.",
                "tags": ["acceptance-criteria", "prd"],
                "examples": [
                    "Write acceptance criteria for exposing an A2A agent card."
                ],
            }
        ],
    }


@a2a_router.post("/{agent_slug}")
async def invoke_agent(
    agent_slug: str,
    payload: dict[str, Any],
    session: DatabaseSession,
    current_user: CurrentUser,
    generator: AcceptanceCriteriaGenerator = Depends(get_acceptance_criteria_generator),
) -> StreamingResponse:
    """Stream generated acceptance criteria through A2A message chunks."""
    _require_known_agent(agent_slug)

    request_id, context = parse_acceptance_criteria_context(payload)
    await ProjectAccess(session).require_project(
        context.project_id,
        require_current_user_id(current_user.id),
    )

    return StreamingResponse(
        _stream_a2a_message_chunks(request_id, context, generator),
        media_type="application/x-ndjson",
    )


async def _stream_a2a_message_chunks(
    request_id: Any,
    context: AcceptanceCriteriaGenerationContext,
    generator: AcceptanceCriteriaGenerator,
) -> AsyncIterator[str]:
    async for chunk in generator.stream_criteria(context):
        yield (
            json.dumps(
                {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": {
                        "kind": "message",
                        "message": {
                            "role": "agent",
                            "parts": [{"kind": "text", "text": chunk}],
                        },
                    },
                }
            )
            + "\n"
        )
