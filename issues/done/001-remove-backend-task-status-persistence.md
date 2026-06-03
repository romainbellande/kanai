## Parent PRD

`issues/prd.md`

## What to build

Remove legacy task status persistence from the backend so task workflow state is represented only by project column IDs. This covers the backend model, service writes for create/update/move workflows, API responses, and regression tests described in the PRD's Solution, Implementation Decisions, and Testing Decisions sections.

## Acceptance criteria

- [x] The task database model no longer defines a legacy `status` field or column metadata.
- [x] Task create, update, list, get, and move workflows persist and return `column_id` without writing or returning status.
- [x] Backend request schemas continue to reject legacy `status` input.
- [x] Backend tests prove task status is absent from task table metadata and absent from task API/service responses.

## Blocked by

None - can start immediately

## User stories addressed

- User story 14
- User story 18
- User story 23
