# Project Dashboard

## Problem Statement

Project Members can manage Sprint Tasks on the Project board, but they do not have a separate Project Dashboard that explains planning flow, delivery pace, and work health over time. The current burndown chart is a stateless approximation embedded in the board and cannot expose true Project Analytics History, Sprint Scope changes, Workflow Column movement, Blocked Project Task age, Project Task Cycle Time, rework, throughput, or forecast risk. Project Owners need durable, chart-ready analytics that start from real Project Task Change Events instead of guesses from current Project Task state.

## Solution

Add a separate Project Dashboard route for each Project that presents a responsive titled-card grid of analytics charts backed by durable Project Analytics History. Record append-only Project Task Change Events from ship date forward for scope, workflow-state, estimate, completion, blocked, and rework changes; derive one aggregated dashboard response with chart-ready series and empty-state metadata. Move the existing burndown experience off the Project board and onto the dashboard, then add burnup, Sprint Scope change, velocity, Cumulative Flow Diagram, Project Task Cycle Time, throughput, Blocked Project Task, defect / rework, forecast cone, and work aging views using the resolved domain decisions.

## User Stories

1. As a Project Member, I want a Project Dashboard separate from the workflow board, so that analytics do not compete with daily task movement.
2. As a Project Member, I want to open a dashboard for a specific Project, so that the analytics match the Project I am working in.
3. As a Project Member, I want the Project sidebar to include a dashboard item, so that I can navigate between the board and analytics without guessing the URL.
4. As a Project Member, I want the board to stop showing analytics cards, so that the board remains focused on Sprint Task execution.
5. As a Project Owner, I want Project Dashboard charts to use Project Analytics History, so that trends reflect real changes over time.
6. As a Project Owner, I want Project Analytics History to be based on Project Task Change Events, so that changes can be reconstructed without daily snapshot jobs.
7. As a Project Owner, I want analytics history to start from the ship date, so that the product does not pretend to know history it never recorded.
8. As a Project Member, I want sparse analytics to show titled chart cards with clear empty-state messages, so that I understand why data is missing.
9. As a Project Member, I want empty charts to remain visible instead of disappearing, so that I know which metrics the dashboard supports.
10. As a Project Member, I want charts never to render fake historical data, so that I do not make planning decisions from invented trends.
11. As a Project Owner, I want one dashboard data load to return chart-ready data and empty-state metadata, so that the dashboard is consistent and fast to reason about.
12. As a frontend maintainer, I want a single typed dashboard contract, so that chart cards do not each invent their own API shape.
13. As a backend maintainer, I want dashboard aggregation to be computed from Project Task Change Events on read, so that correctness comes before caching.
14. As a backend maintainer, I want a future daily snapshot or cache to be a read optimization only, so that the source of truth remains Project Task Change Events.
15. As a Project Member, I want Story Points to be the primary work unit in dashboard charts, so that analytics align with Sprint Planning.
16. As a Project Member, I want task counts to appear as supporting context, so that unpointed volume is still visible.
17. As a Project Owner, I want unestimated Project Tasks excluded from point lines, so that point charts are not distorted by missing estimates.
18. As a Project Owner, I want unestimated Project Task counts shown separately, so that missing estimates remain visible planning risk.
19. As a Project Member, I want the dashboard default window to include current state plus the last six Sprints, so that recent delivery patterns are visible without overwhelming older history.
20. As a Project Member, I want trend charts to default to weekly buckets, so that sparse work does not produce noisy daily charts.
21. As a Project Owner, I want the Burndown chart on the dashboard, so that remaining Sprint Scope is tracked in the analytics view.
22. As a Project Owner, I want the Burndown chart title to be exactly "Burndown chart", so that chart naming is consistent with the product decision.
23. As a Project Owner, I want the Burndown chart to use event-backed history when available, so that scope and completion changes are reflected over time.
24. As a Project Owner, I want the Burnup chart title to be exactly "Burnup chart", so that completed and total Sprint Scope are easy to find.
25. As a Project Owner, I want burnup to track completed Story Points and Sprint Scope, so that progress and scope growth are visible together.
26. As a Project Owner, I want the Scope change chart title to be exactly "Scope change chart", so that Sprint Scope changes are explicit.
27. As a Project Owner, I want Scope change to track Sprint Scope instead of whole Project backlog size, so that the chart reflects committed Sprint planning changes.
28. As a Project Owner, I want Sprint Scope additions and removals to be visible, so that mid-Sprint churn can be discussed.
29. As a Project Owner, I want the Velocity chart title to be exactly "Velocity chart", so that recent delivery pace is easy to identify.
30. As a Project Owner, I want velocity to use closed Sprint Story Point completion, so that forecasting is based on delivered work.
31. As a Project Owner, I want velocity to include task-count context, so that a small number of high-point tasks is not confused with broad throughput.
32. As a Project Member, I want the Cumulative Flow Diagram title to be exactly "Cumulative Flow Diagram", so that workflow distribution is clear.
33. As a Project Member, I want the Cumulative Flow Diagram to use raw Workflow Columns, so that the chart reflects the Project's actual workflow.
34. As a Project Owner, I want arbitrary Project Workflow Columns preserved in the CFD, so that custom board design is not hidden behind normalized states.
35. As a Project Owner, I want Workflow Column renames and movement to remain understandable in analytics, so that CFD history is tied to the Project's configured columns.
36. As a Project Owner, I want the Cycle time chart title to be exactly "Cycle time chart", so that elapsed execution time is visible.
37. As a Project Owner, I want Project Task Cycle Time to start when a Project Task first enters workflow execution from backlog or creation, so that backlog wait is not counted as execution time.
38. As a Project Owner, I want Project Task Cycle Time to end when the Project Task becomes a Finished Task, so that completion is tied to the Done Column.
39. As a Project Member, I want cycle time to ignore Backlog Tasks that never entered workflow execution, so that unfinished planning inventory does not skew execution metrics.
40. As a Project Owner, I want the Throughput chart title to be exactly "Throughput chart", so that completed work volume is available alongside Story Point velocity.
41. As a Project Owner, I want throughput to show Finished Task counts by weekly bucket, so that delivery volume is visible even when Story Points are missing.
42. As a Project Owner, I want the Blocked work chart title to be exactly "Blocked work chart", so that blocked execution risk is prominent.
43. As a Project Member, I want Blocked Project Tasks to be explicit task-level markers, so that analytics do not confuse blocked work with Task Prerequisites.
44. As a Project Member, I want Project Status Blocked to remain separate from Blocked Project Task analytics, so that Project-level state does not distort task health.
45. As a Project Owner, I want Blocked work to show both blocked count and blocked age, so that both volume and duration of blocked work are visible.
46. As a Project Member, I want blocked reason handling to be captured in the product contract, so that marking a Project Task blocked is meaningful to other Project Members.
47. As a Project Owner, I want the Defect / rework chart title to be exactly "Defect / rework chart", so that rework is visible without calling it a bug-only metric.
48. As a Project Owner, I want a Reworked Task to mean a Finished Task leaving the Done Column, so that rework is computed from workflow behavior rather than labels.
49. As a Project Owner, I want rework counts over time, so that quality or acceptance churn is visible.
50. As a Project Owner, I want the Forecast cone title to be exactly "Forecast cone", so that projected delivery dates are separated from observed history.
51. As a Project Owner, I want the forecast cone to use last-six-Sprint Story Point velocity, so that the forecast reflects recent Project delivery pace.
52. As a Project Owner, I want best, likely, and worst forecast dates, so that uncertainty is visible instead of hidden behind one date.
53. As a Project Owner, I want forecasts to exclude unestimated Project Tasks from point calculations while showing unestimated count context, so that forecast confidence is honest.
54. As a Project Owner, I want the Work aging chart title to be exactly "Work aging chart", so that long-running active work is visible.
55. As a Project Member, I want work aging to show active non-done Sprint Tasks aged since cycle-time start, so that stale execution work can be found.
56. As a Project Member, I want Backlog Tasks excluded from work aging, so that the chart focuses on execution flow.
57. As a Project Member, I want Done Column configuration to define Finished Tasks, so that dashboard completion matches the board's workflow rules.
58. As a Project Owner, I want Project Task Change Events captured when Sprint Membership changes, so that Sprint Scope history is accurate.
59. As a Project Owner, I want Project Task Change Events captured when Story Points change, so that estimates and Sprint Scope lines remain explainable.
60. As a Project Owner, I want Project Task Change Events captured when a Project Task moves between Workflow Columns, so that CFD, cycle time, rework, throughput, and completion are derivable.
61. As a Project Owner, I want Project Task Change Events captured when a Project Task becomes or stops being blocked, so that blocked work charts are durable.
62. As a Project Owner, I want Project Task Change Events to be append-only, so that dashboard history is not rewritten by current Project Task state.
63. As a backend maintainer, I want Project Task Change Event payloads to store only the domain facts needed for analytics, so that the event table does not become a generic audit log.
64. As a backend maintainer, I want event recording inside existing Project Task mutation paths, so that analytics cannot drift from user actions.
65. As a backend maintainer, I want dashboard access checks to reuse Project participant access, so that Project Analytics History is protected like Project data.
66. As a Project Member, I want the dashboard API to return authorization errors consistently with other Project endpoints, so that inaccessible Projects remain private.
67. As a frontend maintainer, I want the dashboard route to use the existing Project layout pattern, so that navigation, breadcrumbs, and responsive spacing remain consistent.
68. As a frontend maintainer, I want dashboard charts rendered in a one-column mobile and two-column desktop grid, so that the view is usable on different screen sizes.
69. As a frontend maintainer, I want dense charts to span wide when needed, so that complex time-series charts remain readable.
70. As a Project Member, I want each chart card to show its title even when empty, so that I can scan the dashboard structure.
71. As a Project Member, I want each empty state to explain the missing prerequisite concisely, so that I know whether to wait for history, create a Sprint, estimate work, or configure a Done Column.
72. As a Project Owner, I want dashboard analytics to respect custom Workflow Columns, so that no Project is forced into Todo / In Progress / Review / Done naming.
73. As a Project Owner, I want historical charts to handle Projects with a missing Done Column designation, so that the dashboard can explain missing completion metrics rather than crash.
74. As a Project Owner, I want historical charts to handle Sprints with no estimated work, so that unestimated Project Tasks are reported as context.
75. As a Project Owner, I want historical charts to handle Projects with fewer than six closed Sprints, so that early Projects still get useful current-state analytics.
76. As a Project Member, I want dashboard loading, error, and retry states, so that transient failures do not leave a blank page.
77. As a Project Member, I want dashboard data to refresh after Project Task mutations, so that recent board actions are reflected in analytics.
78. As a Project Owner, I want Sprint close history to remain available, so that Project Dashboard does not replace Sprint History details.
79. As a Project Member, I want the Project board and Project Dashboard to share Project context, so that I do not lose orientation when navigating between them.
80. As a tester, I want the dashboard behavior covered at API, aggregation, route, and chart-card seams, so that regressions are caught where users observe them.

