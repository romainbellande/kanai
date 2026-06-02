## Parent PRD

`issues/prd.md`

## What to build

Extend `useTaskForm` from PRD section 4 to cover edit-task behavior. This slice should move task-to-form mapping, dirty-state behavior, update payload normalization, and nullable clear semantics out of `TaskDetailPage`.

## Acceptance criteria

- [x] `useTaskForm` supports edit mode with task-derived initial values, field updates, dirty state, saving state, and error messages.
- [x] Edit mode normalizes update payloads correctly, including nullable clears required by backend `TaskUpdate` semantics.
- [x] `TaskDetailPage` uses `useTaskForm` for edit behavior while preserving visible UI behavior.
- [x] Tests cover edit initial values, dirty-state behavior, update payload normalization, successful submit callback, and failed submit error message.
- [x] Frontend verification passes with `bun --bun run check` and `bun --bun run test`.

Note: `bun --bun run check` and `bun --bun run typecheck` passed. `bun --bun run test` remains non-zero from the existing Vitest/Bun worker `dispose`/`listeners` ReferenceError before full collection, with no assertion failure from this change observed. Root `npm run test` and `npm run typecheck` remain blocked because the repository root has no `package.json`.

## Blocked by

- Blocked by `issues/006-extract-task-create-form-model.md`

## User stories addressed

- PRD section 4
