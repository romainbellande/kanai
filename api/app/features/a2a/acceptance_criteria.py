"""Acceptance-criteria A2A invocation service boundary."""

from collections.abc import AsyncIterator
from typing import Any, Protocol, cast
from uuid import UUID

from a2a.server.agent_execution import RequestContext
from a2a.types import InvalidParamsError
from google.protobuf.json_format import MessageToDict
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
    context: RequestContext,
) -> AcceptanceCriteriaGenerationContext:
    """Parse structured A2A projectTask data into generation context."""

    data = _extract_project_task_data(context)
    project_id = data.get("projectId")
    if not isinstance(project_id, str) or not project_id.strip():
        raise InvalidParamsError(message="projectId data is required")

    task_metadata = data.get("projectTask")
    if not isinstance(task_metadata, dict):
        raise InvalidParamsError(message="projectTask data is required")

    unknown_fields = set(task_metadata) - ALLOWED_TASK_METADATA_FIELDS
    if unknown_fields:
        raise InvalidParamsError(message="Unsupported projectTask data field")

    try:
        generation_context = AcceptanceCriteriaGenerationContext.model_validate(
            {"projectId": project_id, **task_metadata}
        )
    except ValidationError as exc:
        if any(
            error["type"] == "value_error"
            and "Task title or description metadata is required" in str(error["msg"])
            for error in exc.errors()
        ):
            raise InvalidParamsError(
                message="Task title or description data is required"
            ) from exc
        raise InvalidParamsError(message="Invalid projectTask data") from exc

    return generation_context


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


def _extract_project_task_data(context: RequestContext) -> dict[str, Any]:
    message = context.message
    if message is None:
        raise InvalidParamsError(message="A2A message is required")

    for part in message.parts:
        part_data = MessageToDict(part, preserving_proto_field_name=False).get("data")
        if not isinstance(part_data, dict):
            continue
        if "projectTask" in part_data:
            return cast("dict[str, Any]", part_data)

    raise InvalidParamsError(message="projectTask data part is required")


def _has_text(value: str | None) -> bool:
    return value is not None and bool(value.strip())
