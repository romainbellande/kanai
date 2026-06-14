"""Acceptance-criteria A2A invocation service boundary."""

from collections.abc import AsyncIterator
from typing import Any, Protocol
from uuid import UUID

from fastapi import HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from app.core.config import settings


ALLOWED_TASK_METADATA_FIELDS = {
    "title",
    "description",
    "acceptanceCriteria",
    "priority",
    "storyPoints",
    "tag",
    "workflowColumn",
    "mode",
}


class AcceptanceCriteriaGenerationContext(BaseModel):
    """Validated task form metadata used to generate acceptance criteria."""

    model_config = ConfigDict(extra="forbid")

    project_id: UUID = Field(alias="projectId")
    title: str | None = None
    description: str | None = None
    acceptance_criteria: str | None = Field(default=None, alias="acceptanceCriteria")
    priority: str | None = None
    story_points: int | None = Field(default=None, alias="storyPoints")
    tag: str | None = None
    workflow_column: str | None = Field(default=None, alias="workflowColumn")
    mode: str | None = None

    @model_validator(mode="after")
    def require_task_context(self) -> "AcceptanceCriteriaGenerationContext":
        if not _has_text(self.title) and not _has_text(self.description):
            raise ValueError("Task title or description metadata is required")
        return self


class AcceptanceCriteriaGenerator(Protocol):
    """Streams acceptance-criteria text from an AI provider."""

    def stream_criteria(
        self, context: AcceptanceCriteriaGenerationContext
    ) -> AsyncIterator[str]:
        """Yield generated Markdown criteria text chunks."""
        ...


class PydanticAiAcceptanceCriteriaGenerator:
    """Pydantic AI-backed acceptance criteria generator."""

    async def stream_criteria(
        self, context: AcceptanceCriteriaGenerationContext
    ) -> AsyncIterator[str]:
        prompt = build_acceptance_criteria_prompt(context)
        try:
            from pydantic_ai import Agent
            from pydantic_ai.models.openai import OpenAIChatModel
            from pydantic_ai.providers.openai import OpenAIProvider
        except ImportError as exc:
            raise RuntimeError("Pydantic AI is not installed") from exc

        provider = OpenAIProvider(
            base_url=settings.ai.base_url,
            api_key=settings.ai.api_key,
        )
        model = OpenAIChatModel(settings.ai.model_name, provider=provider)
        agent = Agent(model)
        async with agent.run_stream(prompt) as result:
            async for text in result.stream_text(delta=True):
                if text:
                    yield text


def parse_acceptance_criteria_context(
    payload: dict[str, Any],
) -> tuple[Any, AcceptanceCriteriaGenerationContext]:
    """Parse A2A JSON-RPC payload metadata into generation context."""

    request_id = payload.get("id")
    if payload.get("jsonrpc") != "2.0" or payload.get("method") != "message/stream":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported A2A request",
        )

    metadata = _extract_message_metadata(payload)
    if "projectId" not in metadata:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="projectId metadata is required",
        )

    task_metadata = metadata.get("task")
    if not isinstance(task_metadata, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task metadata is required",
        )

    unknown_fields = set(task_metadata) - ALLOWED_TASK_METADATA_FIELDS
    if unknown_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported task metadata field",
        )

    try:
        context = AcceptanceCriteriaGenerationContext.model_validate(
            {"projectId": metadata["projectId"], **task_metadata}
        )
    except ValidationError as exc:
        if any(
            error["type"] == "value_error"
            and "Task title or description metadata is required" in str(error["msg"])
            for error in exc.errors()
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Task title or description metadata is required",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid A2A message metadata",
        ) from exc

    return request_id, context


def build_acceptance_criteria_prompt(
    context: AcceptanceCriteriaGenerationContext,
) -> str:
    """Map validated task form context to the model prompt."""

    sections = [
        "Generate Acceptance Criteria for the task form context below.",
        "Rules:",
        "- Output only 3-7 concise, testable Markdown bullet points.",
        "- Do not include a preamble, heading, summary, or explanation.",
        "- Use the same language as the task context; use English only if unclear.",
        "- Avoid generic boilerplate; make every bullet specific to the task context.",
        "- Avoid implementation details unless they already appear in the task context.",
        "Task context:",
    ]

    fields = {
        "Title": context.title,
        "Description": context.description,
        "Existing Acceptance Criteria": context.acceptance_criteria,
        "Priority": context.priority,
        "Story Points": context.story_points,
        "Tag": context.tag,
        "Workflow Column": context.workflow_column,
        "Mode": context.mode,
    }
    for label, value in fields.items():
        if value is not None and str(value).strip():
            sections.append(f"{label}: {value}")

    return "\n".join(sections)


def get_acceptance_criteria_generator() -> AcceptanceCriteriaGenerator:
    """Return the configured acceptance-criteria model boundary."""

    return PydanticAiAcceptanceCriteriaGenerator()


def _extract_message_metadata(payload: dict[str, Any]) -> dict[str, Any]:
    params = payload.get("params")
    if not isinstance(params, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A2A message metadata is required",
        )
    message = params.get("message")
    if not isinstance(message, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A2A message metadata is required",
        )
    metadata = message.get("metadata")
    if not isinstance(metadata, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A2A message metadata is required",
        )
    return metadata


def _has_text(value: str | None) -> bool:
    return value is not None and bool(value.strip())
