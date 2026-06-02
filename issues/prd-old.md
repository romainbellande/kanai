## Problem Statement

Kanai users can currently organize tasks on a project board, but the board columns are fixed by the application rather than owned by the project. The visible board uses hardcoded columns such as To Do, In Progress, and Done, and tasks are grouped by a free-form status string. This prevents project owners from shaping the workflow to match how their team actually works.

Users need to be able to manage the columns for an existing project, including adding, renaming, reordering, and deleting columns, and those changes must persist in the database. The board, task creation flow, and task detail flow must all use the persisted project columns instead of hardcoded status values. Members should still be able to use the board and move tasks through the workflow, while only project owners should be able to change the shared column structure.

## Solution

Introduce first-class persisted project columns. Each project will have its own ordered set of columns with stable IDs, names, positions, and timestamps. New projects will automatically receive default columns so they remain immediately usable. Tasks will belong to columns by stable column ID instead of by status string.

Project owners will manage columns directly from the board. They can add a new column, rename an existing column, move a column left or right, and delete an empty column after confirmation. The application will prevent deleting a non-empty column and prevent deleting the final remaining column. Project members will be able to read columns and move tasks between existing columns, but they will not see column-management controls.

The backend will expose dedicated project-column API endpoints, enforce ownership and validation rules, and keep task-column relationships consistent. The frontend will load project columns separately, render the board from persisted columns, replace task status controls with column selectors, and regenerate the OpenAPI client so the UI compiles against the updated API contract.

## User Stories

1. As a project owner, I want my project board columns to be persisted, so that my workflow remains the same after refreshing the page.
2. As a project owner, I want to add a new board column, so that I can model an additional workflow stage for my project.
3. As a project owner, I want a newly added column to appear at the end of the board, so that it appears where the add-column action is located.
4. As a project owner, I want to rename an existing board column, so that the board language matches my team process.
5. As a project owner, I want renamed columns to keep their tasks, so that changing a label does not disrupt work.
6. As a project owner, I want column names to be trimmed, so that accidental whitespace does not create confusing labels.
7. As a project owner, I want invalid empty column names to be rejected, so that every column has a useful label.
8. As a project owner, I want duplicate column names to be rejected within a project, so that the board does not show ambiguous columns.
9. As a project owner, I want column names to have a reasonable maximum length, so that board headers remain usable.
10. As a project owner, I want to move a column left, so that I can refine the order of my workflow.
11. As a project owner, I want to move a column right, so that I can refine the order of my workflow.
12. As a project owner, I want column order changes to persist, so that the board stays in the order I chose.
13. As a project owner, I want column reordering to be applied atomically, so that the board never ends up with duplicated or missing positions.
14. As a project owner, I want to delete an empty column, so that I can remove workflow stages my project no longer needs.
15. As a project owner, I want to confirm before deleting a column, so that I do not accidentally remove shared project configuration.
16. As a project owner, I want deletion of non-empty columns to be blocked, so that tasks are not hidden, orphaned, or deleted accidentally.
17. As a project owner, I want deletion of the last remaining column to be blocked, so that the project always has a valid task destination.
18. As a project owner, I want all columns to be generic and manageable, so that default columns do not have hidden special behavior.
19. As a project owner, I want to manage columns inline on the board, so that I do not have to leave the workflow view to configure it.
20. As a project owner, I want add and rename interactions to happen inline, so that column management feels lightweight.
21. As a project owner, I want column-management actions to wait for the API response, so that the board only changes after persistence succeeds.
22. As a project owner, I want clear error feedback when a column action fails, so that I can understand whether the name is invalid, the column has tasks, or I lack permission.
23. As a project member, I want to see the project's persisted columns, so that I can understand the team's current workflow.
24. As a project member, I want to move tasks between existing columns, so that I can update work status without needing owner permissions.
25. As a project member, I do not want to see owner-only column-management controls, so that the UI only shows actions I can perform.
26. As a project member, I want the board to block rendering if columns cannot load, so that I am not shown misleading hardcoded fallback columns.
27. As a project member, I want a retryable column-load error, so that I can recover from a temporary API failure.
28. As a task creator, I want new tasks to default to the first project column when no column is specified, so that task creation remains quick.
29. As a task creator, I want to choose a project column when creating a task, so that the task starts in the correct workflow stage.
30. As a task creator, I want the board's create-task link to preselect the column I started from, so that creating work in a specific column is efficient.
31. As a task editor, I want to change a task's column from the task detail screen, so that I can update its workflow stage outside the board.
32. As a task editor, I want task detail to show real project columns, so that custom workflow names are reflected consistently.
33. As a task editor, I want moving a task to reject columns from another project, so that tasks cannot be assigned to invalid project state.
34. As a project owner, I want newly created projects to receive default columns, so that a fresh project is usable immediately.
35. As a developer, I want project columns to have stable IDs, so that renaming a column does not change task membership.
36. As a developer, I want tasks to reference columns by ID, so that task grouping is not dependent on mutable display names.
37. As a developer, I want task status removed from the task API, so that there is one source of truth for task workflow placement.
38. As a developer, I want column validation centralized in a backend service, so that naming, ordering, permission, and delete rules are enforced consistently.
39. As a developer, I want column ordering to use simple integer positions, so that reorder behavior is easy to validate and test.
40. As a developer, I want the reorder API to accept the complete ordered list of column IDs, so that the backend can validate duplicates, missing columns, and foreign columns before writing positions.
41. As a developer, I want column-management endpoints to be nested under projects, so that API ownership and access rules are clear.
42. As a developer, I want a separate columns query on the frontend, so that project metadata and board configuration are independent resources.
43. As a developer, I want the generated frontend API client updated from the backend contract, so that the application uses the new task and column types safely.
44. As a developer, I want database initialization to reset and recreate tables when startup initialization is enabled, so that the development database matches the current model schema without Alembic migration work.
45. As a developer, I want database reset behavior guarded by the existing startup-initialization setting, so that non-init environments are not reset unexpectedly.
46. As a developer, I want obsolete task-rank repair startup logic removed, so that database initialization has one clear reset/create behavior.
47. As a tester, I want backend tests for column creation, update, reorder, delete, and permissions, so that persisted workflow management is reliable.
48. As a tester, I want backend tests for task column assignment, so that tasks cannot be created or moved into invalid columns.
49. As a tester, I want frontend tests for board rendering from persisted columns, so that the UI does not regress to hardcoded columns.
50. As a tester, I want frontend tests for task create and detail column selectors, so that task flows remain aligned with custom columns.

