# Kanai Context

Kanai manages project work through project-scoped planning and execution concepts.

## Language

**Project**:
A bounded work area that owns its planning, task board, members, and sprint history.
_Avoid_: Workspace, team

**Project Owner**:
A Project participant responsible for project-level planning and configuration.
_Avoid_: Admin, manager

**Project Member**:
A Project participant who can work with project tasks and Sprint Membership.
_Avoid_: Contributor, teammate

**Sprint**:
A time-boxed planning period within one Project, with planned start and end dates.
_Avoid_: Iteration, cycle

**Sprint Name**:
A stable Project-unique Sprint label following the incremental "Sprint N" convention.
_Avoid_: Sprint title, sprint code

**Sprint Timebox**:
The inclusive calendar-date range for a Sprint, which defaults to two weeks and does not overlap another Sprint Timebox in the same Project.
_Avoid_: Sprint window, sprint schedule

**Sprint Goal**:
An optional statement of the planning intent for a Sprint.
_Avoid_: Sprint description, objective

**Sprint Planning**:
The selection of Backlog Tasks into a Sprint.
_Avoid_: Sprint setup, sprint filling

**Current Sprint**:
The Sprint currently active for a Project.
_Avoid_: Latest sprint, date-matched sprint

**Active Sprint**:
A Sprint that is in progress for its Project.
_Avoid_: Open sprint, running sprint

**Sprint Task**:
A Task selected for a Sprint.
_Avoid_: Sprint item, committed issue

**Backlog Task**:
A Task that is unfinished and not selected for the Current Sprint.
_Avoid_: Unplanned task, unsprinted task

**Backlog**:
The list of Backlog Tasks for a Project.
_Avoid_: Icebox, unscheduled work

**Backlog Order**:
The manual priority order of Backlog Tasks in a Project.
_Avoid_: Queue order, backlog rank

**Sprint Board**:
A Project task board view limited to Sprint Tasks.
_Avoid_: Sprint page, iteration board

**Sprint Membership**:
The relationship that makes a Task part of a Sprint.
_Avoid_: Sprint assignment, sprint link

**Closed Sprint**:
A final, immutable Sprint that is no longer active but remains available as sprint history.
_Avoid_: Archived sprint, completed sprint

**Sprint Close Time**:
The moment a Sprint is closed and its history is finalized.
_Avoid_: End date, completion time

**Sprint History**:
The record of which Tasks belonged to a closed Sprint and their outcome at close time.
_Avoid_: Sprint archive, sprint snapshot

**Historical Sprint Task**:
A Sprint History entry for a Task as it was known at close time.
_Avoid_: Archived task, task snapshot

**Carryover Task**:
A Task that belonged to a closed Sprint and later belongs to another Sprint.
_Avoid_: Rolled-over task, continued task

**Done Column**:
The single workflow column in a Project that marks Tasks as finished.
_Avoid_: Final column, completed lane

**Finished Task**:
A Task in the Done Column.
_Avoid_: Completed task, closed task
