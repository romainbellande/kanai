# Client API Integration Implementation Plan

## Goal

Connect the workspace client to the authenticated API for current-user, project, and task data so the dashboard, board, and create flows reflect persisted server state instead of fixture data.

## Context

Primary source:
- `docs/specs/client-api-integration_1780218443.spec.md`

Relevant integration points:
- `client/src/api/client/current-user.ts` already wraps generated `UsersApi` with React Query options.
- `client/src/api/client/utils.ts` resolves `VITE_API_BASE_URL` and the stored access token.
- `client/src/api/openapi-client/apis/ProjectsApi.ts` and `client/src/api/openapi-client/apis/TasksApi.ts` expose generated project and task methods.
- `client/src/domains/workspace/ui/ProjectsPage.tsx` renders fixture project cards.
- `client/src/domains/workspace/ui/ProjectBoardPage.tsx` renders fixture project names, members, columns, and task cards.
- `client/src/domains/workspace/ui/CreateProjectPage.tsx` submits locally and navigates without API persistence.
- `client/src/domains/workspace/ui/CreateTaskPage.tsx` submits locally and navigates without API persistence.
- `client/src/main.tsx` provides a global React Query `QueryClientProvider`.

## Required Outcome

- The projects dashboard fetches authenticated API projects and renders loading, empty, success, and error states without using fixture projects as primary data.
- The project board fetches the route project ID and its tasks from the API, renders project metadata from the API, and groups API task cards by `todo`, `in-progress`, and `done`.
- Project and task creation submit schema-compatible payloads through app-owned wrappers, preserve form input on failure, show pending/failure states, and navigate or refresh from returned server data on success.
- Current-user initials continue to come from `GET /users/me` through the existing current-user wrapper.

## Constraints

- Do not hand-edit generated files under `client/src/api/openapi-client`.
- Use generated OpenAPI client classes only behind app-owned wrappers in `client/src/api/client`.
- API requests for protected resources must use the stored access token at request execution time.
- Missing or unusable tokens must surface through a controlled authentication error path, not silent empty data.
- Route project identifiers must be API project IDs.
- Do not invent arbitrary members or assignees; limit member/assignee UI to the current user or make it clearly unavailable until a user-directory API exists.
- Respect backend project code validation: exactly three uppercase alphanumeric characters.
- Prefer the smallest correct change that matches existing patterns.

## Files

Edit:
- `client/src/api/client/utils.ts`
- `client/src/api/client/current-user.ts`
- `client/src/api/client/index.ts`
- `client/src/api/client/current-user.test.ts`
- `client/src/domains/workspace/ui/ProjectsPage.tsx`
- `client/src/domains/workspace/ui/ProjectBoardPage.tsx`
- `client/src/domains/workspace/ui/CreateProjectPage.tsx`
- `client/src/domains/workspace/ui/CreateTaskPage.tsx`
- `client/src/domains/workspace/ui/templates/WorkspaceLayout.tsx`
- `client/src/domains/workspace/ui/organisms/WorkspaceHeader.test.tsx`

Create:
- `client/src/api/client/projects.ts`
- `client/src/api/client/projects.test.ts`
- `client/src/api/client/tasks.ts`
- `client/src/api/client/tasks.test.ts`
- `client/src/domains/workspace/ui/ProjectsPage.test.tsx`
- `client/src/domains/workspace/ui/ProjectBoardPage.test.tsx`
- `client/src/domains/workspace/ui/CreateProjectPage.test.tsx`
- `client/src/domains/workspace/ui/CreateTaskPage.test.tsx`

Avoid unrelated files unless required for correctness.

## Steps

