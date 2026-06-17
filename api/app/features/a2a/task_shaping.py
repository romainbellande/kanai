"""Task Shaping Chat A2A invocation service boundary."""

from typing import Any, Protocol, cast
from uuid import UUID

from a2a.server.agent_execution import RequestContext
from a2a.types import InvalidParamsError
from google.protobuf.json_format import MessageToDict
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.core.config import settings


class TaskShapingFormContext(BaseModel):
    """Current Project Task form fields visible to Task Shaping Chat."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = None
    description: str | None = None
    acceptance_criteria: str | None = Field(default=None, alias="acceptanceCriteria")
    priority: str | None = None
    story_points: int | None = Field(default=None, alias="storyPoints")
    workflow_column: str | None = Field(default=None, alias="workflowColumn")
    mode: str | None = None


class TaskShapingDrafts(BaseModel):
    """Current available Task Shaping field drafts supplied by the client."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = None
    description: str | None = None
    acceptance_criteria: str | None = Field(default=None, alias="acceptanceCriteria")


class TaskShapingTranscriptEntry(BaseModel):
    """A visible Task Shaping transcript message."""

    model_config = ConfigDict(extra="forbid")

    role: str
    message: str


class TaskShapingGenerationContext(BaseModel):
    """Validated Project Task form, draft, and transcript data used by Task Shaping Chat."""

    model_config = ConfigDict(extra="forbid")

    project_id: UUID = Field(alias="projectId")
    form: TaskShapingFormContext
    drafts: TaskShapingDrafts = Field(default_factory=TaskShapingDrafts)
    transcript: list[TaskShapingTranscriptEntry] = Field(default_factory=list)


class TaskShapingFieldDrafts(BaseModel):
    """Optional field drafts returned by Task Shaping Chat."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    title: str | None = None
    description: str | None = None
    acceptance_criteria: str | None = Field(default=None, alias="acceptanceCriteria")


class TaskShapingTurnMetadata(BaseModel):
    """Readiness and staleness metadata for a Task Shaping turn."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    is_ready: bool = Field(default=False, alias="isReady")
    readiness_reason: str | None = Field(default=None, alias="readinessReason")
    stale_field_names: list[str] = Field(default_factory=list, alias="staleFieldNames")


class TaskShapingTurnOutput(BaseModel):
    """Structured assistant output for one Task Shaping Chat turn."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    assistant_message: str = Field(alias="assistantMessage")
    recommended_answer: str | None = Field(default=None, alias="recommendedAnswer")
    field_drafts: TaskShapingFieldDrafts = Field(
        default_factory=TaskShapingFieldDrafts, alias="fieldDrafts"
    )
    metadata: TaskShapingTurnMetadata = Field(default_factory=TaskShapingTurnMetadata)


class TaskShapingGenerator(Protocol):
    """Generates Task Shaping Chat assistant turns."""

    async def start_shaping(
        self, context: TaskShapingGenerationContext
    ) -> TaskShapingTurnOutput:
        """Return structured assistant output for the supplied turn context."""
        ...


class PydanticAiTaskShapingGenerator:
    """Pydantic AI-backed Task Shaping generator."""

    async def start_shaping(
        self, context: TaskShapingGenerationContext
    ) -> TaskShapingTurnOutput:
        prompt = build_task_shaping_prompt(context)
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
        result = await agent.run(prompt)
        return TaskShapingTurnOutput(
            assistantMessage=str(result.output),
            recommendedAnswer="Answer with the user outcome, current pain, and any hard constraints.",
            metadata=TaskShapingTurnMetadata(
                isReady=False,
                readinessReason="More task context is needed before proposing complete drafts.",
            ),
        )


def parse_task_shaping_context(context: RequestContext) -> TaskShapingGenerationContext:
    """Parse structured A2A projectTask data into Task Shaping context."""

    data = _extract_project_task_data(context)
    project_id = data.get("projectId")
    if not isinstance(project_id, str) or not project_id.strip():
        raise InvalidParamsError(message="projectId data is required")

    turn_data = data.get("taskShapingTurn")
    if not isinstance(turn_data, dict):
        raise InvalidParamsError(message="taskShapingTurn data is required")

    try:
        return TaskShapingGenerationContext.model_validate(
            {"projectId": project_id, **turn_data}
        )
    except ValidationError as exc:
        raise InvalidParamsError(message="Invalid taskShapingTurn data") from exc


def build_task_shaping_prompt(context: TaskShapingGenerationContext) -> str:
    """Map validated form context to the initial Task Shaping prompt."""

    sections = [
        "Start Task Shaping Chat for a Kanai Project Task create form.",
        "Ask exactly one focused question and include a recommended answer or direction.",
        "Keep the response concise and useful even when the form is blank.",
        "Current form context:",
    ]
    fields: dict[str, Any] = {
        "Title": context.form.title,
        "Description": context.form.description,
        "Acceptance Criteria": context.form.acceptance_criteria,
        "Priority": context.form.priority,
        "Story Points": context.form.story_points,
        "Workflow Column": context.form.workflow_column,
        "Mode": context.form.mode,
    }
    for label, value in fields.items():
        if value is not None and str(value).strip():
            sections.append(f"{label}: {value}")

    if len(sections) == 4:
        sections.append("The form is blank.")

    draft_fields = context.drafts.model_dump(by_alias=True, exclude_none=True)
    if draft_fields:
        sections.append("Current field drafts:")
        for name, value in draft_fields.items():
            sections.append(f"{name}: {value}")

    if context.transcript:
        sections.append("Visible transcript:")
        for entry in context.transcript:
            sections.append(f"{entry.role}: {entry.message}")

    sections.append(
        "Return structured output with assistant message, recommended answer or direction, optional Title/Description/Acceptance Criteria drafts, and readiness metadata."
    )
    return "\n".join(sections)


def get_task_shaping_generator() -> TaskShapingGenerator:
    """Return the configured Task Shaping model boundary."""

    return PydanticAiTaskShapingGenerator()


def _extract_project_task_data(context: RequestContext) -> dict[str, Any]:
    message = context.message
    if message is None:
        raise InvalidParamsError(message="A2A message is required")

    for part in message.parts:
        part_data = MessageToDict(part, preserving_proto_field_name=False).get("data")
        if not isinstance(part_data, dict):
            continue
        if "taskShapingTurn" in part_data:
            return cast("dict[str, Any]", part_data)

    raise InvalidParamsError(message="taskShapingTurn data part is required")
