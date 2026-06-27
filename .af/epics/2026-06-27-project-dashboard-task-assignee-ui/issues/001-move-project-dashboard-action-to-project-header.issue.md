# Move Project Dashboard action to the Project header

Status: todo
Type: feature
Parent PRD: ../prd.md
Bead: kanai-ftu

## Description

Project Members can open the Project Dashboard from the Project view header, and the old Project sidenav Dashboard item is removed.

## User Stories Covered

- As a Project Member, I want to open the Project Dashboard from the Project view header, so that analytics are available near the Project actions I already use.

## Blockers / Dependencies

None.

## Acceptance Criteria

- Project view header shows a compact Project Dashboard action near existing Project actions.
- The action links to `/projects/$projectId/dashboard` for the current Project.
- The Project sidenav no longer shows a Dashboard navigation item.
- Existing Project Dashboard route behavior still loads the Project Dashboard.

## Quality Gate

- `bun --bun run check` in `client/` passes.
- `bun --bun run test` in `client/` passes, including coverage that the sidenav item is gone and the header action links to the Project Dashboard.

## Notes

Relevant files include `client/src/domains/workspace/ui/ProjectBoardPage.tsx` and `client/src/domains/workspace/ui/ProjectDashboardPage.test.tsx`.
