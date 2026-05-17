# Users API React Query Wrapper Spec

## Goal

Add an app-owned client wrapper around the generated `UsersApi` so React code can fetch the current authenticated user through TanStack Query without depending on generated method names or manual bearer-token wiring.

The outcome is a stable client-layer entry point under `client/src/api/client` for `/users/me` that reads the access token from the existing OpenID session state and exposes a reusable query contract for UI code.

That current-user query must support header UI that displays the signed-in user's initials inside a rounded avatar treatment, without requiring header code to depend on generated API details.

## Problem

The generated OpenAPI client currently exposes only the raw `UsersApi` class and its generated `getUsersMeUsersMeGet()` method.

That leaves application code with three gaps:

- it would need to know generated naming and instantiation details
- it would need to wire the bearer token into `Configuration` manually
- it has no established TanStack Query wrapper or query identity for current-user data

Without an app-owned wrapper, current-user fetching would be awkward, repetitive, and tightly coupled to generated code.

## Scope

This spec covers:

- adding a focused client-layer wrapper for the generated `UsersApi` current-user endpoint in `client/src/api/client`
- exposing a reusable TanStack Query contract for the authenticated current-user request, including query options and a hook
- resolving the bearer token from the existing stored auth session and surfacing missing-token cases as an auth error
- enabling UI consumers such as the app header to read current-user identity data needed to render a rounded initials avatar for the signed-in user

This spec does not cover:

- changing or hand-editing files under `client/src/api/openapi-client`
- introducing a broad shared API platform for all generated APIs beyond what is needed for this users endpoint
- changing login, logout, token refresh, or redirect behavior outside this client wrapper concern

## Existing Context

- `client/src/api/openapi-client/apis/UsersApi.ts` currently exposes one authenticated endpoint: `GET /users/me`
- the generated client accepts bearer auth through `Configuration.accessToken`
- `client/src/domains/auth/model/openid-client.ts` owns the stored OpenID session and already parses `accessToken` from session storage through `readStoredAuthSession()`
- `client/src/main.tsx` already enforces the sign-in flow before rendering protected app routes, so this wrapper should report auth failures rather than initiate navigation itself
- `@tanstack/react-query` is already installed, but the client app does not yet have an established React Query wrapper pattern or `client/src/api/client` implementation
- generated OpenAPI files are explicitly marked as auto-generated and must remain an implementation dependency rather than the app-facing API surface

## Required Behavior

The finished feature must provide:

- an app-owned users client API with stable, human-readable entry points for the current-user request instead of exposing generated method names directly to feature code
- a TanStack Query integration for the current-user request that includes reusable query options and a hook intended for React consumers
- current-user data access suitable for header UI to derive and display the signed-in user's initials in a rounded avatar element
- access-token lookup at request execution time from the existing stored auth session source of truth rather than duplicating session-storage parsing or hard-coding storage keys in the API client layer
- a clear auth-related error when no usable access token is available, without silently returning `null` and without triggering login navigation inside the wrapper
- successful query resolution with the `/users/me` payload from the generated client, without requiring unrelated data reshaping or domain redesign

## User Or System Flow

1. A React consumer such as the app header imports the current-user query contract from `client/src/api/client`.
2. When the query executes, the wrapper resolves the latest stored access token from the auth domain.
3. If no valid access token is available, the wrapper fails immediately with a clear auth-related error and does not issue a network request.
4. If an access token is available, the wrapper calls the generated `UsersApi` `GET /users/me` operation with bearer authentication.
5. TanStack Query stores the result under a stable current-user query identity and exposes loading, success, error, and retry behavior to the consumer.
6. The header derives initials from the resolved current-user payload and renders them inside a rounded avatar treatment.

## Rules And Constraints

- the app-facing wrapper must live outside the generated OpenAPI output and must not require manual edits to generated files
- the wrapper must stay narrowly focused on the current-user endpoint for this iteration and must not introduce broader API abstractions unless they are strictly necessary to support this endpoint cleanly
- bearer-token resolution must happen when the request runs, not once at module initialization time, so token changes in session storage are reflected by later requests
- missing-token behavior must be represented as an auth failure, not as a successful empty user state
- the wrapper must not own redirect, login, logout, or token-refresh side effects
- feature code should not need to know OpenAPI-generated class names, configuration details, or generated method names to fetch the current user

## Data Expectations

Required data:

- the stored auth session access token used for bearer authentication
- the current-user response payload returned by `GET /users/me`
- a stable TanStack Query key or query identity representing the authenticated current-user resource

Optional data:

- structured error metadata derived from request failures if the wrapper needs to preserve useful status or message details
- a small exported auth-session accessor from the auth domain if needed to make the existing stored-session reader reusable outside `openid-client.ts`

Validation or consistency rules:

- an absent, empty, or otherwise unusable access token must be treated as an auth error before any network request is attempted
- the API client layer must rely on the auth domain as the source of truth for stored session parsing rather than reimplementing the same parsing logic in multiple places
- the query identity for current-user data must remain stable so components can share cache state consistently

## Error Cases

- when no stored access token is available, the system must reject the current-user client call and query with a clear auth-related error and must not send `GET /users/me`
- when the generated client returns a non-2xx response or network failure, the system must surface the failure through the query error state instead of swallowing it
- when stored-session access cannot be performed in the current runtime, the system must fail predictably with an auth-related error instead of crashing on direct browser API access

## Environment Or Runtime Rules

- in the browser runtime, access-token lookup must read from the existing session-backed OpenID auth state
- in non-browser or test-like runtimes where session storage is unavailable, the wrapper must degrade into a controlled auth failure path rather than assuming browser globals exist

## Security And Privacy

- the access token must only be used to authorize the generated API request and must not be logged, persisted to a second storage location, or exposed through query data
- the client wrapper must not duplicate knowledge of the auth-session storage key or session serialization format outside the auth domain unless the auth domain explicitly exports a supported accessor
- auth failures should report only the minimum message needed for control flow and debugging, without leaking bearer-token contents

## Acceptance Criteria

This spec is satisfied only if all of the following are true:

- `client/src/api/client` exposes an app-owned current-user client surface backed by the generated `UsersApi`
- React consumers can use reusable TanStack Query options and a hook to request `/users/me` without depending on generated OpenAPI method names
- the current-user query contract provides the data needed for header UI to render the signed-in user's initials inside a rounded avatar treatment
- the request reads its bearer token from the stored auth session at execution time
- when no access token exists, the wrapper fails with an auth-related error instead of returning `null` or redirecting the browser
- the implementation leaves `client/src/api/openapi-client` as generated code and keeps the wrapper logic in app-owned files

## Testing Expectations

- verify that the current-user client call supplies the stored bearer token to the generated `UsersApi` request path
- verify that missing-token scenarios fail before network execution and surface the expected auth error behavior
- verify that the TanStack Query wrapper exposes stable success and error behavior for `/users/me`
- verify that application code can consume the app-owned wrapper without referencing generated method names directly

## Notes

- keep this document focused on expected behavior, not implementation structure
- move execution details, file plans, and sequencing into a corresponding plan document under `docs/plans/`