## Implementation Decisions

- Build a first-class project-column domain with stable column IDs rather than relying on task status strings.
- Add a persisted project-column model with project ownership, display name, integer position, creation timestamp, and update timestamp.
- Replace task workflow placement with a required column ID relationship.
- Remove task status from task create, update, and read API contracts.
- Keep project-level status metadata unchanged because it is separate from task workflow columns.
- Automatically create default columns named To Do, In Progress, and Done for new projects.
- Treat all columns as generic after creation; no default column is protected or semantically special.
- Use integer column positions and normalize positions after create, delete, and reorder operations.
- Append newly created columns to the end of the project board.
- Reject empty column names after trimming whitespace.
- Enforce a maximum column name length of 80 characters.
- Enforce case-insensitive uniqueness of trimmed column names within each project.
- Restrict column management to project owners.
- Allow owners and members to read project columns.
- Preserve member ability to move tasks between existing columns.
- Reject task create or update requests when the submitted column ID does not belong to the task's project.
- Default task creation to the first column by position when no column ID is provided.
- Add dedicated project-column endpoints for list, create, update, delete, and reorder.
- Do not add a single-column read endpoint for now because the UI only needs the ordered list.
- Use a full ordered column-ID list for reorder requests so the backend can validate the complete desired state atomically.
- Return a no-content response after successful column deletion.
- Use conflict responses for duplicate names, non-empty column deletion, and last-column deletion.
- Use not-found responses for inaccessible or missing projects and columns.
- Use validation-style responses for invalid submitted task column IDs.
- Load columns as a separate frontend query resource rather than embedding them in project metadata.
- Do not render hardcoded fallback columns when persisted columns fail to load.
- Manage columns inline on the board.
- Use inline inputs for add and rename interactions.
- Use a custom inline confirmation flow for column deletion.
- Use Move left and Move right actions for column reordering instead of column drag-and-drop in the first implementation.
- Hide owner-only column-management controls from non-owner users while keeping backend authorization authoritative.
- Wait for successful API responses before updating the board for column-management actions.
- Replace task status controls in task create and detail flows with project-column selectors.
- Replace create-task URL status search parameters with column-ID search parameters.
- Regenerate the frontend OpenAPI client from the updated backend contract.
- Reset and recreate database tables during startup database initialization when the existing initialization setting allows it.
- Do not add an Alembic migration for this change.
- Remove the existing task-rank startup repair path as part of simplifying database initialization.
- Treat the backend project-column service as the main deep module: it should encapsulate validation, ownership checks, ordering, delete invariants, and persistence coordination behind a stable interface.
- Keep task-column validation in backend service logic so task creation and task updates cannot bypass project-column rules.
- Keep frontend API wrappers as a thin boundary over generated client calls.
- Keep board grouping logic as a small pure function that groups tasks by persisted column IDs and can be tested without rendering the full board.

## Testing Decisions

