## Parent PRD

`issues/prd.md`

## What to build

Make the board-to-create-task path use `column_id` as the route contract and preselect that workflow column in the create task form. This completes the end-to-end path for adding a task from a specific board column.

## Acceptance criteria

- [x] The new-task route accepts `column_id` as the only workflow preselection search parameter.
- [x] Legacy `status` search handling is removed from the route and create form props.
- [x] Add-task links from board columns include the target column ID in the `column_id` search parameter.
- [x] The create task form preselects a valid route-provided column ID after columns load.
- [x] Tests cover board add-task links and create-form route preselection by column ID.

## Blocked by

- Blocked by `issues/004-create-tasks-with-loaded-project-columns.md`

## User stories addressed

- User story 5
- User story 20
- User story 23