## Implementation Decisions

- Build a separate Project Dashboard route for each Project rather than extending the board search view.
- Move the burndown experience off the Project board and into the Project Dashboard.
- Add a Project sidebar item for the Project Dashboard.
- Preserve the Project board as the workflow execution surface and the Project Dashboard as the analytics surface.
- Use Project Analytics History as the source for dashboard trends.
- Record Project Analytics History as append-only Project Task Change Events.
- Do not backfill historical Project Task Change Events from current Project Task state or Sprint History snapshots.
- Start useful historical analytics from the ship date; earlier periods should use empty-state metadata.
- Add one aggregated dashboard API contract that returns chart-ready data and empty-state metadata for all dashboard cards.
- Compute dashboard analytics from events on read for this slice; caching or daily snapshots may be added later only as read optimizations.
- Keep Story Points as the primary work and scope unit.
- Include task counts as supporting context, especially for throughput and unestimated work.
- Exclude unestimated Project Tasks from Story Point lines and forecasts.
- Include unestimated Project Task counts in dashboard context and empty states.
- Use raw Workflow Columns for the Cumulative Flow Diagram instead of normalized Todo / In Progress / Review / Done categories.
- Use the configured Done Column as the boundary for Finished Tasks.
- Define Reworked Task events as a Finished Task leaving the Done Column.
- Define Project Task Cycle Time as first entry into workflow execution from backlog or creation through becoming a Finished Task.
- Define work aging as active, non-done Sprint Tasks aged since cycle-time start.
- Define Blocked Project Task as an explicit task-level blocked marker and optional or required reason to be finalized during implementation.
- Keep Blocked Project Task separate from Task Prerequisite and Project Status.
- Track blocked work with both blocked count and blocked age.
- Track Burnup and Scope change against Sprint Scope, not whole backlog or Project scope.
- Default trend charts to weekly buckets.
- Default the dashboard window to current state plus the last six Sprints.
- Use last-six-Sprint Story Point velocity for best, likely, and worst forecast dates.
- Render a responsive titled-card grid: one column on mobile and two columns on desktop, with dense charts allowed to span wide.
- Use the exact chart titles: "Burndown chart", "Burnup chart", "Scope change chart", "Velocity chart", "Cumulative Flow Diagram", "Cycle time chart", "Throughput chart", "Blocked work chart", "Defect / rework chart", "Forecast cone", and "Work aging chart".
- Render titled chart cards with concise empty-state messages when data is sparse; do not hide supported charts and do not draw fake data.
- Keep Sprint History and Closed Sprint detail behavior available outside the Project Dashboard.
- Treat any database schema changes as implementation detail for the event store; current repository instructions say API schema changes do not require a migration for now.

