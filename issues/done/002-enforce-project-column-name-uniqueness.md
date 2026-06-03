## Parent PRD

`issues/prd.md`

## What to build

Enforce project-column name uniqueness as a backend invariant while preserving the existing user-friendly duplicate-name validation. This covers exact uniqueness in model metadata and regression coverage for both database-level and service-level behavior from the PRD's Solution and Implementation Decisions.

## Acceptance criteria

- [x] Project column model metadata enforces exact uniqueness of column names within a project.
- [x] Existing case-insensitive duplicate-name service validation remains intact and returns a clear client-facing error.
- [x] Tests verify exact project-scoped uniqueness exists in table metadata.
- [x] Tests verify duplicate names in different projects remain allowed.

## Blocked by

None - can start immediately

## User stories addressed

- User story 9
- User story 10
- User story 24
- User story 25
