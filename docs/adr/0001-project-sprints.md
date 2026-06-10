# Project-scoped sprints

Sprints are scoped to one Project, and each Project has at most one Active Sprint that is current by explicit lifecycle state rather than by date. A Sprint starts when created, closed Sprints are immutable history, and Sprint History preserves close-time task membership and outcomes so later task edits, carryover, or deletion do not rewrite the past.

We chose this over global/date-derived sprints and live task history because the existing project board and access model are project-scoped, teams often extend or close sprints outside their planned dates, and sprint review needs a stable historical record. Backlog is modeled as an ordered list of unfinished non-sprint work, separate from board column rank, because sprint planning needs a single manual priority order rather than a board-derived ordering.
