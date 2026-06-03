## Parent PRD

`issues/prd.md`

## What to build

Make task creation load project columns, render those columns as workflow options, and submit the selected column ID. The create form should not allow submission until project columns are available, and a small pure helper should encapsulate default selection and invalid column-list rules as described in the PRD.

## Acceptance criteria

- [x] The create task page loads project columns before allowing task submission.
- [x] The workflow select renders project column names as labels and column IDs as values.
- [x] Creating a task submits the selected `column_id` and does not submit `status`.
- [x] If columns are unavailable or empty, submission is blocked with a clear user-visible state.
- [x] Pure helper tests cover default selection, empty column lists, loading state, and invalid selections.
- [x] Create task page tests cover loaded columns, rendered options, column-ID submission, and blocked submission.

## Blocked by

- Blocked by `issues/003-send-column-ids-from-task-api-client.md`

## User stories addressed

- User story 1
- User story 2
- User story 3
- User story 4
- User story 11
- User story 17
- User story 19
- User story 23
