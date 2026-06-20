---
title: feat: Add Task Prerequisites to Task Forms
type: feat
status: active
date: 2026-06-20
origin: docs/brainstorms/2026-06-20-task-prerequisites-requirements.md
---

# feat: Add Task Prerequisites to Task Forms

## Summary

Implement Task Prerequisites by extending the existing task list/create/update flow, persisting prerequisite edges inline with task saves, and adding a server-backed **Depends on** combobox to the shared task form.

---

## Problem Frame

Kanai already stores prerequisite relationships and generated backlog drafts can express them, but manual Project Task create/edit forms cannot. This leaves project managers without a controlled way to maintain task ordering constraints during normal task planning.

---

## Requirements

- R1. Add **Depends on** to Project Task create and edit forms in the Planning section.
- R2. Allow selecting multiple same-project Project Tasks as prerequisites.
- R3. Render selected prerequisites as removable accessible chips.
- R4. Preserve PATCH semantics: omitted prerequisites on update leave edges unchanged; an empty list clears them.
- R5. Search task titles server-side with 300 ms debounce and a 10-result limit.
- R6. Show recent Project Tasks on empty search, sorted by most recently updated first.
- R7. Rank typed title prefix matches before other title matches, with deterministic tie-breakers.
- R8. Exclude the edited task from its own candidate list while still allowing completed same-project tasks.
- R9. Show task title plus workflow column in each option.
- R10. Save prerequisites inline with task create/update payloads.
- R11. Reject duplicate, missing, cross-project, self-dependent, or cyclic prerequisite sets with a clear form error.
- R12. Preserve existing task list behavior when no search params are supplied.

**Origin actors:** A1 Project manager, A2 Kanai
**Origin flows:** F1 Add prerequisites while creating a task, F2 Update prerequisites on an existing task, F3 Reject an invalid prerequisite graph
**Origin acceptance examples:** AE1 create with prerequisites, AE2 remove chip and save, AE3 typed search ranking, AE4 empty search recency, AE5 edit exclusion, AE6 invalid graph rejection, AE7 unfiltered list compatibility

---

## Scope Boundaries

- No separate dependency-management screen, graph view, or bulk editor.
- No broad refactor of backlog draft dependency validation.
- No dependency suggestions, AI-generated prerequisites, or auto-linking.
- No cross-project prerequisites.
- No database migration requirement unless explicitly requested.
- No hard maximum for manual prerequisites in this version; generated draft limits stay separate.

---

## Context & Research

### Relevant Code and Patterns

- `api/app/models/task.py` already defines `TaskDependency` with a no-self-edge database check.
- `api/app/repositories/task_repository.py` already reads prerequisite IDs and dependency edges.
- `api/app/features/tasks/service.py` is the right place for access checks, create/update orchestration, and graph validation.
- `api/app/services/project_backlog_service.py` has a small DFS cycle-validation pattern worth mirroring without extracting a shared graph service yet.
- `client/src/api/client/tasks.ts` is the hand-written API adapter that maps app-shaped task payloads to API JSON.
- `client/src/api/client/kanai-api.ts` is the facade used by forms and should expose any search helper.
- `client/src/domains/workspace/model/useTaskForm.ts` centralizes create/edit form state and payload construction.
- `client/src/domains/workspace/ui/CreateTaskPage.tsx` and `client/src/domains/workspace/ui/TaskDetailPage.tsx` share the Planning section pattern.
- `client/components.json` uses shadcn base components with `#` import aliases; installed UI primitives are currently minimal.

### Institutional Learnings

- `docs/solutions/integration-issues/pydantic-ai-project-task-shaping-prerequisite-noise-2026-06-20.md`: keep semantic validation strict at boundaries, but avoid carrying draft/existing mixed ref shapes into manual task prerequisites. Manual create/update should accept plain task IDs only.

### External References

- shadcn/Base UI combobox docs: use the project’s base combobox component shape for multi-selection and chips rather than adding a new combobox dependency.

---

## Key Technical Decisions

- Extend the existing project task list endpoint with optional filters: this preserves the unfiltered list contract and avoids a one-off options endpoint.
- Keep prerequisite writes in task create/update transactions: the task and its prerequisite edges should not diverge on partial failure.
- Validate graph state against existing dependency edges after replacing the edited task’s outgoing edges: this avoids false cycle failures when a user removes or changes dependencies.
- Reject duplicate prerequisite IDs instead of silently normalizing them: this matches existing bulk prerequisite validation and catches client bugs.
- Use `updated_at desc`, then `created_at desc`, then `id asc` as deterministic search tie-breakers.
- Keep the frontend field as one small domain component plus shared form state changes: no new dependency graph UI layer.

