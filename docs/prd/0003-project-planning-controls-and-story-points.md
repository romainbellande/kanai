# Project Planning Controls and Story Points

## Problem Statement

Project Members and Project Owners need Kanai's planning experience to match the way project-scoped work is now organized. The Backlog is a first-class planning list, but its browser URL is still a search-param view. Project-level settings are split across board UI, metadata editing, and legacy Project Priority language that no longer reflects the domain. Tasks also cannot be sized with Story Points, so Sprint Planning, Backlog review, Sprint progress, Sprint close preview, and Sprint History all lack a clear way to show estimated scope or warn when Tasks have no estimation.

## Solution

Introduce a staged improvement to Kanai's project planning experience. First, initialize shadcn in Base UI mode and migrate existing Task and Project form controls without behavior changes so later feature work uses consistent UI primitives mapped to Kanai's visual language. Then make `/projects/:projectId/backlog` the canonical Backlog route, move Done Column configuration into the inline Edit Project view, remove Project Priority from the Project contract, make Project Status a fixed non-null descriptive label, and add optional Story Points to Tasks. Story Points use the fixed scale 1, 2, 3, 5, 8, and 13, display as `N pts`, warn as `No estimation` when absent, power Backlog and Current Sprint planning summaries, and are preserved in Sprint History at Sprint Close Time.

## User Stories

