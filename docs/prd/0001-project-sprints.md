# Project Sprints

## Problem Statement

Project teams need a way to plan and work inside a Current Sprint instead of seeing every Project Task on the board at once. Today Kanai has Projects, Project Members, Project Owners, workflow columns, and Tasks, but it does not provide Sprint Planning, a Current Sprint default view, a Backlog, or immutable Sprint History.

Without Sprints, a Project Board mixes current work, future work, and finished historical work. Project Members cannot clearly focus on the work selected for the current timebox, and Project Owners cannot close a Sprint with a stable record of what was finished and what carried over.

## Solution

Add project-scoped Sprints to Kanai. Each Project can have at most one Active Sprint, and the Active Sprint is the Current Sprint shown by default when opening the Project. A Sprint starts when created, uses a stable auto-generated Sprint Name such as `Sprint 1`, has a required inclusive Sprint Timebox, and may have an optional Sprint Goal.

The Project Board becomes a set of shareable views: Current Sprint by default, Backlog, and Sprint History. The Sprint Board shows only Sprint Tasks. The Backlog is a manually ordered list of unfinished Backlog Tasks. Project Members can add Backlog Tasks to the Active Sprint and remove Sprint Tasks back to the Backlog. Project Owners can create, edit active Sprint dates/goal, close Sprints, and manage the Project's Done Column.

Closing a Sprint finalizes immutable Sprint History. The close flow records each Historical Sprint Task as it was known at close time, including whether it was a Finished Task according to the Project's Done Column. Unfinished Sprint Tasks return to the top of the Backlog in Sprint Board order. Closed Sprints are not reopened, deleted, or edited in V1.

## User Stories

