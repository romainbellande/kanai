## Problem Statement

Users can create a new project, but creating a task in that project fails with a validation error because the frontend submits a legacy `status` field in the task request body. The backend task API now rejects extra fields and expects workflow placement to be expressed through a project column ID instead.

This mismatch prevents users from creating tasks from the UI and reveals a broader model inconsistency: project workflow state is partly represented by legacy task status values and partly represented by project columns. Users expect task workflow state to come from the project's actual board columns, whose names are configurable and unique within a project.

## Solution

Make project columns the single source of truth for task workflow state.

Task creation and editing will use project column IDs, not status strings. The task status/select UI will render options from the project's loaded columns, using the column name as the visible label and the column ID as the submitted value. The backend will remove legacy task status persistence and rely on task column relationships. Project column names will be unique per project through model metadata and existing service validation.

The generated OpenAPI client has already been regenerated separately by the user, so this PRD does not require regenerating it during implementation.

## User Stories

1. As a project member, I want to create a task in a new project, so that I can start tracking work immediately.
2. As a project member, I want task creation to succeed without backend validation errors, so that I am not blocked by implementation details.
3. As a project member, I want the task workflow field to show the actual project column names, so that the UI matches my board.
4. As a project member, I want selecting a workflow column during task creation to place the task in that column, so that task placement is predictable.
5. As a project member, I want adding a task from a specific board column to preselect that column, so that I do not need to correct the task's workflow state manually.
6. As a project member, I want task editing to show the task's current workflow column, so that I understand where the task belongs.
7. As a project member, I want to move a task to another workflow column from the edit form, so that I can update task state outside drag-and-drop.
8. As a project member, I want task workflow labels to update when project column names change, so that task screens stay consistent with the board.
9. As a project owner, I want project column names to remain unique within a project, so that form selections are unambiguous.
10. As a project owner, I want duplicate column names to be rejected clearly, so that I know how to fix the workflow configuration.
11. As a user, I want the create task form to wait for project columns before allowing submission, so that tasks are not created into an unknown workflow state.
12. As a user, I want the edit task form to block saving when columns cannot be loaded, so that accidental invalid updates are prevented.
13. As a user, I want a clear error when a task references a missing column, so that data integrity problems are visible.
14. As a developer, I want the task API contract to reject legacy status input, so that clients use the correct column-based model.
15. As a developer, I want the frontend task model to remove legacy status state, so that future code uses column IDs consistently.
16. As a developer, I want generated API artifacts to match the backend schema, so that stale types do not hide contract drift.
17. As a developer, I want task form column-selection rules tested independently, so that edge cases are easy to verify.
18. As a developer, I want backend tests to prove task status is removed, so that the legacy model does not regress.
19. As a developer, I want frontend tests to verify submitted payloads use column IDs, so that the original bug cannot return.
20. As a developer, I want board route tests to verify new-task links pass column IDs, so that column preselection remains correct.
21. As a project member, I want task list and detail views to resolve workflow labels from columns, so that column renames are reflected everywhere.
22. As a project member, I want invalid or stale task-column references to be treated as errors, so that the application does not silently move my work.
23. As a developer, I want task workflow state to have one canonical representation, so that create, edit, list, move, and board behavior stay aligned.
24. As a developer, I want project-column uniqueness to be represented in schema metadata, so that direct table creation preserves the invariant.
25. As a developer, I want existing case-insensitive duplicate checks to remain, so that users get friendly errors before database constraints are hit.

## Implementation Decisions

- Project columns are the single source of truth for task workflow state.
- Task request bodies must use column IDs and must not include status.
- Task response data should expose column IDs and should not expose task status.
- The frontend task domain model will remove legacy status.
- The task create and edit forms will store selected workflow state as a column ID.
- The task workflow select will render options from loaded project columns.
- The visible workflow label will be derived from the selected column's name.
- The new-task route will use `column_id` as the only search parameter for preselecting a workflow column.
- The board already passes a column ID when linking to task creation, and that behavior should become the route contract.
- Task create and edit saves will be blocked until project columns are loaded.
- If a task references a missing project column, saving will be blocked and a clear integrity error will be shown.
- Backend task persistence will remove the legacy task status field.
- Backend task service logic will stop writing denormalized status values.
- Project column names will be unique within a project.
- Exact project-column name uniqueness will be enforced through model metadata.
- Existing case-insensitive service validation will remain for user-friendly duplicate-name rejection.
- No Alembic migration is required for this change because the app currently initializes schema from model metadata in the relevant environments.
- OpenAPI client regeneration is not part of implementation because it has already been completed separately.
- A small pure task-form column-selection helper should be extracted to encapsulate initial selection, validity, loading, and missing-column rules behind a simple testable interface.

## Testing Decisions

Good tests should verify external behavior and contracts rather than implementation details. Tests should assert payloads, API responses, user-visible behavior, validation behavior, and persisted schema invariants.

- Backend task model tests should verify task status is no longer part of the task table metadata.
- Backend task API/service tests should verify create, update, list, get, and move workflows use column IDs and do not accept or return status.
- Backend project-column model tests should verify exact uniqueness of project column names within a project.
- Existing project-column service tests should continue to verify case-insensitive duplicate rejection.
- Frontend task API adapter tests should verify create/update payloads send `column_id` and never send `status`.
- Frontend task API adapter tests should verify responses map `column_id` to the frontend task model.
- Pure task form helper tests should cover default column selection, route-preselected column IDs, missing columns, empty column lists, and invalid selected columns.
- Create task page tests should verify columns are loaded, rendered as select options, and submitted as column IDs.
- Create task page tests should verify submit is blocked when columns are unavailable.
- Task detail page tests should verify the task's current column is selected from loaded columns.
- Task detail page tests should verify saving submits the selected column ID.
- Task detail page tests should verify save is blocked when the task's column cannot be found.
- Board page tests should verify "add task" links include `column_id`.
- Prior frontend tests already exist around task form behavior, task creation pages, task API facade behavior, project board links, and task board grouping.
- Prior backend tests already exist around task column assignment, task move workflows, project column duplicate rejection, and model metadata.

## Out of Scope

- Introducing a full migration workflow for existing production databases.
- Auto-renaming duplicate project columns.
- Supporting legacy `status` query parameters for task creation.
- Supporting legacy task status request payloads.
- Keeping task status as a read-only API field.
- Reworking the entire board drag-and-drop model beyond keeping it column-ID based.
- Changing project status fields unrelated to task workflow state.
- Adding assignee editing or user-directory behavior.
- Redesigning the task create/edit page visual style beyond necessary column-loading states.
- Regenerating the OpenAPI client during this implementation pass, because it has already been regenerated separately.

## Further Notes

The original failure is caused by a frontend/backend contract mismatch: the frontend submits `status`, while the backend task schemas forbid it. The correct fix is not to make the backend accept legacy status again, but to complete the transition to column-based workflow state.

The implementation should be minimal but complete: remove the legacy task status model, update the API boundary, update task forms, rely on the already-regenerated API artifacts, and lock the behavior with tests.
