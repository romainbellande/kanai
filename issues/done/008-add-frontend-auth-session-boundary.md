## Parent PRD

`issues/prd.md`

## What to build

Introduce the frontend auth session boundary from PRD section 5 and route guards/API token lookup through it. This slice should hide low-level OIDC, browser storage, callback, expiry, and logout details behind the app-facing auth boundary.

## Acceptance criteria

- [ ] `useAuthBoundary` exposes auth status, access token lookup, page requirement, callback completion, logout, and bypass path checks.
- [ ] Route guards use the boundary for login requirements and bypass path decisions.
- [ ] API configuration depends on `accessToken()` instead of reaching into low-level auth storage directly.
- [ ] Tests cover anonymous route login, bypass paths, callback success/failure, expired session clearing, logout, and missing-session token lookup failure.
- [ ] Frontend verification passes with `bun --bun run check` and `bun --bun run test`.

## Blocked by

- Blocked by `issues/003-add-frontend-api-cache-facade.md`

## User stories addressed

- PRD section 5
