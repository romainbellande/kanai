## Problem Statement

Project Members can add a Backlog Task from the Backlog view, but the current experience only offers a title input. That prevents users from capturing the same planning detail they can provide when creating a Task from the board, such as priority, description, acceptance criteria, and tags.

The current user interface also blurs the language around Backlog and workflow columns. Backlog is a planning list, not a workflow column, but existing task creation and column-management affordances can make Backlog look like an editable workflow state. This makes it unclear where a user will return after using the task form and whether Backlog should be managed like a normal board column.

## Solution

Backlog Task creation should use the regular Task form while preserving Backlog as the user-facing destination. When a Project Member starts task creation from the Backlog view, Kanai should open the full Task form, display a read-only `Destination: Backlog` planning field instead of the editable workflow selector, create the task through the Backlog Task creation behavior, and return the user to the Backlog view.

Task forms opened from the Backlog context should carry that context explicitly in the route. When editing an existing Backlog Task from the Backlog list, the return action should say `Back to the Backlog` and navigate back to the Backlog view. Workflow columns should not be nameable as `Backlog`, because that name is reserved for the Backlog planning list.

## User Stories

1. As a Project Member, I want the Backlog add action to open the regular Task form, so that I can capture complete task details.
2. As a Project Member, I want to create a Backlog Task with a title, so that the task can be identified in the Backlog.
3. As a Project Member, I want to create a Backlog Task with priority, so that future work can be triaged when it enters the Backlog.
4. As a Project Member, I want to create a Backlog Task with a description, so that background context is not lost.
5. As a Project Member, I want to create a Backlog Task with acceptance criteria, so that the team understands when the work is finished.
6. As a Project Member, I want to create a Backlog Task with a tag, so that the Backlog can preserve the same categorization available on regular Tasks.
7. As a Project Member, I want a Backlog-origin Task form to show `Destination: Backlog`, so that I understand the Task will be added to the Backlog.
8. As a Project Member, I want the Backlog-origin Task form to hide the workflow selector, so that I do not mistake Backlog for a workflow column.
9. As a Project Member, I want a Backlog Task created from the Backlog form to appear in the Backlog, so that I can continue planning from the same view.
10. As a Project Member, I want a Backlog Task created from the Backlog form to appear at the top of Backlog Order, so that newly discovered work is visible for triage.
11. As a Project Member, I want a Backlog Task created from the Backlog form to remain outside the Current Sprint, so that creating future work does not silently change Sprint Membership.
12. As a Project Member, I want the hidden workflow state for a new Backlog Task to use the first non-Done workflow column, so that the Task remains unfinished project work.
13. As a Project Member, I want task creation from the Current Sprint board to keep its current workflow behavior, so that normal board creation is not disrupted.
14. As a Project Member, I want task creation from a specific workflow column to keep using that column, so that board column-specific creation remains predictable.
15. As a Project Member, I want task creation from the general Current Sprint action to keep using the first non-Done workflow column, so that sprint task creation remains predictable.
16. As a Project Member, I want canceling a Backlog-origin new Task form to return to the Backlog, so that I do not lose my planning context.
17. As a Project Member, I want successfully creating a Backlog Task to return to the Backlog, so that I can immediately see and reorder the new work.
18. As a Project Member, I want opening a Task from the Backlog list to preserve Backlog context, so that the task detail page knows where I came from.
19. As a Project Member, I want a Task form opened from the Backlog to show `Back to the Backlog`, so that the navigation label matches my current workflow.
20. As a Project Member, I want `Back to the Backlog` to navigate to the shareable Backlog view, so that the Backlog route remains linkable.
21. As a Project Member, I want opening the same Task from the board to continue showing board return behavior, so that explicit route context controls navigation.
22. As a Project Member, I want Backlog context to be represented explicitly in route state, so that Backlog behavior does not depend on fragile inference from live task membership.
23. As a Project Member, I want Backlog Task creation errors to appear on the full form, so that I can correct details without losing entered content.
24. As a Project Member, I want workflow-column loading failures to block Backlog Task creation when the hidden workflow default cannot be determined, so that invalid task state is not created.
25. As a Project Member, I want Backlog Task creation to use existing Backlog Task API behavior, so that Backlog Order and Sprint Membership rules remain consistent.
26. As a Project Owner, I want workflow columns not to be creatable with the name `Backlog`, so that the Backlog planning list is not confused with a workflow column.
27. As a Project Owner, I want workflow columns not to be renameable to `Backlog`, so that existing projects cannot introduce ambiguous workflow language.
28. As a Project Owner, I want the `Backlog` name rule to be case-insensitive, so that variants such as `backlog` or `BACKLOG` do not bypass the reservation.
29. As a Project Owner, I want frontend validation for the reserved `Backlog` column name, so that I get immediate feedback before submitting.
30. As a Project Owner, I want backend validation for the reserved `Backlog` column name, so that the rule is enforced for every client.
31. As a Project Member, I want Backlog to remain a planning list, so that Sprint Planning and Backlog Order keep their current meaning.
32. As a Project Member, I want the Backlog view to remain a list rather than a workflow board, so that future work is presented as planning candidates.
33. As a Project Member, I want existing Backlog reorder behavior to continue after full-form creation, so that prioritization remains unchanged.
34. As a Project Member, I want adding a Backlog Task to the Active Sprint to continue preserving its workflow column, so that existing Sprint Membership behavior is not disrupted.
35. As a Project Member, I want removing a Sprint Task back to the Backlog to continue preserving its workflow column, so that the Backlog form change does not alter scope-management behavior.

