---
date: 2026-06-20
topic: task-prerequisites
---

# Task Prerequisites

## Summary

Project Task create and edit forms will include a **Depends on** field for selecting multiple same-project Task Prerequisites. The field will support searchable selection, recent-task discovery, inline save with the task, and validation that prevents invalid dependency graphs.

---

## Problem Frame

Project managers need to capture ordering constraints between tasks while shaping and maintaining project work. Kanai already treats prerequisites as part of task planning in generated backlog drafts, but manual task creation and editing do not yet expose that relationship in the task form.

Without a visible form field, users either lose dependency intent when creating tasks manually or must rely on generated drafts to express prerequisite relationships. That creates a gap between planned task structure and day-to-day task maintenance.

---

## Actors

- A1. Project manager: Creates and edits Project Tasks while planning execution order.
- A2. Kanai: Stores task prerequisite relationships and prevents invalid dependency graphs.

---

## Key Flows

- F1. Add prerequisites while creating a task
  - **Trigger:** A project manager opens the Project Task create form.
  - **Actors:** A1, A2
  - **Steps:** The project manager opens **Depends on**, searches or browses recent Project Tasks, selects one or more prerequisites, and saves the task.
  - **Outcome:** The new task is saved with its selected prerequisites.
  - **Covered by:** R1, R2, R3, R5

- F2. Update prerequisites on an existing task
  - **Trigger:** A project manager edits a Project Task.
  - **Actors:** A1, A2
  - **Steps:** The project manager adds or removes selected prerequisite chips, then saves the task.
  - **Outcome:** The task's prerequisite set reflects the current form selection.
  - **Covered by:** R1, R3, R4, R5

- F3. Reject an invalid prerequisite graph
  - **Trigger:** A project manager tries to save prerequisites that would make the task depend on itself or create a dependency cycle.
  - **Actors:** A1, A2
  - **Steps:** Kanai checks the submitted prerequisite set before completing the save.
  - **Outcome:** The save is blocked and the form shows a clear error.
  - **Covered by:** R6

---

## Requirements

**Form behavior**
- R1. The Project Task create and edit forms must include a **Depends on** field in the Planning section.
- R2. The field must allow selecting multiple Project Tasks as prerequisites.
- R3. Selected prerequisites must appear as removable chips with accessible remove controls.
- R4. Updating an existing task must allow adding prerequisites, removing prerequisites, or leaving the prerequisite set unchanged.

**Search and selection**
- R5. The selector must search same-project Project Tasks by title, debounce typed search by 300 ms, and show up to 10 results.
- R6. Opening the selector with no typed search must show recent Project Tasks, sorted by most recently updated first with stable tie-breakers.
- R7. Typed search results must rank title prefix matches before other title matches, with each group sorted by most recently updated first.
- R8. Search results must exclude the task currently being edited and may include completed tasks.
- R9. Each result must show the task title and its workflow column for disambiguation.

**Saving and validation**
- R10. Creating or updating a task must save the selected prerequisites inline with the rest of the task form.
- R11. Kanai must reject direct self-dependencies and dependency cycles with a clear form-level error.
- R12. Existing task list behavior must remain unchanged when no search, limit, or exclusion filters are applied.

---

## Acceptance Examples

- AE1. **Covers R1, R2, R10.** Given a project manager creates a task and selects two tasks in **Depends on**, when they save, the created task has both selected prerequisites.
- AE2. **Covers R3, R4, R10.** Given an existing task has two prerequisite chips, when the project manager removes one chip and saves, the task keeps only the remaining prerequisite.
- AE3. **Covers R5, R7, R9.** Given the project has tasks titled “Draft launch brief” and “Review draft brief,” when the project manager searches “draft,” prefix matches appear before other title matches and each option shows its workflow column.
- AE4. **Covers R6.** Given the project manager opens **Depends on** without typing, when results load, the list shows up to 10 recently updated Project Tasks.
- AE5. **Covers R8.** Given the project manager edits Task A, when they search prerequisites, Task A is not selectable but completed same-project tasks may appear.
- AE6. **Covers R11.** Given the selected prerequisites would make Task A depend on itself or create a cycle, when the project manager saves, Kanai blocks the save and shows a clear error.
- AE7. **Covers R12.** Given existing callers load a project task list without filters, when the list is requested, the returned behavior remains compatible with the current task list.

---

## Success Criteria

- Project managers can express task ordering constraints from the same create/edit flow they already use for task planning.
- A downstream implementation agent can build the feature without inventing selection behavior, search behavior, save semantics, or invalid-graph handling.
- Existing task list consumers keep working without changes.

---

## Scope Boundaries

- No separate dependency-management screen, graph view, or bulk editor.
- No broad refactor of backlog draft dependency validation.
- No dependency suggestions, AI-generated prerequisites, or auto-linking.
- No cross-project prerequisites.
- No database migration requirement unless explicitly requested.

---

## Key Decisions

- Use the canonical domain term **Task Prerequisite** and the UI label **Depends on**: keeps product language clear while preserving a natural form label.
- Support multiple prerequisites: matches the existing domain shape and real planning needs.
- Use server-backed search: keeps selection usable as project task counts grow.
- Save prerequisites inline with task create/update: keeps prerequisite editing in the user's existing task form flow.
- Include completed tasks as candidates: finished work can still be a valid prerequisite.
- Block cycles on save: dependency data should remain trustworthy.

---

## Dependencies / Assumptions

- Task prerequisite relationships already exist as a domain concept and are exposed on task reads.
- Project workflow columns are available where task options are rendered.
- The existing task list behavior can be extended compatibly for filtered search.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R11][Technical] Decide the smallest reuse of existing cycle-validation logic without introducing a broad refactor.
- [Affects R5, R6, R7][Technical] Confirm the exact stable tie-breakers for deterministic search ordering.
