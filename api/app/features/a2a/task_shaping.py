"""Task Shaping Chat A2A invocation service boundary."""

import re
from typing import Any, Protocol, cast
from uuid import UUID

from a2a.server.agent_execution import RequestContext
from a2a.types import InvalidParamsError
from google.protobuf.json_format import MessageToDict
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from app.core.config import settings


CUSTOM_RESPONSE_OPTION_IDENTIFIER = "custom_response"


def _custom_response_answer_option() -> dict[str, Any]:
    return {
        "identifier": CUSTOM_RESPONSE_OPTION_IDENTIFIER,
        "label": "Answer in my own words",
        "detail": "Write a custom response when the suggested answers do not fit.",
        "responseText": "",
        "isRecommended": False,
    }


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


class TaskShapingAnswerOption(BaseModel):
    """A selectable answer option for the active question."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    identifier: str
    label: str
    detail: str | None = None
    response_text: str = Field(alias="responseText")
    is_recommended: bool = Field(default=False, alias="isRecommended")


class TaskShapingInterviewQuestion(BaseModel):
    """The active focused question and its visible predefined answers."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    text: str
    answer_options: list[TaskShapingAnswerOption] = Field(
        alias="answerOptions", min_length=1
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_answer_options(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        answer_options = data.get("answerOptions", data.get("answer_options"))
        if not isinstance(answer_options, list):
            return data

        normalized_options: list[Any] = []
        seen_identifiers: dict[str, int] = {}
        first_recommended_index: int | None = None
        for option in answer_options:
            if not isinstance(option, dict):
                normalized_options.append(option)
                continue

            normalized_option = dict(option)
            raw_identifier = normalized_option.get("identifier")
            if (
                isinstance(raw_identifier, str)
                and raw_identifier.strip() == CUSTOM_RESPONSE_OPTION_IDENTIFIER
            ):
                continue

            response_text = normalized_option.pop("response_text", None)
            if response_text is not None and "responseText" not in normalized_option:
                normalized_option["responseText"] = response_text
            identifier = _ui_safe_answer_option_identifier(
                normalized_option.get("identifier"), len(normalized_options)
            )
            duplicate_count = seen_identifiers.get(identifier, 0)
            seen_identifiers[identifier] = duplicate_count + 1
            if duplicate_count:
                identifier = f"{identifier}-{duplicate_count + 1}"
            normalized_option["identifier"] = identifier

            is_recommended = (
                normalized_option.pop("is_recommended", None) is True
                or normalized_option.get("isRecommended") is True
            )
            if is_recommended:
                if first_recommended_index is None:
                    first_recommended_index = len(normalized_options)
                normalized_option["isRecommended"] = False

            normalized_options.append(normalized_option)

        if normalized_options:
            recommended_index = first_recommended_index or 0
            recommended_option = normalized_options[recommended_index]
            if isinstance(recommended_option, dict):
                recommended_option["isRecommended"] = True

        normalized_options.append(_custom_response_answer_option())

        normalized_data = dict(data)
        normalized_data.pop("answer_options", None)
        normalized_data["answerOptions"] = normalized_options
        return normalized_data


class TaskShapingTurnOutput(BaseModel):
    """Structured assistant output for one Task Shaping Chat turn."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    assistant_message: str = Field(alias="assistantMessage")
    question: TaskShapingInterviewQuestion | None = None
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
            from pydantic_ai import Agent, NativeOutput
            from pydantic_ai.models.openai import OpenAIChatModel
            from pydantic_ai.providers.openai import OpenAIProvider
        except ImportError as exc:
            raise RuntimeError("Pydantic AI is not installed") from exc

        provider = OpenAIProvider(
            base_url=settings.ai.base_url,
            api_key=settings.ai.api_key,
        )
        model = OpenAIChatModel(settings.ai.model_name, provider=provider)
        agent = Agent(
            model,
            output_type=NativeOutput(
                TaskShapingTurnOutput,
                name="TaskShapingTurn",
                description="A complete structured Task Shaping Chat turn.",
                strict=True,
            ),
            retries=2,
        )
        result = await agent.run(prompt)
        return TaskShapingTurnOutput.model_validate(result.output)


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
        "Start Task Shaping Chat for a Kanai Project Task form.",
        _task_shaping_focus_instruction(context),
        "Ask exactly one focused question and include visible answer options with exactly one recommended option.",
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

    if len(sections) == 5:
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
        "Return structured output with assistant message, one focused question with visible answer options, optional Title/Description/Acceptance Criteria drafts, and readiness metadata. Exactly one answer option must be marked recommended when a question is present, and response text must not add hidden meaning beyond the visible label/detail."
    )
    return "\n".join(sections)


def _task_shaping_focus_instruction(context: TaskShapingGenerationContext) -> str:
    form = context.form
    has_title = bool(form.title and form.title.strip())
    has_description = bool(form.description and form.description.strip())
    has_acceptance_criteria = bool(
        form.acceptance_criteria and form.acceptance_criteria.strip()
    )
    is_blank_create = (
        form.mode == "create"
        and not has_title
        and not has_description
        and not has_acceptance_criteria
        and not form.priority
        and form.story_points is None
        and not form.workflow_column
    )

    if is_blank_create:
        return (
            "Because this is a blank create form, first ask what desired user outcome "
            "the task should improve; do not start by asking for a title, priority, "
            "story points, or workflow column."
        )

    if form.mode == "edit":
        return (
            "Because this is an edit form, inspect the existing title, description, "
            "acceptance criteria, drafts, and transcript, then ask the weakest next "
            "domain clarification: desired outcome, current pain, scope, constraints, "
            "or testable acceptance signal. Do not mechanically ask for the first blank field."
        )

    return (
        "Because this form is partially filled, ask the next domain-relevant "
        "clarification that most improves the task: desired outcome, current pain, "
        "scope, constraints, or testable acceptance signal. Do not mechanically ask "
        "for the first blank field."
    )


def get_task_shaping_generator() -> TaskShapingGenerator:
    """Return the configured Task Shaping model boundary."""

    return PydanticAiTaskShapingGenerator()


def _ui_safe_answer_option_identifier(value: Any, index: int) -> str:
    raw_identifier = str(value).strip().lower() if value is not None else ""
    normalized = re.sub(r"[^a-z0-9]+", "-", raw_identifier).strip("-")
    return normalized or f"option-{index + 1}"


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