1. As a Project Member, I want the Backlog to have the canonical path `/projects/:projectId/backlog`, so that I can share a direct planning URL.
2. As a Project Member, I want Backlog links to stop using the `view=backlog` search parameter, so that Backlog navigation feels like a first-class page.
3. As a Project Member, I want opening the canonical Backlog path to show the Project Backlog, so that future work is immediately visible.
4. As a Project Member, I want the Current Sprint view to keep the base Project path, so that the default Project URL remains focused on current work.
5. As a Project Member, I want links from the Current Sprint view to point to the canonical Backlog path, so that navigation uses the same URL every time.
6. As a Project Member, I want links from the no-active-sprint state to point to the canonical Backlog path, so that planning remains available when there is no Current Sprint.
7. As a Project Member, I want the Backlog page to keep its link back to Current Sprint, so that I can switch between future and current work.
8. As a Project Member, I want Backlog-origin task creation and task detail return behavior to continue working, so that the route cleanup does not disrupt existing Backlog workflows.
9. As a Project Member, I want Backlog-specific task create and detail routes to remain unchanged for now, so that the route change stays focused on the Backlog page itself.
10. As a Project Member, I want Task and Project form controls to look and behave consistently, so that the planning UI feels coherent.
11. As a Project Member, I want the shadcn migration to preserve existing Task form behavior, so that no workflow changes happen during the UI migration slice.
12. As a Project Owner, I want the shadcn migration to preserve existing Project form behavior, so that no metadata changes happen during the UI migration slice.
13. As a Project Member, I want shadcn components to keep Kanai's existing colors, shape, and typography, so that new controls do not introduce a separate visual language.
14. As a Project Member, I want Task form inputs, textareas, selects, and buttons to use the same component system, so that creating and editing Tasks feels consistent.
15. As a Project Owner, I want Project create and edit inputs, textareas, selects, and buttons to use the same component system, so that managing Projects feels consistent.
16. As a Project Owner, I want an inline Edit Project view, so that I can update Project metadata without leaving the Project page.
17. As a Project Owner, I want the existing metadata edit affordance to become Edit Project, so that Project-level configuration has a single obvious place.
18. As a Project Owner, I want Edit Project to include the Project name, so that I can correct or refine the Project's display name.
19. As a Project Owner, I want Edit Project to include the Project code, so that I can correct the short identifier when needed.
20. As a Project Owner, I want changing the Project name not to auto-change the Project code, so that existing codes remain stable unless I explicitly edit them.
21. As a Project Owner, I want Edit Project to include the Project description, so that I can keep the Project context current.
22. As a Project Owner, I want Edit Project to include Project Status, so that the Project lifecycle label can be maintained.
23. As a Project Owner, I want Project Status to use fixed values active, paused, blocked, and done, so that Projects use consistent lifecycle language.
24. As a Project Member, I want Project Status to display as Active, Paused, Blocked, or Done, so that status labels are readable.
25. As a Project Owner, I want new Projects to default to active status, so that new work areas start in an explicit lifecycle state.
26. As a Project Member, I want existing Projects with blank status to read as active, so that old Project data fits the new status contract.
27. As a Project Member, I want Project Status to be non-null in Project API responses, so that clients do not need to interpret missing status.
28. As a Project Owner, I want invalid Project Status values to be rejected, so that the fixed status vocabulary is enforced for every client.
29. As a Project Member, I want Project Status to be display-only behavior, so that paused, blocked, or done labels do not unexpectedly prevent task or Sprint work.
30. As a Project Owner, I want Project Priority removed from Project creation, so that Projects no longer carry a priority field that does not match the domain.
31. As a Project Owner, I want Project Priority removed from Project editing, so that Project metadata only contains current Project concepts.
32. As a Project Member, I want Project Priority removed from Project cards and reads, so that old Project priority labels no longer appear in the UI.
33. As an API client, I want Project requests that still send priority to be rejected, so that removed Project language is not silently accepted.
34. As a Project Member, I want Task Priority to remain unchanged, so that individual Tasks can still carry priority labels.
35. As a Project Owner, I want Done Column selection to live only inside Edit Project, so that Project-level settings are configured in one place.
36. As a Project Owner, I want Edit Project to save metadata and Done Column together, so that Project-level changes are applied with one action.
37. As a Project Owner, I want Edit Project to require a Done Column when workflow columns exist, so that Kanai can classify Finished Tasks consistently.
38. As a Project Owner, I want Edit Project to allow metadata saves when no workflow columns exist, so that I am not blocked by an impossible Done Column choice.
39. As a Project Owner, I want a disabled Done Column control with guidance when no workflow columns exist, so that I understand a workflow column must be added first.
40. As a Project Owner, I want a non-editable warning outside Edit Project when Done Column is missing, so that I know why progress or Sprint close classification is unavailable.
41. As a Project Owner, I want the missing Done Column warning to lead me to Edit Project, so that I can fix the configuration in the correct place.
42. As a Project Member, I want the board not to show a standalone Done Column selector, so that Done Column editing is not scattered across the page.
43. As a Project Member, I want active Sprint progress to recalculate if the Project Done Column changes, so that current planning reflects the latest Project configuration.
44. As a Project Member, I want Closed Sprint History to remain unchanged when Done Column changes, so that historical outcomes stay immutable.
45. As a Project Member, I want Tasks to have optional Story Points, so that the team can size work for planning.
46. As a Project Member, I want Story Points to use the fixed scale 1, 2, 3, 5, 8, and 13, so that estimates are consistent.
47. As a Project Member, I want Story Points to be optional, so that I can capture work before it has been estimated.
48. As a Project Member, I want create Task forms to include Story Points, so that new work can be estimated immediately.
49. As a Project Member, I want edit Task forms to include Story Points, so that existing work can be estimated or re-estimated.
50. As a Project Member, I want the empty Story Points option to say No estimation, so that the absence state is explicit.
51. As a Project Member, I want Story Points to be selected from a dropdown, so that the fixed scale is easy to choose from.
52. As an API client, I want invalid Story Points to be rejected, so that Tasks cannot persist unsupported estimate values.
53. As a Project Member, I want blank Story Points to be stored as no estimation, so that optional estimates are represented consistently.
54. As a Project Member, I want estimated Tasks to show `N pts`, so that point size is visible without opening the Task.
55. As a Project Member, I want unestimated Tasks to show a warning-style No estimation badge, so that missing estimates are easy to find.
56. As a Project Member, I want Story Point badges in the top badge row of Sprint Board cards, so that estimate state is visible with other planning metadata.
57. As a Project Member, I want Story Point badges in Backlog rows, so that Sprint Planning can quickly identify estimated and unestimated Backlog Tasks.
58. As a Project Member, I want Story Point badges in Sprint History, so that historical sizing is visible during review.
59. As a Project Owner, I want the Sprint close preview to show Story Points or No estimation for unfinished Sprint Tasks, so that carryover scope is visible before close.
60. As a Project Member, I want missing Story Points never to block Sprint creation, so that planning can start before every Task is sized.
61. As a Project Member, I want missing Story Points never to block adding a Backlog Task to the Current Sprint, so that scope can be refined incrementally.
62. As a Project Owner, I want missing Story Points never to block Sprint close, so that Sprint lifecycle is not held hostage by incomplete estimates.
63. As a Project Member, I want the Backlog header to show estimated point total and unestimated Task count, so that Backlog scope is understandable.
64. As a Project Member, I want the Backlog total to ignore unestimated Tasks but count them separately, so that missing estimates are visible without being treated as zero.
65. As a Project Member, I want the Current Sprint header to show Story Point progress, so that I can see estimated Sprint progress at a glance.
66. As a Project Member, I want Current Sprint progress to use estimated Story Points only, so that unestimated Tasks do not distort the progress bar.
67. As a Project Member, I want Current Sprint progress labels to show points done and points remaining, so that the split is understandable without relying on a percentage.
68. As a Project Member, I want the visible Current Sprint progress UI not to show a percentage, so that planning remains point-focused.
69. As a Project Member, I want unestimated Sprint Tasks shown as a separate indicator outside the progress bar, so that missing estimates are not confused with remaining estimated work.
70. As a Project Member, I want the Current Sprint progress bar omitted when no Done Column is configured, so that Kanai does not imply a finished/unfinished split it cannot calculate.
71. As a Project Member, I want the Current Sprint progress area to show a warning when no Done Column is configured, so that the missing prerequisite is clear.
72. As a Project Member, I want the Current Sprint progress bar omitted when the Sprint has zero estimated points, so that an empty bar does not imply no progress.
73. As a Project Member, I want the zero-estimated Sprint state to show `0 pts estimated` and the No estimation count, so that I understand the Sprint needs estimates.
74. As a Project Member, I want all Project participants to see Story Points, totals, and progress, so that planning visibility is shared.
75. As a Project Member, I want Task editing permissions for Story Points to follow existing Task edit permissions, so that estimation does not introduce a new access model.
76. As a Project Member, I want Story Points preserved in Historical Sprint Tasks at Sprint Close Time, so that later edits do not rewrite Sprint History.
77. As a Project Member, I want closed Sprint History to show finished and unfinished Story Point splits, so that Sprint review shows both completed and carried-over scope.
78. As a Project Member, I want closed Sprint History to show progress bars, so that finished versus unfinished historical scope is visually clear.
79. As a Project Member, I want closed Sprint History to keep unestimated indicators separate from progress bars, so that missing historical estimates remain visible.
80. As a Project Member, I want Carryover Tasks to keep their historical Story Points in the previous Sprint, so that re-estimation later does not alter the past.
81. As a Project Member, I want deleted live Tasks to keep their historical Story Points in Sprint History, so that history remains complete.
82. As a Project Owner, I want closing a Sprint to snapshot each Sprint Task's Story Points, so that Sprint History reflects close-time sizing.
83. As a Project Member, I want Backlog and Sprint progress summaries to update after Task Story Points change, so that planning information stays current.
84. As a Project Member, I want Story Point changes to appear on Task cards after save, so that I can confirm the estimate without reopening the Task.
85. As a Project Member, I want Project Status and Story Points API values to be predictable, so that generated clients and frontend wrappers can map them safely.
86. As a Project Owner, I want implementation work split into safe slices, so that UI migration, routing, Project metadata, and Story Points can be reviewed independently.