- Good tests should validate observable behavior and API contracts, not private implementation details.
- Backend tests should assert returned payloads, status codes, persistence effects, authorization behavior, validation failures, and ordering outcomes.
- Frontend tests should assert user-visible behavior, submitted API payloads, loading/error states, and rendered column/task relationships.
- Test the project-column backend model metadata so the database schema has the expected required fields and relationships.
- Test the project-column service or router behavior for listing columns in order.
- Test creating a column appends it to the end and returns the persisted column.
- Test renaming a column trims and persists the new name.
- Test duplicate column names are rejected within a project.
- Test reordering with a full column-ID list rewrites positions correctly.
- Test reorder rejects duplicate, missing, or foreign column IDs.
- Test deleting an empty non-final column succeeds.
- Test deleting a non-empty column fails.
- Test deleting the last remaining column fails.
- Test non-owners cannot create, rename, reorder, or delete columns.
- Test owners and members can list columns.
- Test task creation defaults to the first column when column ID is omitted.
- Test task creation accepts a valid project column ID.
- Test task creation rejects an unknown or foreign column ID.
- Test task update can move a task to another valid project column.
- Test task update rejects an unknown or foreign column ID.
- Test database startup initialization drops and recreates metadata tables only when startup initialization is enabled.
- Test that the obsolete rank repair behavior is no longer part of startup initialization.
- Test frontend column API wrappers call the generated client with the expected request payloads.
- Test the board renders persisted columns instead of hardcoded defaults.
- Test the board shows a retryable error if columns fail to load.
- Test owner users can add a column from the board and see the persisted result after success.
- Test owner users can rename a column from the board and see the persisted result after success.
- Test owner users can move columns left and right through menu actions.
- Test owner users see inline delete confirmation before deletion.
- Test non-owner users do not see column-management controls.
- Test task dragging or movement submits column ID and rank rather than status.
- Test the create-task screen loads project columns and preselects a column from the column-ID search parameter.
- Test the create-task screen defaults to the first column when no column-ID search parameter is provided.
- Test the task-detail screen renders a column selector and submits column ID changes.
- Prior art for backend tests includes existing project router/model tests and task ranking tests.
- Prior art for frontend tests includes existing board, task create, task detail, and API client wrapper tests.
- Run targeted backend and frontend tests during development, then run the full backend and frontend verification commands when feasible.

## Out of Scope

- Alembic migration and production-style data backfill are out of scope for this PRD.
- Preserving existing local database data during this schema change is out of scope because startup initialization will reset the development schema when enabled.
- Column colors, descriptions, WIP limits, icons, and other metadata are out of scope.
- Drag-and-drop column reordering is out of scope for the first implementation.
- Deleting a non-empty column by moving its tasks to another column is out of scope.
- Cascading deletion of tasks when deleting a column is out of scope.
- Archiving tasks through column deletion is out of scope.
- A separate project settings page for column management is out of scope.
- A single-column read endpoint is out of scope.
- Optimistic UI updates for column-management actions are out of scope.
- Special semantic treatment for a done/completed column is out of scope.
- Supporting both task status and column ID as writable task placement fields is out of scope.

## Further Notes

- The current codebase already has project ownership and membership concepts. Column management should follow the stricter owner-only model used by project metadata updates, while task movement should continue to follow the broader project-access model used by task updates.
- The current board groups tasks by normalized status strings and hardcoded column definitions. This behavior should be replaced with grouping by persisted column IDs.
- The frontend generated API client is produced from the backend OpenAPI schema, so backend contract changes should be made before regenerating the client.
- The database reset decision is intentionally development-oriented and should be revisited before this feature is treated as production migration work.

## Progress Notes

- 2026-06-02: Added the backend tracer slice for persisted project columns: `ProjectColumn` model metadata, automatic default columns on project creation, a `ProjectColumnService` read boundary, and `GET /projects/{project_id}/columns` for owners/members. Remaining work includes owner-only create/rename/reorder/delete endpoints, task `column_id` migration, startup reset simplification, OpenAPI regeneration, and frontend column UI flows.
- 2026-06-02: Added owner-only backend column creation through `POST /projects/{project_id}/columns`. Column creation now trims names, rejects empty names, rejects case-insensitive duplicates within the project, appends new columns to the end, and returns the persisted column. Remaining owner-only column management includes rename, reorder, and delete; broader task `column_id`, startup reset, OpenAPI, and frontend work remains.
- 2026-06-02: Added owner-only backend column rename through `PATCH /projects/{project_id}/columns/{column_id}`. Column rename now trims names, rejects empty names, rejects case-insensitive duplicates within the project while allowing the same column to keep its name, preserves column position and tasks by stable ID, and returns the persisted column. Remaining owner-only column management includes reorder and delete; broader task `column_id`, startup reset, OpenAPI, and frontend work remains.
