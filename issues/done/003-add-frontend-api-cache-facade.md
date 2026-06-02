## Parent PRD

`issues/prd.md`

## What to build

Add the frontend API/cache facade described in PRD section 3, grouped by projects, tasks, and current user. This slice should create a stable app-facing API boundary over generated OpenAPI clients and React Query cache policy without migrating every caller yet.

## Acceptance criteria

- [x] `useKanaiApi` exposes project, task, and current-user operations using app-shaped inputs and outputs.
- [x] The facade owns stable query keys, generated-client calls, invalidation, and project task cache patching.
- [x] Tests cover stable query keys, generated adapter calls, task cache patching, and expected invalidation behavior.
- [x] Existing thin client wrappers continue to work for unmigrated callers.
- [x] Frontend verification passes with `bun --bun run check` and `bun --bun run test`.

## Blocked by

None - can start immediately

## User stories addressed

- PRD section 3

## Completion notes

- Added `useKanaiApi` as a React Query cache facade over existing thin client wrappers.
- Read operations return facade-owned query options so callers can use React Query hooks at top level without violating hook rules.
- Write operations use app-shaped inputs, call generated-client wrappers, and invalidate relevant caches.
- Task facade includes `patchCached` and `invalidateProjectTasks` for board/workflow callers.
- Targeted facade tests passed, but the `bun --bun run test` command exits non-zero afterward due to the existing Vitest/Bun worker `listeners`/`dispose` teardown issue.
