# Remove slow Project Task form entry animation

Status: todo
Type: feature
Parent PRD: ../prd.md
Bead: kanai-4hg

## Description

Project Task create and edit form shells render immediately by dropping the task-form-only `rise-in` class without changing shared animation styles or unrelated pages.

## User Stories Covered

- As a Project Member using task forms, I want task form entry to feel immediate, so that creating or editing work does not feel delayed.

## Blockers / Dependencies

None.

## Acceptance Criteria

- Project Task create form shell does not apply `rise-in`.
- Project Task edit form shell does not apply `rise-in`.
- Shared `.rise-in` styles remain available for non-task-form UI.
- Column, Project, auth, and other unrelated shells keep their current animation behavior.

## Quality Gate

- `bun --bun run check` in `client/` passes.
- `bun --bun run test` in `client/` passes, including coverage that task form shells no longer apply the slow entry animation.

## Notes

Relevant files include `client/src/domains/workspace/ui/CreateTaskPage.tsx` and `client/src/domains/workspace/ui/TaskDetailPage.tsx`.