1. As a Project Owner, I want to create the first Sprint for a Project, so that the team can start working from a Current Sprint.
2. As a Project Owner, I want Kanai to auto-generate `Sprint 1` for the first Sprint, so that I do not have to manually name it.
3. As a Project Owner, I want Kanai to auto-generate the next Sprint Name with an incremental counter, so that Sprint Names stay consistent and unique within the Project.
4. As a Project Owner, I want Sprint Names to be stable after creation, so that Sprint History remains easy to reference.
5. As a Project Owner, I want each Sprint to require a planned start date and end date, so that every Sprint has a clear Sprint Timebox.
6. As a Project Owner, I want Sprint Timeboxes to use inclusive calendar dates, so that Sprint dates are understandable without timezone or timestamp interpretation.
7. As a Project Owner, I want Kanai to suggest a two-week Sprint Timebox, so that creating a Sprint starts from a sensible agile default.
8. As a Project Owner, I want the next Sprint's suggested dates to start after the previous planned Sprint Timebox end date, so that late closing does not silently shift the planning cadence.
9. As a Project Owner, I want to adjust suggested Sprint dates before creation, so that the Sprint Timebox can match the team's real schedule.
10. As a Project Owner, I want Kanai to reject overlapping Sprint Timeboxes within the same Project, so that Sprint History and planning remain coherent.
11. As a Project Owner, I want to create a Sprint with a past start date, so that I can record a Sprint that has already begun.
12. As a Project Owner, I want to add an optional Sprint Goal during Sprint creation, so that the Sprint captures planning intent without requiring extra ceremony.
13. As a Project Owner, I want to create an empty Sprint, so that the team can begin Sprint Planning after the Sprint exists.
14. As a Project Owner, I want to select initial Backlog Tasks during Sprint creation, so that Sprint Planning can happen in the creation flow when useful.
15. As a Project Owner, I want creating a Sprint to make it the Active Sprint immediately, so that the Project has a Current Sprint without a separate start action.
16. As a Project Owner, I want Kanai to block creating a new Sprint while another Sprint is active, so that the Project never has two Active Sprints.
17. As a Project Owner, I want to edit the Active Sprint's dates, so that I can extend or shorten a Sprint before it closes.
18. As a Project Owner, I want to edit the Active Sprint's Sprint Goal, so that the planning intent can be refined while the Sprint is active.
19. As a Project Owner, I want Closed Sprint metadata to be immutable, so that Sprint History cannot be rewritten after close.
20. As a Project Owner, I want Sprints to be non-deletable in V1, so that auto-numbering and Sprint History stay stable.
21. As a Project Owner, I want Closed Sprints to be non-reopenable in V1, so that close-time history remains final.
22. As a Project Owner, I want to designate exactly one Done Column for a Project, so that Kanai can classify Finished Tasks consistently.
23. As a Project Owner, I want Kanai to use an existing column named `Done` as the initial Done Column when it is unambiguous, so that existing Projects can adopt Sprints with minimal setup.
24. As a Project Owner, I want Kanai to require choosing a Done Column when no unambiguous `Done` column exists, so that completion is not inferred from a fragile column name or position.
25. As a Project Owner, I want to change the Done Column for active and future work, so that the Project workflow can evolve.
26. As a Project Owner, I want changing the Done Column to leave Closed Sprint History unchanged, so that historical outcomes are not recalculated.
27. As a Project Owner, I want Kanai to block deleting the Done Column until another column is designated as Done, so that the Project always has exactly one Done Column.
28. As a Project Owner, I want only Project Owners to create Sprints, so that lifecycle changes are controlled by people responsible for project-level planning.
29. As a Project Owner, I want only Project Owners to close Sprints, so that an irreversible history finalization cannot be triggered accidentally by any Project Member.
30. As a Project Member, I want opening a Project to default to the Current Sprint view when an Active Sprint exists, so that I immediately see the work the team is focused on.
31. As a Project Member, I want the base Project URL to default to Current Sprint instead of remembering my last view, so that I do not miss Active Sprint work.
32. As a Project Member, I want a clear no-active-sprint state when no Active Sprint exists, so that I know the Project needs a new Sprint before Current Sprint work can be shown.
33. As a Project Member, I want the no-active-sprint state to offer actions to create a Sprint or view the Backlog, so that I can continue planning or reviewing work.
34. As a Project Member, I want the Sprint Board to show only Sprint Tasks, so that current work is not mixed with Backlog Tasks.
35. As a Project Member, I want the Sprint Board to use the Project's workflow columns, so that Sprint Tasks keep their normal work status.
36. As a Project Member, I want to drag Sprint Tasks between workflow columns, so that the Sprint Board continues to support normal task progress.
37. As a Project Member, I want a Task created from the Sprint Board to become a Sprint Task automatically, so that new current work appears where I created it.
38. As a Project Member, I want a Task created from a specific Sprint Board column to appear in that clicked column, so that the creation action respects board context.
39. As a Project Member, I want a Task created from a general Sprint Board add action to use the first non-Done workflow column, so that new work starts in the Project's starting work column.
40. As a Project Member, I want to view the Backlog as a list, so that future work is presented as planning candidates instead of another board.
41. As a Project Member, I want the Backlog to contain unfinished Tasks that are not selected for the Current Sprint, so that finished historical work does not pollute planning.
42. As a Project Member, I want Finished Tasks to be excluded from the Backlog, so that Sprint Planning focuses on work that remains to be done.
43. As a Project Member, I want the Backlog to have its own manual Backlog Order, so that the team can prioritize future work independently from board column rank.
44. As a Project Member, I want to reorder Backlog Tasks manually, so that Sprint Planning can use a single priority list.
45. As a Project Member, I want a Task created from the Backlog to appear at the top of Backlog Order, so that newly discovered work is visible for triage.
46. As a Project Member, I want a Task created from the Backlog to use the first non-Done workflow column, so that it is unfinished project work even though the Backlog UI is a list.
47. As a Project Member, I want to add a Backlog Task to the Active Sprint, so that newly prioritized work can become current work.
48. As a Project Member, I want adding a Backlog Task to the Active Sprint to preserve its workflow column, so that existing status is not lost.
49. As a Project Member, I want Kanai to prevent adding a Finished Task to the Active Sprint while it is still in the Done Column, so that Sprint Planning cannot include already-finished work by mistake.
50. As a Project Member, I want to remove a Sprint Task back to the Backlog while the Sprint is active, so that the team can correct scope during the Sprint.
51. As a Project Member, I want removing a Sprint Task back to the Backlog to preserve its workflow column, so that task status is not lost.
52. As a Project Member, I want a removed Sprint Task to appear at the top of the Backlog, so that removed work remains visible for replanning.
53. As a Project Member, I want a Task removed from an Active Sprint before close to be excluded from that Sprint's history, so that Sprint History reflects final membership at close time.
54. As a Project Member, I want Backlog and Sprint History views to have shareable URLs, so that teammates can link directly to planning and review views.
55. As a Project Owner, I want the close-sprint action to show a confirmation, so that I understand the irreversible effect before finalizing history.
56. As a Project Owner, I want the close confirmation to show the Sprint Name and Sprint Timebox, so that I can confirm I am closing the intended Sprint.
57. As a Project Owner, I want the close confirmation to show finished and unfinished counts, so that I understand the close outcome.
58. As a Project Owner, I want the close confirmation to list unfinished Sprint Tasks, so that I know which work will return to the Backlog.
59. As a Project Owner, I want the close confirmation to state that unfinished Sprint Tasks will move to the top of the Backlog, so that the resulting Backlog Order is clear.
60. As a Project Owner, I want to close a Sprint even when it has unfinished Sprint Tasks, so that real Sprint endings are not blocked by incomplete work.
61. As a Project Owner, I want closing a Sprint to record a Sprint Close Time, so that history distinguishes the planned Sprint Timebox from the moment history was finalized.
62. As a Project Owner, I want closing a Sprint to classify each Sprint Task as finished or unfinished according to the current Done Column, so that Sprint History has a stable outcome.
63. As a Project Owner, I want closing a Sprint to preserve each Historical Sprint Task title and outcome at close time, so that later task edits do not rewrite history.
64. As a Project Owner, I want closing a Sprint to preserve history even if a Task is later deleted, so that cleanup does not erase past Sprint results.
65. As a Project Owner, I want unfinished Sprint Tasks to return to the top of the Backlog when the Sprint closes, so that carryover work is easy to consider for the next Sprint.
66. As a Project Owner, I want unfinished Sprint Tasks returned on close to preserve their Sprint Board order within each workflow column, so that their relative working order remains understandable.
67. As a Project Member, I want a Carryover Task to be able to appear in multiple Sprint histories, so that history reflects that it was attempted in more than one Sprint.
68. As a Project Member, I want Closed Sprint History to show Sprint Name, Sprint Timebox, Sprint Goal, finished count, and unfinished count, so that I can review the Sprint summary.
69. As a Project Member, I want Closed Sprint History to show Historical Sprint Tasks grouped by finished and unfinished outcome, so that I can see the evidence behind the summary.
70. As a Project Member, I want Closed Sprint History to show close-time task details, so that review reflects what was known when the Sprint closed.
71. As a Project Member, I want Closed Sprint History to link to the live Task when it still exists, so that I can continue from history to current work when relevant.
72. As a Project Member, I want deleted live Tasks to remain visible as Historical Sprint Tasks, so that Sprint History remains complete.
73. As a Project Member, I want Project access rules to apply to Sprints, Backlog, and Sprint History, so that only Project participants can see project planning data.
74. As a Project Owner, I want member-level Sprint Membership edits to match existing task collaboration behavior, so that Project Members can manage day-to-day scope without owner bottlenecks.
75. As a Project Member, I want no story points or estimates in V1, so that the first Sprint feature stays focused on creating, viewing, planning, and closing Sprints.

