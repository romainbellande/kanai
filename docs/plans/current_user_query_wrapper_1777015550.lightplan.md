# Current User Query Wrapper Light Implementation Plan

## Objective

Implement `an app-owned /users/me client wrapper with TanStack Query, request-time auth-token lookup, explicit API base URL wiring, and WorkspaceHeader initials rendering`.

This plan is intended for a smaller autonomous task.

The agent should be able to execute from this plan alone. Reading related spec files is optional for extra context, not required to proceed.

## Source Of Truth

Primary specification or issue:

- `docs/specs/users_api_react_query_wrapper_1776755486.spec.md`

Codebase integration points:

- `client/src/api/openapi-client/apis/UsersApi.ts`
- `client/src/domains/auth/model/openid-client.ts`
- `client/src/main.tsx`
- `client/src/domains/workspace/ui/organisms/WorkspaceHeader.tsx`
- `client/src/env.d.ts`

If the implementation encounters a minor ambiguity, prefer the smallest change that preserves this plan and existing repo patterns.

If this plan and a related spec differ in emphasis, follow this plan for implementation decisions because it is the execution-oriented handoff.

## Required Outcome

The finished implementation must provide:

- an app-owned current-user client surface under `client/src/api/client` that hides generated OpenAPI class and method names behind stable exports such as a fetch function, query options, and a hook
- request-time bearer-token resolution from the existing OpenID session source of truth, with a clear auth-related failure when no usable token is available and no redirect side effects inside the wrapper
- a `WorkspaceHeader` account treatment that can read the current-user query result and render the signed-in user's initials inside a rounded avatar without depending on generated API details

## Constraints

- do not edit files under `client/src/api/openapi-client`
- do not introduce a broad shared API platform or auth-flow refactor beyond what is needed for `/users/me`
- keep changes local to `client/src/api/client`, auth-session access, React Query provider wiring, `WorkspaceHeader`, and focused client tests

## Exact Files To Touch

The agent should expect to edit these existing files:

- `client/src/env.d.ts`
- `client/src/domains/auth/model/openid-client.ts`
- `client/src/main.tsx`
- `client/src/domains/workspace/ui/organisms/WorkspaceHeader.tsx`

The agent should expect to create these new files:

- `client/src/api/client/current-user.ts`
- `client/src/api/client/index.ts`
- `client/src/api/client/current-user.test.ts`
- `client/src/domains/workspace/ui/organisms/WorkspaceHeader.test.tsx`

Avoid touching unrelated files unless a minimal adjustment is required to complete the task correctly.

## Implementation Defaults

If the agent must make a choice without asking for clarification, use these defaults:

- prefer exporting a small supported auth-session accessor from `openid-client.ts` instead of duplicating session-storage parsing in the API wrapper
- prefer a stable query identity of `['users', 'me']` and explicit exports such as `getCurrentUser`, `currentUserQueryOptions`, and `useCurrentUserQuery`
- prefer `VITE_API_BASE_URL` for generated-client `basePath` wiring instead of guessing ports or relying on implicit same-origin behavior

## Implementation Steps

1. Update `client/src/env.d.ts` and add `client/src/api/client/current-user.ts` so the app-owned wrapper can read `VITE_API_BASE_URL`, build a generated `UsersApi` instance with explicit `Configuration` wiring, resolve the access token at request time, and export the current-user fetch/query contract.
2. Update `client/src/domains/auth/model/openid-client.ts` to expose the smallest reusable stored-session accessor needed by the wrapper while preserving existing auth behavior and non-browser safety.
3. Update `client/src/main.tsx` to create a single `QueryClient` and wrap the app with `QueryClientProvider` so the new hook can run anywhere in the protected UI.
4. Update `client/src/domains/workspace/ui/organisms/WorkspaceHeader.tsx` to consume the app-owned current-user hook and render a rounded initials avatar derived from the `/users/me` payload, while keeping logout behavior and non-user controls intact.
5. Add focused tests for wrapper auth/query behavior and header initials rendering, then run verification commands.

## Tests

Minimum required coverage:

- the current-user client uses the stored access token and configured `VITE_API_BASE_URL` when issuing the generated `UsersApi` request
- missing-token and non-browser storage cases fail before network execution with a clear auth-related error
- the current-user query contract uses a stable key and `WorkspaceHeader` can render initials from resolved user data without importing generated OpenAPI details

Testing guidance:

- follow the repo's existing Vitest and Testing Library style, keeping setup local if no shared test harness exists yet
- keep wrapper tests focused on behavior at the app-owned boundary, not generated runtime internals
- avoid brittle UI snapshots; assert initials text, fallback behavior, and relevant loading or error-safe rendering directly

## Verification

Run these commands from `client/` after the code changes:

- `bun --bun run test`
- `bunx tsc --noEmit`
- `bun --bun run check`

If one verification command fails:

- fix the failure if it is caused by the feature changes
- if the failure is clearly unrelated pre-existing repo state, document it in the final handoff with enough detail for the user to reproduce

## Acceptance Criteria

The task is complete only if all of the following are true:

- `client/src/api/client` exposes an app-owned current-user fetch function plus reusable React Query options and hook backed by the generated `UsersApi`
- the wrapper reads its bearer token from the auth domain at request execution time, uses `VITE_API_BASE_URL` for the request base path, and fails with an auth-related error instead of returning `null` or redirecting
- `WorkspaceHeader` renders a rounded initials avatar from current-user data without depending on generated OpenAPI method names
- tests added and passing
- `bun --bun run test`, `bunx tsc --noEmit`, and `bun --bun run check` succeed

## Delivery Format For The Agent

When the implementation is complete, the agent should be able to report:

- which files were created
- which existing files were edited
- what behavior was implemented
- what tests were added
- the result of `bun --bun run test`
- the result of `bunx tsc --noEmit`
- the result of `bun --bun run check`
- any deviations from the plan, if any

## Notes For The Agent

- prefer the smallest correct implementation
- do not stop after scaffolding; carry the work through tests and verification
- do not leave TODO comments as a substitute for implementation
