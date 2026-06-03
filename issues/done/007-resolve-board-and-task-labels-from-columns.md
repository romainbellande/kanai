## Parent PRD

`issues/prd.md`

## What to build

Ensure task workflow labels across board, list, and detail surfaces are derived from loaded project columns rather than denormalized task status. This makes column renames visible everywhere and treats stale task-column references as errors instead of silently moving or relabeling work.

## Acceptance criteria

- [ ] Board and task-facing UI labels use project column names from loaded columns.
- [ ] Column renames are reflected in task workflow labels without requiring task data changes.
- [ ] Tasks with missing or stale column references are surfaced as integrity errors or excluded from normal workflow interactions with a clear user-visible state.
- [ ] Tests verify labels come from project columns and update when column names change.
- [ ] Tests verify invalid task-column references are not silently reassigned or treated as legacy statuses.

## Blocked by

- Blocked by `issues/004-create-tasks-with-loaded-project-columns.md`
- Blocked by `issues/006-edit-tasks-with-project-column-selection.md`

## User stories addressed

- User story 8
- User story 21
- User story 22
- User story 23
