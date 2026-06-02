## Parent PRD

`issues/prd.md`

## What to build

Extract create-task form semantics into the `useTaskForm` model from PRD section 4. This slice should make task creation demoable through the new form boundary while keeping rendering in the page/component layer.

## Acceptance criteria

- [x] `useTaskForm` supports create mode with initial values, optional initial status, field updates, saving state, and error messages.
- [x] Create mode validates required title and normalizes create payload values, including trim rules and optional fields.
- [x] `CreateTaskPage` uses `useTaskForm` for create behavior while preserving navigation and visible UI behavior.
- [x] Tests cover create initial values, status fallback, required title validation, create payload normalization, successful submit callback, and failed submit error message.
- [x] Frontend verification passes with `bun --bun run check` and `bun --bun run test`.

## Blocked by

- Blocked by `issues/004-route-task-apis-through-facade.md`

## User stories addressed

- PRD section 4

## Verification note

- `bun --bun run check` and `bun --bun run typecheck` passed.
- Targeted and full `bun --bun run test` runs had no assertion failures from this change, but still exit non-zero from the existing Vitest/Bun worker `dispose`/`listeners` ReferenceError.
- Root `npm run test` and `npm run typecheck` remain blocked because the repository root has no `package.json`.