1. Add a shared authenticated API configuration helper in `client/src/api/client/utils.ts` that returns a generated-client `Configuration` using `getApiBaseUrl()` and `getAccessToken`.
2. Update `current-user.ts` to use the shared configuration helper while preserving the existing current-user query key and exported authentication error behavior.
3. Create `projects.ts` with app-owned types, query keys, `listProjects`, `getProject`, `createProject`, React Query options, and a create mutation helper using `ProjectsApi`.
4. Create `tasks.ts` with app-owned types, query keys, `listProjectTasks`, `createProjectTask`, React Query options, and a create mutation helper using `TasksApi`.
5. Export the new wrappers from `client/src/api/client/index.ts` so feature code imports stable app-owned names only.
6. Update `ProjectsPage.tsx` to call the project list query, render API projects by `project.id`, remove the fixture project array from the primary list, and add clear loading, empty, auth/error, and retry states.
7. Update dashboard project display to derive status/tone from API fields with safe fallbacks, hide misleading fixture pagination counts, and keep recent activity either generic or clearly non-authoritative.
8. Update `ProjectBoardPage.tsx` to fetch project details and tasks for `projectId`, replace fixture project-name and column data, and keep project context visible when task loading fails.
9. Implement a small task-grouping function near the board component that maps API statuses to stable columns for `todo`, `in-progress`, and `done`, with unknown statuses handled predictably without breaking the existing three-column workflow.
10. Replace invented board member chips and invite/assignee affordances with current-user context or disabled/constrained UI until a user-directory API exists.
11. Update `CreateProjectPage.tsx` to collect form data, validate the three-character uppercase code, submit `ProjectCreate`-compatible data through the create project mutation, disable submit while pending, show validation/API failures inline, and navigate to `/projects/$projectId` using the returned `project.id` on success.
12. Remove or constrain the hard-coded project-member selector in the create-project flow so submitted owner/member IDs are either omitted or limited to available authenticated-user data.
13. Update `CreateTaskPage.tsx` to fetch the current project for breadcrumbs/title, submit `TaskCreate`-compatible data through the create task mutation for the route project ID, disable submit while pending, show validation/API failures inline, and navigate back to the board after invalidating or updating project task cache.
14. Remove or constrain the hard-coded task-assignee selector so `assigneeId` is omitted unless it can be backed by available current-user data.
15. Update `WorkspaceLayout.tsx` only if breadcrumb typing needs to support dynamic API-backed labels or route params introduced by the screen changes.
16. Add wrapper tests for project and task clients that assert generated-client-backed requests use `VITE_API_BASE_URL`, stored bearer token, stable query keys, schema-compatible JSON bodies, and no network request when the token is missing.
17. Add or update UI tests around dashboard listing/empty/error states, board project/task loading and grouping, and create project/task success and validation failure behavior using existing Testing Library and React Query patterns.
18. Run frontend verification from `client/` and fix failures caused by this change.

## Tests

Cover:
- Project listing uses the app-owned wrapper and renders returned API project names, descriptions, statuses, and API IDs in board links.
- Empty project responses render an empty dashboard state with a create-project path.
- Project details and task list queries use the route project ID.
- Task grouping renders returned `todo`, `in-progress`, and `done` tasks in their stable columns and ignores tasks from another project ID.
- Empty task responses render empty board columns rather than fixture task cards.
- Project creation submits `name`, `code`, `priority`, optional `description`, and no invented member IDs.
- Task creation submits `title`, `status`, `priority`, optional notes fields, and no invented assignee ID.
- Project/task creation failures keep form input and show inline errors without navigating.
- Missing-token behavior rejects before fetch through the controlled auth error path.
- Generated OpenAPI files remain untouched by implementation changes.

Use existing test style. Avoid brittle implementation-detail assertions.

## Verification

Run:
- `bun --bun run check`
- `bun --bun run test`

If route files are added or renamed, also run:
- `bun --bun run build`

If a command fails:
- Fix failures caused by this change.
- Document clearly unrelated pre-existing failures, including the known possible Biome import-order issue in `src/api/client/current-user.ts` and possible Vitest/Bun worker startup `ReferenceError` failures if they reproduce unchanged.

## Acceptance Criteria

- The projects dashboard displays authenticated API projects and no longer uses hard-coded projects for its primary list.
- The project board displays API project details and API task cards for the selected API project ID.
- Task cards are grouped by API `status` across at least `todo`, `in-progress`, and `done`.
- Create-project submits to the API, handles pending and failed states, and navigates or updates from the returned API project.
- Create-task submits to the API for the selected project, handles pending and failed states, and refreshes or updates the board from the returned API task.
- Current-user identity behavior remains backed by the authenticated user API path.
- Feature components use app-owned API wrapper names instead of generated method names.
- No generated OpenAPI file is manually modified.
- Tests cover the required behavior.
- Verification commands pass or unrelated failures are documented.

## Handoff

Report:
- Files created
- Files edited
- Behavior implemented
- Tests added or updated
- Verification results
- Deviations from this plan
