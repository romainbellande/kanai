---
name: kanai-frontend
description: Use when editing Kanai client routes, TanStack Router files, or frontend verification workflows.
---

# Kanai Frontend

Use this skill for work under `client/` involving React, TanStack Router file routes, Vite, Vitest, Biome, or frontend verification.

## Route Files

- Route files live under `client/src/routes/`; `client/src/routeTree.gen.ts` is generated and must not be hand-edited.
- Route modules export `Route` through `createFileRoute(...)`.
- For project-scoped pages that should replace the board view at `/projects/$projectId` rather than render inside it, use TanStack Router's trailing-underscore escape.
- Example: `/projects/$projectId/tasks/new` should be `client/src/routes/projects_.$projectId.tasks.new.tsx`, not a child route under `client/src/routes/projects/$projectId.tsx`.
- In an unnested project route, call `useParams({ from: "/projects_/$projectId/tasks/new" })` while links still use `to="/projects/$projectId/tasks/new"`.

## Verification

- Run frontend commands from `client/`.
- `bun --bun run build` can regenerate TanStack Router route types and is useful after adding or renaming file routes.
- `bun --bun run check` may be blocked by an existing Biome import-order issue in `src/api/client/current-user.ts`; distinguish that from errors introduced by the current change.
- `bun --bun run test` may fail before test collection with Vitest/Bun worker `ReferenceError` messages about `dispose` and `listeners`; report this as an existing startup failure if it reproduces unchanged.
- Prefer `bun --bun run check` and `bun --bun run test` for normal frontend verification, plus `bun --bun run build` when route generation is relevant.
