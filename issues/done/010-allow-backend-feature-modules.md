## Parent PRD

`issues/prd.md`

## What to build

Update backend architecture rules to allow the incremental feature-module layout from PRD section 6 without migrating tasks yet. This slice should protect intended boundaries while removing layer-first constraints that block feature-local modules.

## Acceptance criteria

- [x] Architecture tests allow `app/features/<feature>/` modules and explicit feature router exports.
- [x] Architecture tests prevent feature internals from leaking into unrelated features.
- [x] Architecture tests ensure shared technical services do not import feature modules.
- [x] Existing backend behavior tests continue to pass without requiring a task feature migration.
- [x] Backend verification passes with `just typecheck` and `just tests`.

## Blocked by

- Blocked by `issues/001-introduce-project-access-policy.md`

## User stories addressed

- PRD section 6
