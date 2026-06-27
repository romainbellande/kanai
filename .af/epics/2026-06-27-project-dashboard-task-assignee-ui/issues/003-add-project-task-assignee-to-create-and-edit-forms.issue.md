# Add Project Task Assignee to create and edit forms

Status: todo
Type: feature
Parent PRD: ../prd.md
Bead: kanai-6ys

## Description

Project Owners and Project Members can choose, change, or clear a nullable Project Task Assignee in Project Task create and edit flows using current Project access users.

## User Stories Covered

- As a Project Owner or Project Member creating a Project Task, I want to choose a Project Task Assignee or leave it unassigned, so that responsibility is clear without forcing assignment.
- As a Project Member editing a Project Task, I want to change or clear the Project Task Assignee, so that responsibility can follow the current plan.

## Blockers / Dependencies

None.

## Acceptance Criteria

- Project Task create defaults to `No assignee` and omits an assignee field from the create payload when left unassigned.
- Project Task create can send the selected Project Task Assignee from Project Owners or Project Members.
- Project Task edit shows the current assignee when `assigneeId` is present.
- Project Task edit can change the assignee or send `null` when the assignee is cleared.
- The assignee control appears in the task form planning area with other planning fields.

## Quality Gate

- `bun --bun run check` in `client/` passes.
- `bun --bun run test` in `client/` passes, including form-seam tests for default no assignee, selected create payloads, edit initial state, and clearing in update payloads.

## Notes

Use the existing nullable `assigneeId` API/client contract; do not add backend schema work or a database migration.
