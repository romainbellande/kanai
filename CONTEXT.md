# Kanai Context

Kanai manages project work through project-scoped planning and execution concepts.

## Language

**Project**:
A bounded work area that owns its planning, task board, members, and sprint history.
_Avoid_: Workspace, team

**Project Owner**:
A Project participant responsible for project-level planning and configuration.
_Avoid_: Admin, manager

**Project Status**:
A descriptive Project lifecycle label with one of four values: Active, Paused, Blocked, or Done.
_Avoid_: Project phase, project health

**Project Dashboard**:
A Project analytics view that summarizes planning flow, delivery pace, and work health separately from the workflow board.
_Avoid_: Project board, sprint history, reporting tab

**Project Analytics History**:
The time-based record of Project Task scope, workflow state, and completion changes used to explain delivery trends.
_Avoid_: Reporting cache, chart data, metrics table

**Project Task Change Event**:
A recorded Project Task lifecycle change that can be used to reconstruct Project Analytics History.
_Avoid_: Daily snapshot, audit log, chart point

**Project Task Cycle Time**:
The elapsed time from a Project Task first entering workflow execution until it becomes a Finished Task.
_Avoid_: Lead time, task age, backlog wait

**Project Member**:
A Project participant who can work with project tasks and Sprint Membership.
_Avoid_: Contributor, teammate

**Project Task**:
A Kanai work item owned by a Project and managed through planning and workflow views.
_Avoid_: A2A Task, agent task

**Project Task Assignee**:
The single Project participant, either a Project Owner or Project Member, responsible for a Project Task.
_Avoid_: Task owner, responsible user, teammate

**Project Task Title**:
A concise, user-editable name that identifies the work represented by a Project Task.
_Avoid_: Task name, issue title

**Project Task Description**:
Task-owned, user-editable narrative context that explains the background, scope, or handoff information for a Project Task.
_Avoid_: Task notes, work notes, task body

**Task Prerequisite**:
A Project Task that must be considered before another Project Task can proceed.
_Avoid_: Depends-on task, blocker, task dependency

**Blocked Project Task**:
A Project Task explicitly marked as unable to proceed, separate from Project Status and Task Prerequisites.
_Avoid_: Blocker, blocked project, unmet prerequisite

**Task Shaping Chat**:
An agent-assisted conversation that interviews a Project Member to refine a Project Task before it is saved.
_Avoid_: Grill Me, Task Coach, Project chat

**Task Shaping Interview Question**:
The current focused question asked by Task Shaping Chat to gather the next useful detail about a Project Task.
_Avoid_: Assistant message, prompt, chat text

**Task Shaping Answer Option**:
A selectable response offered by Task Shaping Chat for the current interview question, including a custom response option for the Project Member's own answer.
_Avoid_: Suggestion, recommendation, quick reply

**Task Shaping Transcript**:
The visible history of Task Shaping Chat questions, assistant framing, and Project Member answers during a form-local shaping session.
_Avoid_: A2A history, chat log, persisted conversation

**A2A Task**:
A protocol-level agent execution state used for A2A streaming and interoperability.
_Avoid_: Project Task, backlog task, sprint task

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

**Sprint Scope**:
The Story Point total and Project Task count selected into Sprints for Project Dashboard scope tracking.
_Avoid_: Project scope, backlog scope, release scope

**Backlog Task**:
A Task that is unfinished and not selected for the Current Sprint.
_Avoid_: Unplanned task, unsprinted task

**Backlog**:
The non-editable planning list of Backlog Tasks for a Project, separate from the Project's workflow columns.
_Avoid_: Icebox, unscheduled work, workflow column, backlog column

**Backlog Order**:
The manual priority order of Backlog Tasks in a Project.
_Avoid_: Queue order, backlog rank

**Workflow Column**:
A Project-owned board lane that groups Project Tasks by their current workflow position.
_Avoid_: Dashboard state, task status, sprint state

**Story Points**:
An optional Task sizing value for planning work, using the point scale 1, 2, 3, 5, 8, or 13.
_Avoid_: Task points, effort points

**Acceptance Criteria**:
Task-owned, user-editable conditions used to judge whether a Task is ready to become a Finished Task.
_Avoid_: Completion checklist, Definition of Done, workflow rule

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

**Reworked Task**:
A Project Task that was a Finished Task and later moved out of the Done Column.
_Avoid_: Defect, bug, review bounce