## Implementation Decisions

- The first implementation slice initializes shadcn in Base UI mode and maps shadcn semantic tokens to Kanai's existing visual tokens. This slice must preserve current Task and Project form behavior.
- The shadcn migration converts Task and Project form controls that are already present before feature behavior changes. It should not refactor unrelated board, sidebar, or layout UI.
- Feature implementation proceeds after the shadcn migration in this order: canonical Backlog route, Project metadata and Done Column configuration, then Story Points with progress and history.
- The Backlog page's canonical browser path is `/projects/:projectId/backlog`. The base Project path remains the Current Sprint view.
- Existing Backlog-origin Task create/detail route context remains in place. This PRD does not move task create/detail paths under the Backlog path.
- No legacy redirect from the old `view=backlog` search-param view is required unless implementation uncovers a concrete compatibility need.
- Edit Project is the inline Project-level form. It includes Project name, Project code, Project description, Project Status, and Done Column.
- Project code remains stable when the Project name changes. Owners may change the code only by editing the code field directly.
- Project Status is a fixed descriptive lifecycle label. API/storage values are lowercase: `active`, `paused`, `blocked`, and `done`. UI labels are title case.
- New Projects default to `active` status in both frontend and backend behavior.
- Existing blank or null Project statuses are read as `active` by the API. Public Project reads return a non-null Project Status.
- Project Status is display-only. It does not block Task creation, Task edits, Sprint Membership changes, Sprint lifecycle actions, Backlog use, or Project editing.
- Project Priority is removed from the Project domain contract, API requests/responses, and UI. Requests that include Project priority are rejected instead of ignored.
- Task Priority remains unchanged as Task-level planning metadata.
- If persistence still contains a legacy Project priority column before a future migration, any required value is an internal compatibility detail and must not be exposed in the Project contract or UI.
- Done Column remains Project-level. It is not Current Sprint-specific.
- Done Column selection is editable only inside Edit Project. Standalone Done Column selector UI is removed from the board.
- Edit Project saves Project metadata and Done Column together from the user's perspective. The implementation may issue more than one backend request if existing API boundaries require it, but the UI presents one save action.
- When workflow columns exist, Edit Project requires selecting a Done Column before saving succeeds.
- When no workflow columns exist, Edit Project allows saving metadata, disables Done Column selection, and explains that a workflow column must be added first.
- Outside Edit Project, a missing Done Column produces a non-editable warning with a path to open Edit Project. No Done Column selector appears outside Edit Project.
- Active Sprint point progress uses the current Project Done Column. Changing the Done Column recalculates active progress immediately.
- Closed Sprint History remains immutable when Done Column changes. Historical outcomes are not recalculated.
- Story Points are optional Task sizing metadata with allowed values 1, 2, 3, 5, 8, and 13.
- Task create and update contracts accept Story Points as nullable or absent. Non-null values outside the fixed scale are invalid.
- Task read contracts include Story Points so board, Backlog, task detail, Sprint close preview, and Sprint History views can display them.
- Task forms display Story Points as a select field. The empty option label is `No estimation`.
- Estimated Task cards and rows display Story Points as `N pts`.
- Unestimated Task cards and rows display a warning-style `No estimation` badge. This badge is non-blocking and should not look like a hard error.
- Story Point or No estimation badges sit in the top badge row with other Task planning metadata.
- Backlog summaries display estimated point total plus a separate No estimation count. Unestimated Tasks are not counted as zero points.
- Active Sprint progress uses estimated Story Points only as the denominator. It shows a shadcn Progress bar for points done, labels for points done and points remaining, and a separate unestimated Task indicator.
- The active Sprint progress UI does not show a visible percentage. Any percentage exists only as part of progress semantics/accessibility.
- If the Project has no Done Column, active Sprint progress omits the progress bar and shows the missing Done Column warning.
- If an active Sprint has Tasks but zero estimated Story Points, active Sprint progress omits the progress bar and shows `0 pts estimated` plus the No estimation count.
- Sprint close preview shows Story Points or No estimation labels for unfinished Sprint Tasks.
- Closing a Sprint snapshots each Sprint Task's Story Points into Historical Sprint Tasks at Sprint Close Time.
- Closed Sprint History displays historical Story Points and uses progress bars for finished versus unfinished point splits.
- Closed Sprint History keeps unestimated historical Task counts separate from progress bars.
- Story Points and progress are visible to Project Owners and Project Members. Edit permissions follow existing Task and Project permissions.
- Missing Story Points never block Sprint creation, adding Backlog Tasks to the Current Sprint, or Sprint close.
- API client wrappers are updated to map Project Status, removed Project Priority, Story Points, Done Column, Backlog route usage, and Sprint History Story Point data through the existing query and mutation patterns.
- No database migration is required by the current agent instruction, but implementation should still define model/schema changes clearly and keep tests deterministic.

