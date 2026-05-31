# Client API Integration Spec

## Goal

Connect the workspace client to the API so authenticated users see and manage real user, project, and task data instead of fixture-driven screens.

The client experience should reflect server state for the signed-in user, their accessible projects, and each project's tasks while preserving the existing workspace flows.

## Problem

The client currently has a focused current-user wrapper, but the workspace project list, project board, create-project form, and create-task form still rely on hard-coded project, task, and member data.

This makes the UI disconnected from the authenticated API and prevents created projects or tasks from being persisted, reloaded, or shared consistently across screens.

## Scope

In scope:

- Load the authenticated current user from the API for workspace identity behavior.
- Load the authenticated user's accessible projects from the API.
- Load tasks for the selected project from the API.
- Create projects through the API and navigate to the resulting project state.
- Create tasks through the API and show the resulting task in the relevant project board.
- Surface loading, empty, validation, authentication, authorization, not-found, and network failure states in the workspace UI.
- Use the generated OpenAPI client under `client/src/api/openapi-client` as the API transport boundary.

Out of scope:

- Hand-editing generated OpenAPI files under `client/src/api/openapi-client`.
- Adding new backend endpoints beyond the current users, projects, and tasks API contracts.
- Building a full user-directory or teammate-search feature when the API only exposes the current user.
- Changing login, logout, token refresh, or identity-provider behavior beyond using the existing authenticated session for API requests.
- Reworking the workspace visual design except where states are needed for real API data.

## Existing Context

- `client/src/api/client/current-user.ts` already wraps the generated `UsersApi` and exposes current-user query behavior.
- `client/src/api/client/utils.ts` resolves `VITE_API_BASE_URL` and the stored access token used by generated client calls.
- `client/src/api/openapi-client/apis/UsersApi.ts` exposes `GET /users/me` through `getUsersMeUsersMeGet()`.
- `client/src/api/openapi-client/apis/ProjectsApi.ts` exposes project CRUD methods and also includes generated methods for nested project task routes.
- `client/src/api/openapi-client/apis/TasksApi.ts` exposes generated methods for task CRUD under `/projects/{project_id}/tasks`.
- The backend exposes `POST /projects`, `GET /projects`, `GET /projects/{project_id}`, `PATCH /projects/{project_id}`, and `DELETE /projects/{project_id}`.
- The backend exposes `POST /projects/{project_id}/tasks`, `GET /projects/{project_id}/tasks`, `GET /projects/{project_id}/tasks/{task_id}`, `PATCH /projects/{project_id}/tasks/{task_id}`, and `DELETE /projects/{project_id}/tasks/{task_id}`.
- Project and task backend routes depend on the current authenticated user and must not be treated as public data.
- `ProjectsPage`, `ProjectBoardPage`, `CreateProjectPage`, and `CreateTaskPage` currently use local fixture data and form submissions that only navigate locally.

## Required Behavior

- The projects dashboard must render projects returned by the API for the authenticated user.
- The projects dashboard must not show static fixture projects as if they were real API data after the integration is complete.
- Opening a project must resolve the selected project from the API and render its API-backed name, metadata, and tasks.
- A project board must render task cards from the API response for that project.
- Task cards must be grouped by their task `status` in a stable way that supports at least the existing `todo`, `in-progress`, and `done` workflow columns.
- Creating a project must submit the user's form data to the API and use the returned project as the source of truth for the next UI state.
- Creating a task must submit the user's form data to the API for the currently selected project and use the returned task as the source of truth for the next UI state.
- Current-user data must continue to drive account identity behavior such as initials where the UI needs signed-in user context.
- API wrappers exposed to feature code must use stable app-owned names rather than requiring feature components to call generated method names directly.
- API-backed screens must preserve usable loading, success, empty, and error states instead of flashing misleading fixture content.

## Flow

1. The signed-in user opens the projects dashboard.
2. The client reads the stored authenticated session and requests the current user and accessible projects from the API.
3. The dashboard renders a loading state until project data is ready.
4. If projects exist, the dashboard renders the returned projects with links using their API identifiers.
5. If no projects exist, the dashboard renders an empty state with a clear path to create a project.
6. The user opens a project.
7. The client requests that project and its tasks from the API using the selected project identifier.
8. The board renders API task cards grouped by workflow status.
9. The user creates a project or task.
10. The client submits the form payload to the relevant API endpoint, reflects submission progress, and updates or invalidates the affected project/task views after success.
11. The user lands on a UI state that reflects the persisted API response, not a locally fabricated object.

