## Parent PRD

`issues/prd.md`

## What to build

Introduce the backend request auth boundary from PRD section 5 to centralize request authentication, session lookup, token verification, and current-user provisioning behind a stable interface.

## Acceptance criteria

- [x] `RequestAuthBoundary` exposes scope authentication and current-user lookup using the PRD-proposed interface.
- [x] Backend request auth wiring routes through the boundary without changing observable endpoint auth behavior.
- [x] Tests cover cache hit avoiding token verification, cache miss verifying the token and provisioning the user, and invalid token rejection.
- [x] Existing auth/session adapters remain substitutable in tests.
- [x] Backend verification passes with `just typecheck` and `just tests`.

## Blocked by

None - can start immediately

## User stories addressed

- PRD section 5
