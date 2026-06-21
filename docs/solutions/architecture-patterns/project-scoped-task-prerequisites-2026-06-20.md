---
title: Model Project-Scoped Task Prerequisites as Dependency Edges
date: 2026-06-20
category: architecture-patterns
module: tasks
problem_type: architecture_pattern
component: service_object
severity: medium
applies_when:
  - "Adding relationship data between project-owned records"
  - "Replacing dependency rows from create or edit form submissions"
  - "Preventing cross-project references or dependency cycles"
  - "Shaping backend task responses for frontend form defaults"
related_components:
  - "database"
  - "testing_framework"
  - "frontend"
tags:
  - "tasks"
  - "prerequisites"
  - "dependencies"
  - "fastapi"
  - "react"
  - "validation"
---

# Model Project-Scoped Task Prerequisites as Dependency Edges

## Context

Kanai added manual task prerequisite support to task create/edit forms in commit `e9fb38e` on `feat/task-prerequisites`. The durable pattern is not the form field itself; it is treating prerequisites as project-scoped graph edges that the backend validates and the frontend submits as IDs.

The implementation spans:

- `api/app/features/tasks/service.py`
- `api/app/repositories/task_repository.py`
- `api/app/schemas/task.py`
- `api/app/services/project_backlog_service.py`
- `client/src/api/client/tasks.ts`
- `client/src/domains/workspace/model/useTaskForm.ts`
- `client/src/domains/workspace/ui/TaskPrerequisitesField.tsx`

## Guidance

Model prerequisites as `TaskDependency` rows, not embedded task fields. Task payloads carry `prerequisite_task_ids`, but persistence lives in dependency edges.

Validate at the service boundary before replacing rows:

```python
async def _replace_prerequisites(
    self,
    project_id: UUID,
    task_id: UUID,
    prerequisite_task_ids: list[UUID],
) -> None:
    if len(set(prerequisite_task_ids)) != len(prerequisite_task_ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Prerequisite tasks must be unique",
        )

    if task_id in prerequisite_task_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="A task cannot depend on itself",
        )

    # Verify every prerequisite is in the same project, then reject cycles.
```

For creates, flush first so dependency rows have a real dependent task ID:

```python
self._session.add(task)
await self._session.flush()
await self._replace_prerequisites(project_id, task.id, payload.prerequisite_task_ids)
await self._session.commit()
```

For edits, replace the full prerequisite set in one transaction and roll back on any validation failure. This keeps task changes and dependency changes atomic.

Keep shared services below feature-layer imports. `ProjectBacklogService` can create `TaskDependency` rows directly, but should not import `app.features.tasks.service`; it is shared project orchestration code, not HTTP task feature code. (session history)

Use the existing task list endpoint for candidate search with optional query params:

- `title`
- `limit`
- `exclude_task_id`

When those params are absent, keep normal list behavior. When present, route to prerequisite candidate search. This avoided a second endpoint just for the picker.

On the frontend, form state stores IDs only:

```ts
listProjectTasks({
  projectId,
  title,
  limit: 10,
  excludeTaskId: taskId,
})

<TaskPrerequisitesField
  projectId={projectId}
  value={form.prerequisiteTaskIds}
  onChange={form.setPrerequisiteTaskIds}
  excludeTaskId={taskId}
/>
```

## Why This Matters

Prerequisites are graph data. One backend boundary should enforce the graph rules:

- no duplicate prerequisite IDs
- no self-dependencies
- no nonexistent or cross-project prerequisite IDs
- no dependency cycles
- atomic replacement on edit

The UI stays boring: search tasks, select IDs, submit IDs. Generated backlog code can reuse the same storage shape without depending on feature-layer services.

## When to Apply

- Adding many-to-many or graph-like relationships between project-owned records
- Letting a form replace an entire relationship set
- Accepting relationship IDs from clients or generated data
- Needing cycle, self-reference, or project-scope validation

Do not embed relationship IDs directly on the parent record when the relationship has graph rules or can have multiple edges.

## Examples

Request/response schema:

```python
class TaskCreate(BaseModel):
    title: str
    prerequisite_task_ids: list[UUID] = Field(default_factory=list)
```

Repository helpers keep relationship reads close to persistence, while the service owns graph validation:

```python
async def prerequisite_ids_by_task(
    self, project_id: UUID, task_ids: set[UUID]
) -> dict[UUID, list[UUID]]:
    ...

async def list_dependency_edges(self, project_id: UUID) -> list[TaskDependency]:
    ...
```

```python
async def _reject_dependency_cycle(
    self, project_id: UUID, task_id: UUID, prerequisite_ids: set[UUID]
) -> None:
    graph = await self._dependency_graph(project_id, task_id, prerequisite_ids)
    if visit(task_id, graph):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT)
```

Frontend API query params stay optional, so the same list method serves normal lists and prerequisite search:

```ts
const searchParams = new URLSearchParams()
if (options.title) searchParams.set("title", options.title)
if (options.limit) searchParams.set("limit", String(options.limit))
if (options.excludeTaskId) searchParams.set("exclude_task_id", options.excludeTaskId)
```

## Related

- `docs/plans/2026-06-20-002-feat-task-prerequisites-plan.md`
- `docs/brainstorms/2026-06-20-task-prerequisites-requirements.md`
- `docs/solutions/integration-issues/pydantic-ai-project-task-shaping-prerequisite-noise-2026-06-20.md`
- `api/tests/services/test_task_prerequisites.py`
