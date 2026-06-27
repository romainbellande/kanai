# Show Project Task Assignee on workflow board cards

Status: todo
Type: feature
Parent PRD: ../prd.md
Bead: kanai-nap

## Description

Assigned Project Tasks on the workflow board show the assigned Project participant as a compact initials avatar with an accessible full-name label.

## User Stories Covered

- As a Project Member viewing the workflow board, I want assigned Project Tasks to show the assigned participant compactly and accessibly, so that ownership is visible without crowding cards.

## Blockers / Dependencies

None.

## Acceptance Criteria

- Board cards with `assigneeId` show a compact initials avatar for the matching Project Owner or Project Member.
- The avatar exposes the Project participant full-name label to assistive technology.
- Board cards without `assigneeId` do not show an assignee avatar.
- Unknown or unloaded assignee data degrades without breaking card navigation or drag behavior.

## Quality Gate

- `bun --bun run check` in `client/` passes.
- `bun --bun run test` in `client/` passes, including workflow board card rendering tests for assigned Project Tasks and accessible labeling.

## Notes

Existing Project participant avatar helpers in `client/src/domains/workspace/ui/ProjectBoardPage.tsx` can likely cover initials and labels without a new dependency.