## Testing Decisions

- Good tests should assert external behavior visible at API boundaries and user-visible UI behavior. Tests should not assert private helper structure, generated component internals, or implementation details of shadcn components.
- The no-behavior shadcn migration should be protected by existing Task and Project form tests. Those tests should continue asserting fields, submitted payloads, validation messages, and navigation rather than component internals.
- Backlog routing should be tested at the Project board/router seam. Tests should assert the canonical Backlog path renders Backlog, board links point to that path, and the base Project path remains Current Sprint.
- Backlog route tests should also assert that Backlog-origin task create/detail context still returns users to the Backlog view.
- Project metadata behavior should be tested through Project create/edit UI behavior and backend Project API behavior. Tests should cover default active status, fixed status values, non-null reads, null/blank read normalization, and rejection of removed Project priority input.
- Project Priority removal should be tested at the API contract seam and visible UI seam. Tests should assert Project create/edit flows do not expose priority while Task Priority remains available on Task forms and Task cards.
- Done Column placement should be tested through Project board UI behavior. Tests should assert the standalone selector is gone, Edit Project includes Done Column selection, save behavior updates configuration, missing Done Column warning appears outside Edit Project, and no-columns Projects can still save metadata.
- Story Points create/edit behavior should be tested through the Task form hook and Task form UI seams. Tests should assert allowed options, empty No estimation behavior, payload mapping, invalid value rejection through backend validation, and updated Task reads.
- Task API tests should cover Story Points on create, update, clear, read, and invalid input. Existing task schema/service tests are the prior art for optional task fields and validation.
- API client wrapper tests should cover JSON mapping for Story Points, Project Status, removed Project Priority, and historical Story Points.
- Project board UI tests should cover Task card and Backlog row badges for `N pts` and `No estimation`, including top badge row visibility.
- Backlog summary tests should assert estimated total plus No estimation count and ensure unestimated Tasks do not contribute to point totals.
- Active Sprint progress tests should assert point-done and point-remaining labels, shadcn progress visibility, separate No estimation indicator, missing Done Column no-bar behavior, and zero-estimated no-bar behavior.
- Sprint close preview tests should assert unfinished Task labels include Story Points or No estimation before close.
- Sprint service and history tests should assert Story Points are snapshotted at Sprint Close Time, live Task re-estimation does not rewrite history, deleted live Tasks retain historical Story Points, and Carryover Tasks preserve prior historical sizing.
- Sprint History UI tests should assert progress bars for finished/unfinished point splits, historical per-task Story Points, and separate unestimated indicators.
- Permission tests should reuse existing Project Owner and Project Member access seams. Story Point visibility is shared, Task edit permissions remain existing Task permissions, and Done Column editing remains Project Owner-only through Edit Project.
- Regression tests should cover Done Column changes recalculating active progress while leaving Closed Sprint History unchanged.
- Regression tests should cover Project Status being descriptive only, so non-active statuses do not block Task, Backlog, Sprint, or Project edit behavior.