## Testing Decisions

- Test external behavior at the highest practical seams; avoid tests that lock implementation details such as private reducer steps or chart library internals.
- Backend API route tests should cover the aggregated Project Dashboard endpoint returning chart-ready data and empty-state metadata for a Project participant.
- Backend API route tests should cover outsider access being rejected consistently with existing Project endpoints.
- Backend service tests should cover Project Task Change Events being recorded by existing Project Task mutation paths: Sprint Membership changes, Story Point changes, Workflow Column movement, Done Column transitions, and blocked marker changes.
- Backend aggregation tests should cover burndown, burnup, Scope change, velocity, CFD, Project Task Cycle Time, throughput, Blocked Project Task, rework, forecast, and work aging calculations from Project Task Change Events.
- Backend aggregation tests should cover no-backfill behavior: Projects without events return empty-state metadata instead of inferred historical points.
- Backend aggregation tests should cover unestimated Project Tasks being excluded from Story Point lines while included as counts/context.
- Backend aggregation tests should cover arbitrary Workflow Columns in the CFD rather than hard-coded normalized states.
- Backend aggregation tests should cover Finished Task boundaries using the configured Done Column.
- Backend aggregation tests should cover Reworked Task detection when a Finished Task leaves the Done Column.
- Backend aggregation tests should cover Project Task Cycle Time start and end boundaries.
- Backend aggregation tests should cover active non-done Sprint Tasks in work aging and exclusion of Backlog Tasks.
- Backend aggregation tests should cover blocked count and blocked age using explicit Blocked Project Task state.
- Backend aggregation tests should cover forecast cone behavior with fewer than six closed Sprints and with no estimated velocity.
- Frontend route tests should cover navigating to the Project Dashboard route and rendering the dashboard page for the selected Project.
- Frontend layout tests should cover the Project sidebar dashboard item and the absence of the burndown card from the board.
- Frontend dashboard tests should cover all required chart titles rendering in titled cards.
- Frontend dashboard tests should cover empty-state messages rendering for sparse data instead of hidden charts.
- Frontend dashboard tests should cover loading, error, and retry states from the aggregated dashboard query.
- Frontend chart-helper tests should cover transforming the dashboard contract into chart-ready props where transformation remains client-side.
- Existing Project API route tests are prior art for authenticated Project participant access, Project membership fixtures, and endpoint response assertions.
- Existing Project Task movement service tests are prior art for mutation-path coverage around Workflow Column moves.
- Existing Project board tests are prior art for TanStack Router route mocking, React Query setup, board/sidebar behavior, and user-visible rendering assertions.
- Existing burndown chart tests are prior art for deterministic chart helper tests and smoke rendering.