---

## Open Questions

### Resolved During Planning

- Update save semantics: omitted prerequisites leave edges unchanged; `[]` clears all prerequisites.
- Manual prerequisite cap: no manual cap for now.
- Search endpoint shape: extend the existing list endpoint with optional params and preserve no-param behavior.
- Search tie-breakers: use updated time, created time, then ID.

### Deferred to Implementation

- Exact component API after adding shadcn combobox: use the generated component’s actual props rather than forcing a prewritten shape.
- Exact error detail strings: keep them clear and stable enough for form mapping, but let implementation align with current API error conventions.

---

## Implementation Units

### U1. Backend schema and searchable task list

**Goal:** Extend task list reads so the frontend can search prerequisite candidates without changing current unfiltered behavior.

**Requirements:** R5, R6, R7, R8, R9, R12

**Dependencies:** None

**Files:**
- Modify: `api/app/schemas/task.py`
- Modify: `api/app/features/tasks/router.py`
- Modify: `api/app/features/tasks/service.py`
- Modify: `api/app/repositories/task_repository.py`
- Test: `api/tests/modules/project/test_project_router.py`

**Approach:**
- Add optional list params for title search, limit, and edited-task exclusion.
- Route no-param requests through the current ordering path unchanged.
- Add a filtered repository query for prerequisite search that scopes to the project, title-matches only, includes all columns/statuses, and applies prefix-first ordering for typed search.
- Keep returned objects as normal task reads so selected IDs can hydrate labels from the same shape.

**Patterns to follow:**
- Existing `TaskRepository.list_by_project` ordering for unfiltered behavior.
- Existing FastAPI route dependency style in `api/app/features/tasks/router.py`.

**Test scenarios:**
- Covers AE7. Happy path: request project tasks with no query params and verify current ordering/response shape remains compatible.
- Covers AE3. Happy path: search `draft` and verify title prefix matches sort before contains matches.
- Covers AE4. Happy path: open empty search with a limit and verify recently updated tasks are returned with deterministic tie-breakers.
- Covers AE5. Edge case: pass an edited task ID and verify that task is excluded while other same-project tasks remain.
- Edge case: completed/Done-column tasks are included in prerequisite search.
- Error path: invalid limit or malformed excluded task ID is rejected by request validation.

**Verification:**
- Unfiltered project task consumers still receive the same list behavior.
- Search results are project-scoped, deterministic, and limited.

---

### U2. Backend prerequisite save and graph validation

**Goal:** Persist prerequisite edges inline with task create/update and reject invalid graphs before commit.

**Requirements:** R2, R4, R10, R11

**Dependencies:** U1

**Files:**
- Modify: `api/app/schemas/task.py`
- Modify: `api/app/features/tasks/service.py`
- Modify: `api/app/repositories/task_repository.py`
- Test: `api/tests/services/test_task_prerequisites.py`
- Test: `api/tests/modules/project/test_project_router.py`

**Approach:**
- Add `prerequisite_task_ids` to create and update schemas; update should distinguish omitted from present empty list.
- Create omitted or empty prerequisites as no edges.
- Update only replaces edges when the field is present.
- Validate duplicates, same-project membership, missing tasks, self-dependency, and cycles in the service before committing.
- Change create/update persistence for prerequisite saves to stage the task, flush to obtain IDs when needed, validate/add edges, then commit once.
- Add/use a dedicated outgoing-edge delete for prerequisite replacement; keep the broader edge delete helper only for task deletion/project cleanup.
- Roll back task and edge writes together on failure.

**Execution note:** Start with service-level tests for replacement semantics and cycle validation before changing persistence behavior.

**Patterns to follow:**
- `ProjectBacklogService._reject_cycles` DFS shape, copied or minimally shared only if implementation makes that cheaper.
- Existing `TaskRepository.add_dependency_edges` and `delete_dependency_edges_for_tasks` transaction style.
- Existing `TaskService.create` / `TaskService.update` access validation and response conversion.

