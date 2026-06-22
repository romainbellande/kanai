---
name: kanai-frontend
description: Use when editing Kanai client code under client/, especially React routes, domain UI/model files, TanStack Router files, generated API client workflows, shadcn/ui components, Recharts charts, tests, or frontend verification workflows.
---

# Kanai Frontend

Use this skill for work under `client/` involving React, TanStack Router file routes, domain UI/model files, Vite, Vitest, Biome, shadcn/ui, Recharts, generated API clients, or frontend verification.

## Client Map

- Route files live under `client/src/routes/`; `client/src/routeTree.gen.ts` is generated and must not be hand-edited.
- Domain-facing frontend code lives under `client/src/domains/<domain>/model` and `client/src/domains/<domain>/ui`.
- Shared UI primitives live under `client/src/components/` and `client/src/shared/ui/`; shadcn components live under `client/src/components/ui/`.
- Generated OpenAPI client code lives under `client/src/api/openapi-client/`; do not hand-edit it.

## Route Files
- Route modules export `Route` through `createFileRoute(...)`.
- For project-scoped pages that should replace the board view at `/projects/$projectId` rather than render inside it, use TanStack Router's trailing-underscore escape.
- Example: `/projects/$projectId/tasks/new` should be `client/src/routes/projects_.$projectId.tasks.new.tsx`, not a child route under `client/src/routes/projects/$projectId.tsx`.
- In an unnested project route, call `useParams({ from: "/projects_/$projectId/tasks/new" })` while links still use `to="/projects/$projectId/tasks/new"`.

## Generated API Client

- `client/src/api/openapi-client/` is generated; do not hand-edit it except through generation/postprocess scripts.
- Biome ignores do not affect `tsc`; TypeScript failures from generated client files must be handled through TypeScript config or generation postprocessing.
- Use package scripts for OpenAPI generation. The generator should be invoked through `bunx`, and the existing postprocess may add `// @ts-nocheck` to generated `.ts` files.

## UI Libraries

- `client/components.json` configures shadcn/ui with Base Nova, Tailwind v4, `@/` aliases, and Lucide icons.
- Prefer installed shadcn components from `client/src/components/ui/` before custom markup.
- Use Recharts through existing chart patterns when adding analytics/chart UI.

## Verification

- Run frontend commands from `client/`.
- `bun --bun run build` can regenerate TanStack Router route types and is useful after adding or renaming file routes.
- `bun --bun run check` may be blocked by an existing Biome import-order issue in `src/api/client/current-user.ts`; distinguish that from errors introduced by the current change.
- `bun --bun run test` may fail before test collection with Vitest/Bun worker `ReferenceError` messages about `dispose` and `listeners`; report this as an existing startup failure if it reproduces unchanged.
- Prefer `bun --bun run check` and `bun --bun run test` for normal frontend verification, plus `bun --bun run build` when route generation is relevant.
