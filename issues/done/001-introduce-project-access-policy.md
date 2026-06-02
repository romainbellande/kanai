## Parent PRD

`issues/prd.md`

## What to build

Introduce the `ProjectAccess` policy boundary from PRD section 1 and migrate task service access checks to depend on it instead of project service helper functions. This slice should preserve observable authorization behavior while moving project/member access decisions behind the new policy interface.

## Acceptance criteria

- [x] `ProjectAccess.require_project` supports member access, owner access, owner-only rejection, and missing/forbidden 404 masking.
- [x] Task service workflows use `ProjectAccess` for project access checks instead of importing project service access helpers.
- [x] Boundary tests cover owner access, member access, owner-only rejection, missing/forbidden masking, and task service access denial.
- [ ] Backend verification passes with `just typecheck` and `just tests`.

## Blocked by

None - can start immediately

## User stories addressed

- PRD section 1

## Notes

- Added the policy boundary and tests, but local verification is blocked because this shell does not have `uv`, `pytest`, or `ruff` installed.
