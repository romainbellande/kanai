# Project Dashboard access and Project Task Assignee UI

Status: open
Labels: frontend, project-dashboard, project-task-assignee, ready-for-agent

## Problem Statement

Project Members need the Project Dashboard to be easy to reach from the Project view, and Project Tasks need a visible, editable Project Task Assignee so responsibility is clear during planning and workflow execution. Current task form entry also feels slow because task form shells use a long rise-in animation.

## Solution

Move Project Dashboard access from the Project sidenav into the Project view header, remove the slow task-form entry animation, and add Project Task Assignee selection to Project Task create/edit flows. Board cards will show the assigned Project participant as a compact initials avatar with an accessible full-name label.

## User Stories

- As a Project Member, I want to open the Project Dashboard from the Project view header, so that analytics are available near the Project actions I already use.
- As a Project Owner or Project Member creating a Project Task, I want to choose a Project Task Assignee or leave it unassigned, so that responsibility is clear without forcing assignment.
- As a Project Member editing a Project Task, I want to change or clear the Project Task Assignee, so that responsibility can follow the current plan.
- As a Project Member viewing the workflow board, I want assigned Project Tasks to show the assigned participant compactly and accessibly, so that ownership is visible without crowding cards.
- As a Project Member using task forms, I want task form entry to feel immediate, so that creating or editing work does not feel delayed.

## Implementation Decisions

- This is a frontend-only slice unless current API behavior proves otherwise; it should use the existing nullable `assigneeId` API/client contract and must not require a database migration.
- Project Task Assignee options are the Project access users: Project Owners plus Project Members.
- Task create defaults to no Project Task Assignee; task edit reflects the current `assigneeId` when present.
- Create payloads send no assignee field when the user leaves `No assignee` selected; update payloads send `null` when the user clears an existing Project Task Assignee.
- Project Task Assignee controls belong in the task form planning area alongside other planning fields.
- Board card assignee display uses a compact initials avatar and an accessible full-name label.
- Project Dashboard navigation is removed from the Project sidenav and added as a compact header action near existing Project actions.
- Remove the task-form shell `rise-in` animation only from task forms; do not change the shared animation globally.

## Testing Decisions

- Cover task create/edit form behavior at the form seam: default no assignee, selected assignee in create payloads, existing assignee in edit initial state, and clearing assignee in update payloads.
- Cover workflow board card rendering for assigned Project Tasks, including accessible labeling for the initials avatar.
- Cover Project Dashboard navigation placement by verifying the sidenav item is gone and the header action links to the Project Dashboard.
- Cover that task form shells no longer apply the slow entry animation.
- Run the frontend check and test commands for `client/`; the repo-level quality gate remains `just pre-commit` before the implementation slice is done.

## Out of Scope

- Backend schema or database migrations.
- Multiple assignees per Project Task.
- New Project roles or permission models.
- Cosmetic redesigns of the Project header, sidenav, board cards, or task forms beyond the smallest changes needed for this behavior.
- New dependencies or reusable UI abstractions unless existing components cannot cover the controls.

## Further Notes

- Source context came from `.af/handoff/0001-dashboard-task-assignee-ui.md`.
- Kanai glossary terms from `CONTEXT.md` apply, especially Project Dashboard, Project Task, Project Task Assignee, Project Owner, Project Member, and Workflow Column.