**Test scenarios:**
- Covers AE1. Happy path: create a task with two prerequisite IDs, persist edges, and return both IDs.
- Covers AE2. Happy path: update a task from two prerequisites to one and verify the removed edge is gone.
- Edge case: update with omitted prerequisites leaves existing edges unchanged.
- Edge case: update with an empty list clears all outgoing prerequisite edges.
- Edge case: create with omitted or empty prerequisite IDs creates no dependency edges.
- Error path: reject duplicate prerequisite IDs.
- Error path: reject missing or cross-project prerequisite IDs.
- Covers AE6. Error path: reject direct self-dependency.
- Covers AE6. Error path: reject a cycle built from existing edges plus the submitted replacement edges.
- Integration: failed prerequisite validation does not persist task field changes or partial edges.

**Verification:**
- Task create/update responses include accurate prerequisite IDs.
- Invalid graph saves fail clearly and atomically.

---

### U3. Frontend API client support

**Goal:** Let the frontend send prerequisite IDs and search task candidates through the hand-written API client.

**Requirements:** R4, R5, R6, R7, R8, R10, R12

**Dependencies:** U1, U2

**Files:**
- Modify: `client/src/api/client/tasks.ts`
- Modify: `client/src/api/client/kanai-api.ts`
- Test: `client/src/api/client/tasks.test.ts`
- Test: `client/src/api/client/kanai-api.test.tsx`

**Approach:**
- Add `prerequisiteTaskIds` to create/update input mapping as `prerequisite_task_ids`.
- Regenerate the OpenAPI client after backend schema changes, or replace the local create/update input aliases with hand-written app input types that include `prerequisiteTaskIds`.
- Add typed list/search params while preserving the existing no-params query key and URL.
- Expose a facade helper for prerequisite search/fetch that does not pollute the main project task cache with filtered results.
- Make API errors carry response detail enough for the form to display dependency validation failures.

**Patterns to follow:**
- Existing `taskInputToJson` camel-to-snake mapping.
- Existing query option and facade invalidation patterns in `kanai-api.ts`.

**Test scenarios:**
- Happy path: create payload includes `prerequisite_task_ids` when supplied.
- Happy path: update payload includes `prerequisite_task_ids: []` when clearing prerequisites.
- Edge case: update payload omits `prerequisite_task_ids` when form state intentionally leaves it unchanged.
- Covers AE7. Compatibility: `listProjectTasks(projectId)` still calls the no-query URL.
- Covers AE3/AE4/AE5. Search helper builds the expected query string for search, limit, and exclusion.
- Error path: failed API response exposes detail for form-level error mapping.

**Verification:**
- Frontend API tests prove URL and payload contracts without relying on generated client files.

---

### U4. Shared task form prerequisite state

**Goal:** Centralize prerequisite selection state so create and edit pages save the same way.

**Requirements:** R1, R2, R4, R10, R11

**Dependencies:** U3

**Files:**
- Modify: `client/src/domains/workspace/model/useTaskForm.ts`
- Test: `client/src/domains/workspace/model/useTaskForm.test.tsx`

**Approach:**
- Add `prerequisiteTaskIds` to task form values.
- Initialize create mode with an empty list and edit mode from the loaded task.
- Reset edit form prerequisites when the edited task changes and the form is not dirty, matching existing edit reset behavior.
- Provide a small setter/toggler/remover API for prerequisite IDs instead of making pages manipulate internal state directly.
- Submit selected IDs in create and update payloads.
- Map dependency validation API details into the existing form-level error message.

**Patterns to follow:**
- Existing dirty-state and edit reset logic in `useTaskForm`.
- Existing form-level error message pattern.

**Test scenarios:**
- Happy path: create submit includes selected prerequisite IDs.
- Happy path: edit initializes from `task.prerequisiteTaskIds` and submits changed IDs.
- Covers AE2. Happy path: removing a selected ID submits the remaining set.
- Edge case: edit task reload resets prerequisite IDs when not dirty.
- Edge case: edit submit after changing an unrelated field preserves prerequisites according to PATCH semantics and does not accidentally clear or replace them.
- Error path: dependency validation detail appears as a clear form error and preserves current form values.

**Verification:**
- Create/edit pages can consume one form API for prerequisite state.

---

### U5. Depends on combobox component and page integration

**Goal:** Add the visible **Depends on** multi-select field to create and edit forms.

**Requirements:** R1, R2, R3, R5, R6, R8, R9, R11