## Implementation Decisions

- Backlog remains a planning list, not a workflow column. The domain glossary explicitly describes Backlog as separate from Project workflow columns.
- Backlog-origin forms use explicit route context, such as a `backlog=true` search parameter, rather than inferring context from a Task's current state.
- The Backlog view no longer creates Tasks through an inline title-only form. Its add action opens the regular Task form in Backlog context.
- The regular Task form gains a Backlog creation mode. It keeps the existing full-detail fields while replacing the workflow selector with a read-only `Destination: Backlog` field.
- The underlying workflow column for Backlog Task creation is selected automatically as the first non-Done workflow column. This is hidden from the user because it is implementation state, not the Backlog destination.
- Backlog Task creation uses the existing Backlog Task creation API behavior and sends the full Task creation payload supported by that contract.
- Successful Backlog Task creation and cancel/back navigation return to the shareable Backlog view.
- Task detail routes support explicit Backlog context. Links from the Backlog list include that context and show `Back to the Backlog`.
- The `Backlog` workflow column name is reserved case-insensitively. Creating or renaming a workflow column to `Backlog` is invalid in both frontend validation and backend validation.
- No database migration is required.

## Testing Decisions

- Tests should assert user-visible behavior and API contract effects, not internal component structure.
- Frontend route tests should validate Backlog search parameters for new task and task detail routes.
- Backlog view tests should assert that the add action opens the full Task form route with Backlog context and that the inline title-only creation form is no longer present.
- Task form tests should cover Backlog-origin creation: full details are editable, workflow selection is hidden, `Destination: Backlog` is visible, the Backlog Task API path is used, and navigation returns to the Backlog view.
- Task detail tests should cover Backlog-origin navigation: Backlog list links preserve context and the detail form shows `Back to the Backlog`.
- API client tests should cover sending full Task creation data through the Backlog Task creation wrapper and invalidating Backlog-related cached data.
- Backend service or router tests should cover the reserved workflow column name for both create and rename behavior.
- Existing Project board tests, Create Task form tests, Column form tests, and task API wrapper tests are the best prior-art seams for this work.

## Out of Scope

- Redesigning the Backlog list beyond replacing inline creation with the full-form entry point.
- Treating Backlog as a workflow column.
- Changing Backlog Order semantics.
- Changing Sprint Membership rules for adding Backlog Tasks to the Active Sprint or removing Sprint Tasks back to the Backlog.
- Adding assignee editing, since the existing Task form currently keeps assignees non-editable until the user directory API is available.
- Introducing database migrations.

## Further Notes

- This PRD refines the Project Sprints behavior: Backlog remains an ordered planning list of unfinished non-sprint work.
- The route context is intentionally explicit so a Task can have different return navigation depending on whether the user opened it from Backlog or from the board.
- The reserved `Backlog` column name prevents future ambiguity between the Backlog planning list and editable workflow columns.