## Implementation Decisions

- Sprints are scoped to one Project. A Sprint cannot span multiple Projects, and each Project manages its own Current Sprint, Backlog, and Sprint History.
- A Project may have at most one Active Sprint. Current Sprint is derived from explicit Sprint lifecycle state, not from today's date falling inside a Sprint Timebox.
- Creating a Sprint immediately starts it. V1 does not include planned future Sprints or a separate start action.
- Sprint Names are auto-generated per Project with the stable incremental `Sprint N` convention. Names are Project-unique and are not edited after creation.
- A Sprint has required inclusive calendar start and end dates. The default suggestion is a two-week Sprint Timebox. For the next Sprint, suggested dates start the day after the previous planned Sprint Timebox end date, regardless of the Sprint Close Time.
- Sprint Timeboxes cannot overlap within a Project. Past start dates are allowed when the range is otherwise valid and non-overlapping.
- A Sprint may have an optional Sprint Goal. Project Owners can edit the Active Sprint's dates and goal before close, subject to non-overlap. Closed Sprints are immutable.
- Project Owners manage Sprint lifecycle. Project Members can manage Sprint Membership by adding Backlog Tasks to the Active Sprint and removing Sprint Tasks back to the Backlog.
- The Project must have exactly one Done Column. If an existing Project has exactly one column named `Done` case-insensitively, it can be used as the initial Done Column. Otherwise a Project Owner must designate the Done Column before closing a Sprint.
- Done Column changes affect active and future classification only. Closed Sprint History is never recalculated when the Done Column changes.
- The Done Column cannot be deleted until a different workflow column is designated as the Done Column.
- The base Project view defaults to Current Sprint. If no Active Sprint exists, the default view shows a no-active-sprint state with actions to create a Sprint or view the Backlog.
- Backlog and Closed Sprint views have shareable URLs. The default Project URL still lands on the Current Sprint view.
- The Sprint Board shows only Sprint Tasks and uses the Project's workflow columns. Task movement on the Sprint Board continues to update workflow column and board rank.
- A Task created from the Sprint Board is automatically a Sprint Task. Column-specific creation uses the clicked column; general creation uses the first non-Done workflow column.
- The Backlog is a list, not a board. Backlog Tasks still retain workflow column state internally because the existing task model requires workflow columns.
- Backlog Tasks are unfinished Tasks not selected for the Current Sprint. Finished Tasks are excluded from Backlog and cannot be added to the Active Sprint unless moved out of the Done Column first.
- Backlog has an independent manual Backlog Order. Backlog Order is separate from board column rank and task priority labels.
- A Task created from the Backlog uses the first non-Done workflow column and appears at the top of Backlog Order.
- Adding a Backlog Task to the Active Sprint preserves its workflow column. Removing a Sprint Task back to the Backlog also preserves its workflow column.
- Removed Sprint Tasks and unfinished Sprint Tasks returned at close appear at the top of Backlog Order. Unfinished tasks returned at close preserve their Sprint Board order within each workflow column.
- Closing a Sprint is irreversible in V1. Closed Sprints cannot be reopened, edited, or deleted.
- Closing a Sprint is allowed with unfinished Sprint Tasks. The close confirmation shows Sprint Name, Sprint Timebox, finished count, unfinished count, the unfinished task list, and that unfinished tasks will move to the top of the Backlog.
- Sprint Close Time is stored separately from the planned Sprint Timebox.
- Sprint History records close-time membership and outcome. Historical Sprint Tasks preserve close-time task details and finished/unfinished outcome, and can optionally link to the live Task when it still exists.
- A Task removed from the Active Sprint before close does not appear in that Sprint's history. Sprint History reflects final Sprint Membership at close time.
- A Carryover Task can appear in multiple Sprint histories. Moving or adding the same live Task to a later Sprint does not remove it from earlier Closed Sprint History.
- Deleting a live Task after a Sprint closes does not erase Sprint History. The Historical Sprint Task remains visible as close-time history.
- The backend should add Sprint lifecycle, Backlog Order, Done Column designation, Sprint Membership, and Sprint History concepts at the service/API boundary used by the existing Project and Task flows.
- The frontend should extend the existing Project board experience with Current Sprint, Backlog, and Sprint History views rather than creating a separate planning product area.
- API contracts should expose project-scoped Sprint creation, active Sprint retrieval, Active Sprint updates, close confirmation/close execution, Backlog list/reorder, Sprint Membership edits, Done Column designation, and Closed Sprint history retrieval.
- The OpenAPI-backed client wrappers should be extended for the new API contracts and integrated into the existing query/mutation pattern so cache invalidation keeps Project, Task, Sprint, and Backlog views consistent.
- No database migration is required by agent instruction for API schema changes at this stage, but the implementation design should still define the persistence model clearly.