**Dependencies:** U3, U4

**Files:**
- Modify: `client/components.json`
- Create/modify: `client/src/components/ui/combobox.tsx`
- Create only if generated combobox/chip composition requires it: `client/src/components/ui/badge.tsx`
- Create: `client/src/domains/workspace/ui/TaskPrerequisitesField.tsx`
- Modify: `client/src/domains/workspace/ui/CreateTaskPage.tsx`
- Modify: `client/src/domains/workspace/ui/TaskDetailPage.tsx`
- Test: `client/src/domains/workspace/ui/TaskPrerequisitesField.test.tsx`

**Approach:**
- Add only the shadcn components needed for the combobox and chips.
- Render prerequisite chips locally inside the domain field unless the generated combobox/chip implementation requires a shared primitive.
- Build a small domain field that owns debounced search text, loading/error/empty states, and selected chip rendering.
- Use existing project columns to render workflow column names for options and selected chips.
- Exclude already-selected IDs in the option list client-side, in addition to the server exclusion for the edited task.
- Place the field in the Planning section of both pages.
- For preselected IDs whose full task data is not currently loaded, render a safe fallback until search/list data hydrates the label.

**Patterns to follow:**
- Existing Field / FieldLabel / FieldDescription form composition.
- shadcn base combobox multi-selection and chip composition.
- Existing page layout classes and semantic token usage.

**Test scenarios:**
- Covers AE4. Happy path: opening with no typed value requests recent task options.
- Covers AE3. Happy path: typing waits for debounce before requesting search results.
- Covers AE1. Happy path: selecting two options adds two chips and updates form state.
- Covers AE2. Happy path: clicking a chip remove control removes that ID.
- Covers AE5. Edge case: edit mode excludes the current task from results.
- Edge case: already-selected tasks do not appear again as selectable options.
- Error path: search failure shows a non-blocking field error while preserving selected chips.
- Accessibility: remove controls have labels that identify the prerequisite task.
- Integration: create and edit pages render **Depends on** in the Planning section and submit selected prerequisite IDs through the shared form.

**Verification:**
- Both task forms show **Depends on** in Planning and can add/remove prerequisites before submit.

---

## System-Wide Impact

- **Interaction graph:** Task create/update now coordinates task row persistence and dependency edge persistence.
- **Error propagation:** Backend validation details must reach the task form as form-level errors instead of collapsing into a generic save failure.
- **State lifecycle risks:** Update validation must remove the edited task’s old outgoing edges from the candidate graph before checking submitted replacement edges.
- **API surface parity:** Main task list must remain compatible for existing board/backlog/detail consumers while filtered search adds optional behavior.
- **Integration coverage:** Router tests should prove API contract compatibility; form/API tests should prove payload and error mapping.
- **Unchanged invariants:** No cross-project dependencies, no dependency graph UI, no database migration requirement.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Filtered task list accidentally changes board ordering | Keep no-param path on the existing repository method and test compatibility. |
| Cycle validation falsely rejects legitimate replacement updates | Build the graph after removing the edited task’s old outgoing edges. |
| Selected chip labels are missing on edit load | Hydrate from existing task list/search results and show a safe fallback while data catches up. |
| New shadcn component API differs from assumptions | Add via CLI, read generated files, and adapt the domain component to the actual generated API. |
| Generic frontend errors fail the clear-error requirement | Preserve API detail through the client layer and map dependency validation details in `useTaskForm`. |

---

## Documentation / Operational Notes

- No user-facing docs update is required for this feature.
- No migration file should be added under current project policy.
- Regenerate the OpenAPI client only if the implementation workflow requires generated type updates; do not hand-edit generated client files.

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-06-20-task-prerequisites-requirements.md](../brainstorms/2026-06-20-task-prerequisites-requirements.md)
- Strategy: [STRATEGY.md](../../STRATEGY.md)
- Backend guide: [api/AGENTS.md](../../api/AGENTS.md)
- Frontend guide: [docs/agent-instructions/frontend.md](../agent-instructions/frontend.md)
- Testing guide: [docs/agent-instructions/testing.md](../agent-instructions/testing.md)
- Learning: [docs/solutions/integration-issues/pydantic-ai-project-task-shaping-prerequisite-noise-2026-06-20.md](../solutions/integration-issues/pydantic-ai-project-task-shaping-prerequisite-noise-2026-06-20.md)
