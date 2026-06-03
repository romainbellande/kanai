## Parent PRD

`issues/prd.md`

## What to build

Update the frontend task API adapter and task domain model so frontend code sends, receives, and caches task workflow state as `columnId`/`column_id` only. This slice removes the legacy status field at the API boundary and aligns the already-regenerated OpenAPI artifacts with the hand-written client facade.

## Acceptance criteria

- [ ] The frontend task model uses `columnId` as the canonical workflow field and no longer exposes legacy task status state.
- [ ] Create and update task payloads serialize `column_id` and never serialize `status`.
- [ ] Task responses map backend `column_id` into the frontend task model.
- [ ] Frontend task API adapter tests cover create/update payloads and response mapping with column IDs.

## Blocked by

- Blocked by `issues/001-remove-backend-task-status-persistence.md`

## User stories addressed

- User story 2
- User story 14
- User story 15
- User story 16
- User story 19
- User story 23