## Testing Decisions

- Good tests should assert external behavior visible at API boundaries and UI behavior visible to users. Tests should not assert private helper structure, database implementation details, or component internals unless no higher seam can observe the behavior.
- Backend behavior should be tested at the endpoint/service seam used by existing Project and Task behavior. The highest-value backend tests cover permissions, Active Sprint uniqueness, Sprint creation defaults, non-overlapping Sprint Timeboxes, Done Column designation, Backlog Order changes, Sprint Membership edits, close-sprint outcomes, and immutable Sprint History.
- Backend prior art exists in the Project router tests that exercise Project and Task endpoints through HTTP-style behavior with database assertions only where necessary to verify persisted effects.
- Task movement and Sprint Membership behavior should be tested through API responses and follow-up list/get calls, not by directly testing ranking helper internals except where pure ordering logic requires focused coverage.
- Frontend behavior should be tested through the Project board user interface seam, because the feature changes what users see when opening a Project and how they move between Current Sprint, Backlog, and Sprint History.
- Frontend prior art exists in Project Board tests that seed query data, render the Project board, exercise user interactions, and assert visible cards, links, route targets, drag/move behavior, and mutation results.
- Backlog-specific frontend tests should assert list rendering, manual reorder behavior, add-to-sprint behavior, remove-to-backlog behavior, and preservation of task workflow metadata as user-visible results.
- Current Sprint frontend tests should assert default landing behavior, no-active-sprint state, Sprint Board filtering, creation from Sprint Board, and Done Column-dependent close confirmation content.
- Sprint History frontend tests should assert summary counts, grouping by finished/unfinished outcome, close-time task details, live Task links when available, and historical placeholders when live Tasks are deleted.
- API client wrapper tests should verify request/response mapping at the public wrapper seam when new Sprint, Backlog, and Done Column contracts are introduced.
- Permission tests should cover Project Owner-only lifecycle actions and Project Member Sprint Membership actions because this feature intentionally splits lifecycle authority from day-to-day scope editing.
- Regression tests should cover the distinction between Backlog Order and board column rank, because conflating those two orders would break Sprint Planning.
- Regression tests should cover explicit Active Sprint state rather than date-derived currentness, including an Active Sprint outside today's date range still being Current Sprint until closed.

