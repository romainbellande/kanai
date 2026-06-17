"""A2A feature public surface."""

from app.features.a2a.acceptance_criteria import (
    AcceptanceCriteriaGenerationContext,
    AcceptanceCriteriaGenerator,
    build_acceptance_criteria_prompt,
    get_acceptance_criteria_generator,
)
from app.features.a2a.router import a2a_router
from app.features.a2a.task_shaping import (
    TaskShapingGenerationContext,
    TaskShapingGenerator,
    TaskShapingTurnOutput,
    build_task_shaping_prompt,
    get_task_shaping_generator,
)

__all__ = [
    "AcceptanceCriteriaGenerationContext",
    "AcceptanceCriteriaGenerator",
    "TaskShapingGenerationContext",
    "TaskShapingGenerator",
    "TaskShapingTurnOutput",
    "a2a_router",
    "build_acceptance_criteria_prompt",
    "build_task_shaping_prompt",
    "get_acceptance_criteria_generator",
    "get_task_shaping_generator",
]
