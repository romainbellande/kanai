"""Project-level task shaping A2A boundary."""

import json
from typing import Any, Literal, Protocol, cast
from uuid import UUID

from a2a.server.agent_execution import RequestContext
from a2a.types import InvalidParamsError
from google.protobuf.json_format import MessageToDict
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from app.core.config import settings

MAX_TRANSCRIPT_ENTRIES = 20


class ProjectTaskShapingTranscriptEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: str
    message: str = Field(max_length=4000)


class ProjectTaskShapingBacklogTask(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    title: str


class ProjectTaskShapingInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID = Field(alias="projectId")
    operation: Literal["interview", "generateDrafts"]
    idea: str | None = Field(default=None, max_length=8000)
    shared_understanding: str | None = Field(
        default=None, alias="sharedUnderstanding", max_length=8000
    )
    transcript: list[ProjectTaskShapingTranscriptEntry] = Field(
        default_factory=list, max_length=MAX_TRANSCRIPT_ENTRIES
    )

    @model_validator(mode="after")
    def require_operation_text(self) -> "ProjectTaskShapingInput":
        if self.operation == "interview" and not _has_text(self.idea):
            raise ValueError("idea is required")
        if self.operation == "generateDrafts" and not _has_text(
            self.shared_understanding
        ):
            raise ValueError("sharedUnderstanding is required")
        return self


class ProjectTaskShapingGenerationContext(ProjectTaskShapingInput):
    existing_backlog_tasks: list[ProjectTaskShapingBacklogTask] = Field(
        default_factory=list, alias="existingBacklogTasks", max_length=50
    )


class ProjectTaskShapingQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    text: str


class ProjectTaskPrerequisiteRef(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    type: Literal["draft", "existing"]
    key: str | None = None
    task_id: UUID | None = Field(default=None, alias="taskId")

    @model_validator(mode="after")
    def require_matching_value(self) -> "ProjectTaskPrerequisiteRef":
        if self.type == "draft" and not (self.key and self.key.strip()):
            raise ValueError("draft prerequisite key is required")
        if self.type == "existing" and self.task_id is None:
            raise ValueError("existing prerequisite taskId is required")
        if self.type == "draft" and self.task_id is not None:
            raise ValueError("draft prerequisite cannot include taskId")
        if self.type == "existing" and self.key is not None:
            raise ValueError("existing prerequisite cannot include key")
        return self


class ProjectTaskDraftOutput(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    key: str
    title: str
    description: str | None = None
    acceptance_criteria: str | None = Field(default=None, alias="acceptanceCriteria")
    priority: str | None = None
    story_points: int | None = Field(default=None, alias="storyPoints")
    assignee_id: UUID | None = Field(default=None, alias="assigneeId")
    tag: str | None = None
    prerequisites: list[ProjectTaskPrerequisiteRef] = Field(
        default_factory=list, max_length=5
    )


class ProjectTaskShapingOutput(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    operation: Literal["interview", "generateDrafts"]
    assistant_message: str = Field(alias="assistantMessage")
    question: ProjectTaskShapingQuestion | None = None
    shared_understanding: str | None = Field(default=None, alias="sharedUnderstanding")
    drafts: list[ProjectTaskDraftOutput] = Field(default_factory=list, max_length=12)

    @model_validator(mode="after")
    def reject_duplicate_draft_keys(self) -> "ProjectTaskShapingOutput":
        keys = [draft.key.strip().casefold() for draft in self.drafts]
        if len(set(keys)) != len(keys):
            raise ValueError("draft keys must be unique")
        return self


class ProjectTaskShapingGenerator(Protocol):
    async def shape_project_tasks(
        self, context: ProjectTaskShapingGenerationContext
    ) -> ProjectTaskShapingOutput: ...


class PydanticAiProjectTaskShapingGenerator:
    async def shape_project_tasks(
        self, context: ProjectTaskShapingGenerationContext
    ) -> ProjectTaskShapingOutput:
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
                ProjectTaskShapingOutput,
                name="ProjectTaskShapingOutput",
                description="Project-level shaping interview or task draft output.",
                strict=True,
            ),
            retries=2,
        )
        result = await agent.run(build_project_task_shaping_prompt(context))
        return ProjectTaskShapingOutput.model_validate(result.output)


def parse_project_task_shaping_context(
    context: RequestContext,
) -> ProjectTaskShapingInput:
    data = _extract_project_task_shaping_data(context)
    try:
        return ProjectTaskShapingInput.model_validate(data)
    except ValidationError as exc:
        raise InvalidParamsError(message="Invalid projectTaskShaping data") from exc


def build_project_task_shaping_prompt(
    context: ProjectTaskShapingGenerationContext,
) -> str:
    sections = [
        "Shape a broad Kanai project idea into reviewed Backlog task drafts.",
        "Ask exactly one focused question during interview. Generate small independently reviewable drafts only for generateDrafts.",
        f"Operation: {context.operation}",
    ]
    if _has_text(context.idea):
        sections.append(f"Idea: {context.idea}")
    if _has_text(context.shared_understanding):
        sections.append(
            f"Reviewed shared understanding: {context.shared_understanding}"
        )
    if context.transcript:
        sections.append("Visible transcript:")
        sections.extend(
            f"{entry.role}: {entry.message}" for entry in context.transcript
        )
    if context.existing_backlog_tasks:
        sections.append("Eligible existing Backlog prerequisites:")
        sections.extend(
            f"{task.id}: {task.title}" for task in context.existing_backlog_tasks[:50]
        )
    sections.append(
        "Return JSON only. For interview, return a question or editable sharedUnderstanding. For generateDrafts, return drafts with stable keys, editable task fields, and prerequisite refs."
    )
    return "\n".join(sections)


def project_task_shaping_artifact(output: ProjectTaskShapingOutput) -> str:
    return json.dumps(output.model_dump(by_alias=True, mode="json"))


def get_project_task_shaping_generator() -> ProjectTaskShapingGenerator:
    return PydanticAiProjectTaskShapingGenerator()


def _extract_project_task_shaping_data(context: RequestContext) -> dict[str, Any]:
    if context.message is None:
        raise InvalidParamsError(message="A2A message is required")

    for part in context.message.parts:
        part_data = MessageToDict(part, preserving_proto_field_name=False).get("data")
        if isinstance(part_data, dict) and "projectTaskShaping" in part_data:
            payload = part_data["projectTaskShaping"]
            if isinstance(payload, dict):
                return cast("dict[str, Any]", payload)
            raise InvalidParamsError(message="projectTaskShaping data is required")
    raise InvalidParamsError(message="projectTaskShaping data part is required")


def _has_text(value: str | None) -> bool:
    return bool(value and value.strip())