## Out of Scope

- Global Sprints that span multiple Projects.
- Workspace-scoped or team-scoped Sprints.
- Planned future Sprints with a separate start action.
- Multiple Active Sprints in one Project.
- Reopening Closed Sprints.
- Deleting Sprints.
- Editing Closed Sprint metadata or history.
- Story points, estimates, velocity charts, burndown charts, or capacity planning.
- Sprint automation based on calendar dates.
- Automatically carrying all unfinished work into the next Sprint.
- Recalculating Closed Sprint History when live Tasks, workflow columns, or Done Column designation change.
- Treating the Backlog as a workflow-column board.
- Allowing Finished Tasks to be selected into a Sprint without first moving them out of the Done Column.
- Cross-project Sprint Planning.

## Further Notes

- This PRD uses the domain language defined in the Kanai glossary and follows the project-scoped Sprint model recorded in the Sprint ADR.
- The first implementation should favor the smallest complete slice that enables creating a Sprint, seeing the Current Sprint by default, managing Sprint Membership, viewing the Backlog, closing the Sprint, and reviewing Sprint History.
- The most important product invariant is that Current Sprint is explicit lifecycle state, while Sprint Timebox is planning metadata.
- The most important history invariant is that closing a Sprint finalizes immutable Sprint History based on close-time task membership and outcome.