## Out of Scope

- Backfilling historical Project Task Change Events from current Project Task state, Sprint History snapshots, or manual scripts.
- Building a daily snapshot scheduler.
- Adding cached dashboard read models unless needed after the event-derived implementation exists.
- Normalizing Workflow Columns into Todo / In Progress / Review / Done dashboard categories.
- Replacing Sprint History or Closed Sprint detail views.
- Changing Story Point scale or estimate validation.
- Capacity planning by Project Member or assignee.
- Cross-Project portfolio analytics.
- Exporting dashboard data to CSV, PDF, or external reporting tools.
- Custom dashboard card configuration, chart hiding, or user-specific layout persistence.
- Browser end-to-end tests for this slice unless implementation uncovers route behavior that unit/integration tests cannot cover.

## Further Notes

- This PRD supersedes the earlier stateless burndown placement decision for the Project board by moving dashboard analytics to a separate Project Dashboard.
- The analytics event ADR applies: Project Dashboard charts need history that current Project Task state and Sprint History cannot reconstruct.
- The current burndown component remains useful as visual prior art, but the dashboard needs event-backed data for true historical curves.
- The domain glossary terms Project Dashboard, Project Analytics History, Project Task Change Event, Project Task Cycle Time, Workflow Column, Sprint Scope, Blocked Project Task, and Reworked Task should be used throughout implementation.
- The testing seam decision is synthesized from current context rather than re-interviewed: use the aggregated API as the highest backend seam, Project Task mutation paths for event recording, the dashboard route/page as the highest frontend seam, and pure chart helpers only where chart transformation logic remains outside the backend contract.
