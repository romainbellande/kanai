---
title: Tolerate Project Task Shaping Prerequisite Noise
date: 2026-06-20
category: integration-issues
module: api/features/a2a/project-task-shaping
problem_type: integration_issue
component: assistant
symptoms:
  - "Pydantic AI raised UnexpectedModelBehavior/output retries for recoverable prerequisite reference noise"
  - "Draft prerequisites with both key and taskId failed output validation"
  - "Existing prerequisites with stray key values failed output validation"
root_cause: logic_error
resolution_type: code_fix
severity: medium
tags:
  - "a2a"
  - "pydantic-ai"
  - "output-validation"
  - "task-shaping"
---

# Tolerate Project Task Shaping Prerequisite Noise

## Problem

Project-level task shaping could fail when Pydantic AI generated otherwise valid prerequisite refs with extra discriminator-specific fields. Implementation reference: commit `a0eca17` on `feat/project-task-shaping`.

## Symptoms

- Pydantic AI raised `UnexpectedModelBehavior` after output retries were exhausted. (memory)
- Draft prerequisites sometimes contained both `key` and `taskId`.
- Existing prerequisites sometimes contained both `taskId` and an irrelevant `key`.
- The A2A generator used strict native output validation, so recoverable shape noise became a hard generation failure.

## What Didn't Work

- Strictly rejecting irrelevant fields treated harmless LLM noise as invalid output:

```python
if self.type == "draft" and self.task_id is not None:
    raise ValueError("draft prerequisite cannot include taskId")
if self.type == "existing" and self.key is not None:
    raise ValueError("existing prerequisite cannot include key")
```

The meaningful discriminator was `type`; extra data on the non-selected side did not need another model retry.

## Solution

Normalize the prerequisite ref at the Pydantic output boundary. Keep missing required identifiers strict, but strip irrelevant ones:

```python
@model_validator(mode="after")
def require_matching_value(self) -> "ProjectTaskPrerequisiteRef":
    if self.type == "draft":
        if not (self.key and self.key.strip()):
            raise ValueError("draft prerequisite key is required")
        self.task_id = None
        return self
    if self.task_id is None:
        raise ValueError("existing prerequisite taskId is required")
    self.key = None
    return self
```

Add focused regression tests for both noisy shapes:

```python
output = ProjectTaskShapingOutput.model_validate({
    "operation": "generateDrafts",
    "assistantMessage": "Drafts are ready.",
    "drafts": [{
        "key": "ui",
        "title": "Build UI",
        "prerequisites": [
            {"type": "draft", "key": "api", "taskId": str(uuid4())},
            {"type": "existing", "key": "ignored", "taskId": str(uuid4())},
        ],
    }],
})

assert output.drafts[0].prerequisites[0].task_id is None
assert output.drafts[0].prerequisites[1].key is None
```

Changed files in the fix commit:

- `api/app/features/a2a/project_task_shaping.py`
- `api/tests/features/test_a2a_router.py`

## Why This Works

- `type == "draft"` makes the draft-local `key` authoritative; `taskId` is noise and can be cleared.
- `type == "existing"` makes `taskId` authoritative; `key` is noise and can be cleared.
- Missing required identifiers still fail fast: draft refs need `key`, existing refs need `taskId`.
- Strictness stays at the semantic boundary instead of spending retries on recoverable formatting noise.

## Prevention

- Normalize recoverable LLM output noise at the A2A output boundary before treating it as retry-worthy.
- Add regression coverage for every tolerated noisy shape, including existing prerequisites with both `taskId` and `key`.
- When debugging A2A validation, prefer targeted serial backend tests first; xdist agent-card failures were observed separately and were not part of this fix. (memory)

## Related Issues

- `docs/plans/2026-06-20-001-feat-project-level-task-shaping-plan.md` — closest parent plan for project-level task shaping; refresh candidate because it should distinguish unrecoverable malformed output from recoverable discriminator noise.
- `docs/brainstorms/2026-06-20-project-level-task-shaping-requirements.md` — product context for Backlog task generation and dependency links.
- `docs/prd/0007-task-shaping-structured-answer-options.md` — prior art for structured model-output validation and retry behavior.
