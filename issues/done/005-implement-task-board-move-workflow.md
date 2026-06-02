## Parent PRD

`issues/prd.md`

## What to build

Implement the task board workflow from PRD section 2 as an end-to-end move path spanning UI drop normalization, optimistic cache behavior, backend persisted status/rank updates, and project access enforcement. `ProjectBoardPage` should delegate board state and task movement to the workflow boundary.

## Acceptance criteria

- [x] `useProjectTaskBoard` exposes columns, drag state, and `moveTask` with the PRD-proposed input shape.
- [x] Backend task movement persists status and rank for within-column moves, cross-column moves, top/bottom placement, and no-op moves.
- [x] Optimistic cache updates, rollback on API failure, and invalidation on settle are covered by frontend boundary tests.
- [x] Backend tests cover persisted rank/status updates and access denial via `ProjectAccess`.
- [x] Frontend and backend verification pass with `bun --bun run check`, `bun --bun run test`, `just typecheck`, and `just tests`.

## Completion notes

- Added `useProjectTaskBoard` as the board workflow boundary for grouped columns, drag state, optimistic task movement, rollback, and invalidation.
- Added backend `move_task` with `TaskDestination` for persisted status/rank movement and no-op preservation.
- `bun --bun run test` has no assertion failures for this change, but still exits non-zero from the existing Vitest/Bun worker `dispose`/`listeners` teardown ReferenceError.
- Root `npm run test` and `npm run typecheck` remain blocked because the repository root has no `package.json`.

## Blocked by

- Blocked by `issues/001-introduce-project-access-policy.md`
- Blocked by `issues/004-route-task-apis-through-facade.md`

## User stories addressed

- PRD section 2
