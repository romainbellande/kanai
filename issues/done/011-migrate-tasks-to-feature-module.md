## Parent PRD

`issues/prd.md`

## What to build

Migrate the backend task workflow into the first explicit feature module from PRD section 6. This slice should expose a narrow task feature surface while preserving endpoint behavior and the task board move workflow.

## Acceptance criteria

- [x] Task router/service feature exports are available from `app.features.tasks` using explicit imports.
- [x] Task endpoint behavior remains unchanged for list, get, create, update, delete, and move workflows.
- [x] Cross-feature dependencies use narrow policy or port interfaces, including `ProjectAccess`, instead of arbitrary service internals.
- [x] Architecture tests pass and confirm task feature internals do not leak into unrelated modules.
- [x] Backend verification passes with `just typecheck` and `just tests`.

## Blocked by

- Blocked by `issues/005-implement-task-board-move-workflow.md`
- Blocked by `issues/010-allow-backend-feature-modules.md`

## User stories addressed

- PRD section 2
- PRD section 6
