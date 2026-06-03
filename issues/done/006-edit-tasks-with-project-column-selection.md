## Parent PRD

`issues/prd.md`

## What to build

Make task editing load project columns, show the task's current workflow column, and save selected workflow changes by column ID. The edit form should block saving when columns cannot be loaded or when the task references a missing column, exposing a clear integrity error instead of silently choosing a fallback.

## Acceptance criteria

- [x] The task detail page loads project columns for the edit form.
- [x] The workflow select shows project column names and selects the task's current column ID.
- [x] Saving a task submits the selected `column_id` and does not submit `status`.
- [x] Saving is blocked when columns cannot be loaded.
- [x] Saving is blocked with a clear integrity error when the task's column ID is missing from the loaded project columns.
- [x] Pure helper tests cover missing columns and invalid selected columns.
- [x] Task detail page tests cover selected current column, column-ID save, blocked save on column load failure, and blocked save on missing task column.

## Blocked by

- Blocked by `issues/003-send-column-ids-from-task-api-client.md`

## User stories addressed

- User story 6
- User story 7
- User story 8
- User story 12
- User story 13
- User story 17
- User story 21
- User story 22
- User story 23