## Out of Scope

- Interviewing users or reopening the decisions already confirmed in the design session.
- Redirecting old `view=backlog` URLs to the new Backlog path.
- Moving Backlog-origin task create or task detail routes under `/backlog`.
- Changing the Current Sprint default route away from the base Project path.
- Converting the entire application UI to shadcn components beyond Task and Project form controls and the feature-touched planning controls.
- Introducing Radix-mode shadcn components.
- Introducing a different visual theme from Kanai's existing colors, typography, and shape language.
- Removing Task Priority.
- Making Project Status block or gate behavior.
- Making Done Column Current Sprint-specific.
- Showing editable Done Column controls outside Edit Project.
- Blocking Sprint lifecycle actions when Tasks have No estimation.
- Treating unestimated Tasks as zero points in progress bars or totals.
- Visible percentage labels in Sprint progress UI.
- Velocity charts, burndown charts, capacity planning, forecasting, or team throughput analytics.
- Recalculating Closed Sprint History when live Tasks, Done Column, or Project configuration changes.
- Database migrations for this stage.
- Automatic Project code changes when editing Project name.

## Further Notes

- This PRD follows the Kanai glossary terms Project, Project Owner, Project Member, Current Sprint, Backlog, Backlog Task, Story Points, Done Column, Finished Task, Sprint History, Historical Sprint Task, Carryover Task, and Sprint Close Time.
- This PRD builds on the project-scoped Sprint ADR, especially the rule that Sprint History is immutable and Backlog is an ordered planning list separate from workflow columns.
- This PRD respects the shadcn Base UI ADR by using Base UI components for the migrated and feature-touched controls while avoiding a full-app UI rewrite.
- This PRD respects the Project metadata contract ADR by removing Project Priority, keeping Task Priority, and fixing Project Status as active, paused, blocked, or done.
- The original Project Sprints PRD explicitly kept estimates out of the first Sprint implementation. This PRD supersedes that out-of-scope item by adding Story Points as a later planning enhancement.
