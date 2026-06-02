## Parent PRD

`issues/prd.md`

## What to build

Migrate task-facing frontend callers to the API/cache facade from PRD section 3 where they currently import generated wrappers, task query keys, or directly manipulate task-list cache. This creates the integration path needed by the task board and form model slices.

## Acceptance criteria

- [x] Task board, create task, and task detail flows use facade task operations for list/create/update/cache invalidation where applicable.
- [x] Page components no longer import task query keys or generated task API methods for core workflows.
- [x] Existing task page behavior is preserved, including loading, success, failure, and navigation states.
- [x] Frontend tests are updated to assert behavior through the facade boundary rather than thin API wrappers.
- [ ] Frontend verification passes with `bun --bun run check` and `bun --bun run test`.

## Blocked by

- Blocked by `issues/003-add-frontend-api-cache-facade.md`

## User stories addressed

- PRD section 2
- PRD section 3
- PRD section 4

## Completion notes

- `bun --bun run check` and `bun --bun run typecheck` passed.
- `bun --bun run test` remains blocked by the existing Vitest/Bun worker `dispose`/`listeners` ReferenceError after collecting/running a partial suite.
- Root `npm run test` and `npm run typecheck` remain blocked because the repository root has no `package.json`.