## Rules And Constraints

- The generated OpenAPI client in `client/src/api/openapi-client` must be used for users, projects, and tasks API calls.
- Generated OpenAPI files must be treated as generated output and must not be manually edited for application behavior.
- App-owned wrappers may live outside generated output to provide stable names, shared auth configuration, query keys, mutation behavior, and UI-friendly boundaries.
- API requests for authenticated resources must use the stored access token at request execution time.
- Missing or unusable access tokens must fail through a controlled authentication error path, not through silent empty data.
- Feature components must not duplicate generated-client configuration or know generated method names directly.
- Project identifiers in routes must be API project IDs once data is connected to the API.
- The client must not invent member or assignee user records that the API cannot provide.
- The current user may be used as identity context, but arbitrary member selection must be limited, hidden, disabled, or clearly constrained until a user-directory API exists.
- Existing backend validation rules must be respected, including the three-character uppercase alphanumeric project code requirement.
- Deleting or updating projects and tasks may be supported by the generated client wrappers, but this spec is satisfied by read and create behavior for the current workspace flows.

## Data Expectations

- Required: an authenticated access token from the existing auth session.
- Required: current-user data with `id`, optional `first_name`, and optional `last_name`.
- Required: project data with `id`, `name`, `code`, `priority`, optional `description`, optional `status`, `owner_ids`, `member_ids`, and optional timestamps.
- Required: task data with `id`, `project_id`, `title`, `status`, `priority`, optional `assignee_id`, optional `description`, optional `acceptance_criteria`, optional `tag`, and optional timestamps.
- Optional: empty project and task arrays from the API.
- Optional: nullable project descriptions, project statuses, task assignees, task descriptions, acceptance criteria, tags, and timestamps.
- Consistency: a task must be rendered only under the project identified by its `project_id`.
- Consistency: client-side form payloads must match API schema names and validation constraints before or during submission.
- Consistency: cache identity for current user, project lists, individual projects, and project tasks must be stable so screens observe the same server state.

## Error Cases

- When no access token is available, the system must show or route through an authentication failure state and must not render stale fixture data as a fallback.
- When the API returns 401, the system must surface an authentication error appropriate for a protected workspace route.
- When the API returns 403, the system must communicate that the user cannot access or mutate the requested project or task.
- When a project ID from the route is not found, the system must show a not-found state instead of a generic empty board.
- When task loading fails for an otherwise accessible project, the system must keep the project context visible where possible and show the task failure clearly.
- When project or task creation fails validation, the system must keep the user's form input available and expose the validation failure without navigating away.
- When a network request fails, the system must expose an error state with a retry path where appropriate.
- When the API returns an empty project list or empty task list, the system must show an empty state rather than an error state.
- When generated-client method names change after regeneration, feature components should remain protected by app-owned wrappers as much as practical.

## Acceptance Criteria

- The projects dashboard fetches and displays API projects for the authenticated user.
- The projects dashboard no longer depends on hard-coded project fixtures for its primary project list.
- The project board fetches and displays API project details and tasks for the selected API project ID.
- Task cards on the project board are derived from API task responses and grouped by task status.
- The create-project flow submits to the API, handles pending and failed states, and navigates or updates state from the created API project.
- The create-task flow submits to the API for the current project, handles pending and failed states, and updates the board from the created API task.
- Current-user identity behavior continues to use the authenticated user API path.
- Users, projects, and tasks API calls are performed through generated OpenAPI client classes from `client/src/api/openapi-client` via app-owned client wrappers.
- No generated OpenAPI file is manually modified to implement the integration.
- Required behavior and error cases are covered by tests or documented verification.

## Testing Expectations

- Verify that project listing uses the generated OpenAPI-backed client wrapper and renders returned project data.
- Verify that empty project and empty task responses render empty states.
- Verify that opening a project fetches project details and project tasks using the route project ID.
- Verify that task grouping reflects returned task statuses, including at least `todo`, `in-progress`, and `done`.
- Verify that project creation submits a schema-compatible payload and handles success and validation failure.
- Verify that task creation submits a schema-compatible payload for the selected project and handles success and validation failure.
- Verify that missing-token behavior fails through the existing controlled authentication error path.
- Verify that generated OpenAPI files remain untouched by the feature implementation.

## Notes

- Keep this spec focused on expected behavior, not implementation sequencing.
- Put file edits, execution steps, and verification commands in a corresponding plan under `docs/plans/`.
