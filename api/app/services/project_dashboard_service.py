"""Project Dashboard read aggregation service."""

from collections.abc import Iterable
from datetime import UTC, datetime, timedelta
from typing import cast
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import (
    ProjectSprint,
    ProjectTaskChangeEvent,
    SprintLifecycleState,
)
from app.repositories.project_task_change_event_repository import (
    ProjectTaskChangeEventRepository,
)
from app.repositories.project_repository import ProjectRepository
from app.schemas.project import (
    ProjectDashboardCardEmptyStateRead,
    ProjectDashboardCardEntryRead,
    ProjectDashboardCardRead,
    ProjectDashboardRead,
    ProjectDashboardSeriesRead,
)
from app.services.project_access import ProjectAccess

COMPLETION_EVENT_TYPE = "sprint_task_finished"

PROJECT_DASHBOARD_CHART_TITLES = (
    "Burndown chart",
    "Burnup chart",
    "Scope change chart",
    "Velocity chart",
    "Cumulative Flow Diagram",
    "Cycle time chart",
    "Throughput chart",
    "Blocked work chart",
    "Defect / rework chart",
    "Forecast cone",
    "Work aging chart",
)

_EMPTY_MESSAGES = {
    "Burndown chart": "Waiting for Sprint Scope and completion events.",
    "Burnup chart": "Waiting for Sprint Scope events. Completed Story Points stay at zero until completion events are available.",
    "Scope change chart": "Waiting for Sprint membership change events.",
    "Velocity chart": "Close Sprints with estimated finished work to build velocity.",
    "Cumulative Flow Diagram": "Move Project Tasks through Workflow Columns to build flow history.",
    "Cycle time chart": "Move Sprint Tasks into execution and then Done to build cycle time.",
    "Throughput chart": "Finish Sprint Tasks to build throughput history.",
    "Blocked work chart": "Mark Project Tasks blocked to build blocked-work history.",
    "Defect / rework chart": "Move finished tasks out of Done to build rework history.",
    "Forecast cone": "Close Sprints with estimated work to build forecast velocity.",
    "Work aging chart": "Move Sprint Tasks into execution to build work-aging history.",
}


class ProjectDashboardService:
    """Build the aggregated dashboard payload visible to project participants."""

    def __init__(self, session: AsyncSession) -> None:
        self._access = ProjectAccess(session)
        self._events = ProjectTaskChangeEventRepository(session)
        self._projects = ProjectRepository(session)

    async def get(self, project_id: UUID, user_id: UUID) -> ProjectDashboardRead:
        """Return chart-ready dashboard cards without inferring missing history."""
        project = await self._access.require_project(project_id, user_id)
        events = await self._events.list_by_project(project_id)
        sprints = await self._projects.list_sprints_by_project(project_id)
        sprint_window_ids = _scope_window_sprint_ids(sprints)
        active_sprint_ids = _active_sprint_ids(sprints)
        generated_at = datetime.now(UTC)
        analytics_charts = _analytics_charts(
            events,
            project.done_column_id,
            generated_at,
            sprint_window_ids,
            active_sprint_ids,
        )
        return ProjectDashboardRead(
            project_id=project_id,
            generated_at=generated_at,
            charts=[
                analytics_charts.get(title)
                or _empty_chart(
                    title,
                    "analytics_not_implemented"
                    if events
                    else "no_project_task_change_events",
                )
                for title in PROJECT_DASHBOARD_CHART_TITLES
            ],
        )


def _analytics_charts(
    events: list[ProjectTaskChangeEvent],
    done_column_id: UUID | None,
    generated_at: datetime,
    sprint_window_ids: set[UUID],
    active_sprint_ids: set[UUID],
) -> dict[str, ProjectDashboardCardRead]:
    return (
        _scope_analytics_charts(events, done_column_id, sprint_window_ids)
        | _cumulative_flow_chart(events)
        | _cycle_time_and_work_aging_charts(
            events, done_column_id, generated_at, active_sprint_ids
        )
        | _rework_chart(events, done_column_id)
        | _blocked_work_chart(events, generated_at)
        | _delivery_analytics_charts(events, generated_at)
    )


def _scope_analytics_charts(
    events: list[ProjectTaskChangeEvent],
    done_column_id: UUID | None,
    sprint_window_ids: set[UUID],
) -> dict[str, ProjectDashboardCardRead]:
    if not events:
        return {}

    tracked_events = [
        event
        for event in events
        if event.task_id is not None
        and event.event_type
        in {
            "sprint_scope_added",
            "sprint_scope_removed",
            "story_points_changed",
            "workflow_column_changed",
        }
    ]
    recent_sprint_ids = sprint_window_ids or _recent_scope_sprint_ids(tracked_events)
    task_points: dict[UUID, int | None] = {}
    task_sprints: dict[UUID, UUID] = {}
    completed_task_ids: set[UUID] = set()
    sprint_scope = 0
    unestimated_tasks = 0
    buckets: dict[datetime, dict[str, int]] = {}

    for event in tracked_events:
        if not _is_recent_scope_event(event, recent_sprint_ids):
            continue
        assert event.task_id is not None
        bucket = buckets.setdefault(
            _week_start(event.occurred_at),
            {
                "sprint_scope": sprint_scope,
                "scope_delta": 0,
                "added_story_points": 0,
                "removed_story_points": 0,
                "tasks_added": 0,
                "tasks_removed": 0,
                "unestimated_tasks": unestimated_tasks,
                "unestimated_tasks_added": 0,
                "unestimated_tasks_removed": 0,
                "remaining_story_points": 0,
                "completed_story_points": 0,
                "completion_events_available": 0,
            },
        )
        previous_points = task_points.get(event.task_id)
        if event.event_type == "sprint_scope_added" and event.new_sprint_id is not None:
            task_sprints[event.task_id] = event.new_sprint_id
            task_points[event.task_id] = event.new_story_points
            bucket["tasks_added"] += 1
            if event.new_story_points is None:
                unestimated_tasks += 1
                bucket["unestimated_tasks_added"] += 1
            else:
                sprint_scope += event.new_story_points
                bucket["scope_delta"] += event.new_story_points
                bucket["added_story_points"] += event.new_story_points
        elif event.event_type == "sprint_scope_removed":
            task_sprints.pop(event.task_id, None)
            completed_task_ids.discard(event.task_id)
            points = previous_points
            if points is None:
                points = event.previous_story_points
            bucket["tasks_removed"] += 1
            if points is None:
                unestimated_tasks = max(0, unestimated_tasks - 1)
                bucket["unestimated_tasks_removed"] += 1
            else:
                sprint_scope = max(0, sprint_scope - points)
                bucket["scope_delta"] -= points
                bucket["removed_story_points"] += points
            task_points.pop(event.task_id, None)
        elif (
            event.event_type == "story_points_changed" and event.task_id in task_sprints
        ):
            previous = previous_points
            if previous is None:
                previous = event.previous_story_points
            new = event.new_story_points
            if previous is None and new is not None:
                unestimated_tasks = max(0, unestimated_tasks - 1)
                sprint_scope += new
                bucket["scope_delta"] += new
                bucket["added_story_points"] += new
            elif previous is not None and new is None:
                unestimated_tasks += 1
                sprint_scope = max(0, sprint_scope - previous)
                bucket["scope_delta"] -= previous
                bucket["removed_story_points"] += previous
            elif previous is not None and new is not None:
                delta = new - previous
                sprint_scope = max(0, sprint_scope + delta)
                bucket["scope_delta"] += delta
                if delta > 0:
                    bucket["added_story_points"] += delta
                elif delta < 0:
                    bucket["removed_story_points"] += abs(delta)
            task_points[event.task_id] = new
        elif (
            event.event_type == "workflow_column_changed"
            and done_column_id is not None
            and event.task_id in task_sprints
        ):
            if event.new_column_id == done_column_id:
                completed_task_ids.add(event.task_id)
                bucket["completion_events_available"] = 1
            elif (
                event.previous_column_id == done_column_id
                and event.new_column_id != done_column_id
            ):
                completed_task_ids.discard(event.task_id)
                bucket["completion_events_available"] = 1

        bucket["sprint_scope"] = sprint_scope
        bucket["unestimated_tasks"] = unestimated_tasks
        remaining_story_points, completed_story_points = _scope_completion_totals(
            task_points,
            task_sprints.keys(),
            completed_task_ids,
        )
        bucket["remaining_story_points"] = remaining_story_points
        bucket["completed_story_points"] = completed_story_points

    scope_entries = [
        ProjectDashboardCardEntryRead(
            label=week_start.date().isoformat(),
            values={
                "sprint_scope": values["sprint_scope"],
                "scope_delta": values["scope_delta"],
                "added_story_points": values["added_story_points"],
                "removed_story_points": values["removed_story_points"],
                "tasks_added": values["tasks_added"],
                "tasks_removed": values["tasks_removed"],
                "unestimated_tasks": values["unestimated_tasks"],
                "unestimated_tasks_added": values["unestimated_tasks_added"],
                "unestimated_tasks_removed": values["unestimated_tasks_removed"],
            },
        )
        for week_start, values in sorted(buckets.items())
        if any(
            values[key]
            for key in (
                "scope_delta",
                "tasks_added",
                "tasks_removed",
                "unestimated_tasks_added",
                "unestimated_tasks_removed",
            )
        )
    ]
    burn_entries = [
        ProjectDashboardCardEntryRead(
            label=week_start.date().isoformat(),
            values=cast(dict[str, int | float | str | None], values),
        )
        for week_start, values in sorted(buckets.items())
        if any(
            values[key]
            for key in (
                "scope_delta",
                "tasks_added",
                "tasks_removed",
                "unestimated_tasks_added",
                "unestimated_tasks_removed",
                "completion_events_available",
            )
        )
    ]
    charts: dict[str, ProjectDashboardCardRead] = {}
    if done_column_id is None:
        charts["Burndown chart"] = _empty_chart("Burndown chart", "no_done_column")
        charts["Burnup chart"] = _empty_chart("Burnup chart", "no_done_column")
    elif not burn_entries:
        charts["Burndown chart"] = _empty_chart(
            "Burndown chart",
            "no_sprint_scope_events",
        )
        charts["Burnup chart"] = _empty_chart("Burnup chart", "no_sprint_scope_events")
    else:
        burndown_entries = [
            ProjectDashboardCardEntryRead(
                label=entry.label,
                values={
                    "remaining_story_points": entry.values["remaining_story_points"],
                    "unestimated_tasks": entry.values["unestimated_tasks"],
                },
            )
            for entry in burn_entries
        ]
        burnup_scope_entries = [
            ProjectDashboardCardEntryRead(
                label=entry.label,
                values={
                    "sprint_scope": entry.values["sprint_scope"],
                    "unestimated_tasks": entry.values["unestimated_tasks"],
                },
            )
            for entry in burn_entries
        ]
        burnup_completed_entries = [
            ProjectDashboardCardEntryRead(
                label=entry.label,
                values={
                    "completed_story_points": entry.values["completed_story_points"],
                    "completion_events_available": entry.values[
                        "completion_events_available"
                    ],
                },
            )
            for entry in burn_entries
        ]
        charts["Burndown chart"] = ProjectDashboardCardRead(
            key=_chart_key("Burndown chart"),
            title="Burndown chart",
            series=[
                ProjectDashboardSeriesRead(
                    name="Remaining Sprint Scope",
                    entries=burndown_entries,
                )
            ],
            entries=burndown_entries,
            empty_state=None,
        )
        charts["Burnup chart"] = ProjectDashboardCardRead(
            key=_chart_key("Burnup chart"),
            title="Burnup chart",
            series=[
                ProjectDashboardSeriesRead(
                    name="Completed Story Points",
                    entries=burnup_completed_entries,
                ),
                ProjectDashboardSeriesRead(
                    name="Sprint Scope",
                    entries=burnup_scope_entries,
                ),
            ],
            entries=burnup_scope_entries,
            empty_state=None,
        )

    if not scope_entries:
        charts["Scope change chart"] = _empty_chart(
            "Scope change chart",
            "no_sprint_scope_events",
        )
        return charts

    charts["Scope change chart"] = ProjectDashboardCardRead(
        key=_chart_key("Scope change chart"),
        title="Scope change chart",
        series=[
            ProjectDashboardSeriesRead(
                name="Added Story Points",
                entries=[
                    ProjectDashboardCardEntryRead(
                        label=entry.label,
                        values={
                            "added_story_points": entry.values["added_story_points"],
                            "tasks_added": entry.values["tasks_added"],
                            "unestimated_tasks_added": entry.values[
                                "unestimated_tasks_added"
                            ],
                        },
                    )
                    for entry in scope_entries
                ],
            ),
            ProjectDashboardSeriesRead(
                name="Removed Story Points",
                entries=[
                    ProjectDashboardCardEntryRead(
                        label=entry.label,
                        values={
                            "removed_story_points": entry.values[
                                "removed_story_points"
                            ],
                            "tasks_removed": entry.values["tasks_removed"],
                            "unestimated_tasks_removed": entry.values[
                                "unestimated_tasks_removed"
                            ],
                        },
                    )
                    for entry in scope_entries
                ],
            ),
        ],
        entries=scope_entries,
        empty_state=None,
    )
    return charts


def _scope_completion_totals(
    task_points: dict[UUID, int | None],
    sprint_task_ids: Iterable[UUID],
    completed_task_ids: set[UUID],
) -> tuple[int, int]:
    remaining_story_points = 0
    completed_story_points = 0
    for task_id in sprint_task_ids:
        points = task_points.get(task_id)
        if points is None:
            continue
        if task_id in completed_task_ids:
            completed_story_points += points
        else:
            remaining_story_points += points
    return remaining_story_points, completed_story_points


def _delivery_analytics_charts(
    events: list[ProjectTaskChangeEvent],
    generated_at: datetime,
) -> dict[str, ProjectDashboardCardRead]:
    completion_events = [
        event
        for event in events
        if event.event_type == COMPLETION_EVENT_TYPE
        and event.task_id is not None
        and event.sprint_id is not None
        and event.occurred_at is not None
    ]
    if not completion_events:
        if not events:
            return {}
        return {
            "Velocity chart": _empty_chart(
                "Velocity chart",
                "no_sprint_completion_events",
            ),
            "Throughput chart": _empty_chart(
                "Throughput chart",
                "no_finished_task_events",
            ),
            "Forecast cone": _empty_chart(
                "Forecast cone",
                "no_sprint_completion_events",
            ),
        }

    sprint_entries = _closed_sprint_velocity_entries(completion_events)
    throughput_entries = _weekly_throughput_entries(completion_events)
    forecast_chart = _forecast_cone_chart(events, sprint_entries, generated_at)

    charts = {
        "Throughput chart": ProjectDashboardCardRead(
            key=_chart_key("Throughput chart"),
            title="Throughput chart",
            series=[
                ProjectDashboardSeriesRead(
                    name="Finished Tasks",
                    entries=throughput_entries,
                )
            ],
            entries=throughput_entries,
            empty_state=None,
        ),
        "Forecast cone": forecast_chart,
    }
    if any(entry.values["completed_story_points"] for entry in sprint_entries):
        charts["Velocity chart"] = ProjectDashboardCardRead(
            key=_chart_key("Velocity chart"),
            title="Velocity chart",
            series=[
                ProjectDashboardSeriesRead(
                    name="Completed Story Points",
                    entries=sprint_entries,
                )
            ],
            entries=sprint_entries,
            empty_state=None,
        )
    else:
        charts["Velocity chart"] = _empty_chart(
            "Velocity chart",
            "no_estimated_velocity",
        )
    return charts


def _closed_sprint_velocity_entries(
    completion_events: list[ProjectTaskChangeEvent],
) -> list[ProjectDashboardCardEntryRead]:
    sprint_stats: dict[UUID, dict[str, object]] = {}
    for event in completion_events:
        if event.sprint_id is None or event.occurred_at is None:
            continue
        stats = sprint_stats.setdefault(
            event.sprint_id,
            {
                "closed_at": event.occurred_at,
                "completed_story_points": 0,
                "finished_task_count": 0,
                "unestimated_finished_tasks": 0,
            },
        )
        if _as_utc(event.occurred_at) > _as_utc(_stat_datetime(stats["closed_at"])):
            stats["closed_at"] = event.occurred_at
        stats["finished_task_count"] = cast(int, stats["finished_task_count"]) + 1
        if event.new_story_points is None:
            stats["unestimated_finished_tasks"] = (
                cast(int, stats["unestimated_finished_tasks"]) + 1
            )
        else:
            stats["completed_story_points"] = (
                cast(int, stats["completed_story_points"]) + event.new_story_points
            )

    recent_stats = sorted(
        sprint_stats.values(),
        key=lambda stats: _as_utc(_stat_datetime(stats["closed_at"])),
    )[-6:]
    return [
        ProjectDashboardCardEntryRead(
            label=_stat_datetime(stats["closed_at"]).date().isoformat(),
            values={
                "completed_story_points": cast(int, stats["completed_story_points"]),
                "finished_task_count": cast(int, stats["finished_task_count"]),
                "unestimated_finished_tasks": cast(
                    int,
                    stats["unestimated_finished_tasks"],
                ),
            },
        )
        for stats in recent_stats
    ]


def _weekly_throughput_entries(
    completion_events: list[ProjectTaskChangeEvent],
) -> list[ProjectDashboardCardEntryRead]:
    buckets: dict[datetime, int] = {}
    for event in completion_events:
        if event.occurred_at is None:
            continue
        occurred_at = _as_utc(event.occurred_at)
        week_start = datetime.combine(
            occurred_at.date() - timedelta(days=occurred_at.weekday()),
            datetime.min.time(),
            tzinfo=UTC,
        )
        buckets[week_start] = buckets.get(week_start, 0) + 1
    return [
        ProjectDashboardCardEntryRead(
            label=week_start.date().isoformat(),
            values={"finished_task_count": finished_task_count},
        )
        for week_start, finished_task_count in sorted(buckets.items())
    ]


def _forecast_cone_chart(
    events: list[ProjectTaskChangeEvent],
    sprint_entries: list[ProjectDashboardCardEntryRead],
    generated_at: datetime,
) -> ProjectDashboardCardRead:
    velocities = [
        completed_story_points
        for entry in sprint_entries
        if (completed_story_points := cast(int, entry.values["completed_story_points"]))
        > 0
    ]
    if not velocities:
        return _empty_chart("Forecast cone", "no_estimated_velocity")

    remaining_story_points, unestimated_tasks = _remaining_forecast_scope(events)
    best_velocity = max(velocities)
    likely_velocity = sum(velocities) / len(velocities)
    worst_velocity = min(velocities)
    forecast_entry = ProjectDashboardCardEntryRead(
        label="Current forecast",
        values={
            "best_forecast_date": _forecast_date(
                generated_at,
                remaining_story_points,
                best_velocity,
            ),
            "likely_forecast_date": _forecast_date(
                generated_at,
                remaining_story_points,
                likely_velocity,
            ),
            "worst_forecast_date": _forecast_date(
                generated_at,
                remaining_story_points,
                worst_velocity,
            ),
            "estimated_remaining_story_points": remaining_story_points,
            "unestimated_tasks": unestimated_tasks,
            "sprints_used": len(velocities),
            "best_velocity_story_points": best_velocity,
            "likely_velocity_story_points": likely_velocity,
            "worst_velocity_story_points": worst_velocity,
        },
    )
    return ProjectDashboardCardRead(
        key=_chart_key("Forecast cone"),
        title="Forecast cone",
        series=[
            ProjectDashboardSeriesRead(
                name="Forecast dates",
                entries=[forecast_entry],
            )
        ],
        entries=[forecast_entry],
        empty_state=None,
    )


def _remaining_forecast_scope(
    events: list[ProjectTaskChangeEvent],
) -> tuple[int, int]:
    task_points: dict[UUID, int | None] = {}
    sprint_task_ids: set[UUID] = set()
    completed_task_ids: set[UUID] = set()
    for event in events:
        if event.task_id is None:
            continue
        if event.event_type == "sprint_scope_added" and event.new_sprint_id is not None:
            sprint_task_ids.add(event.task_id)
            task_points[event.task_id] = event.new_story_points
        elif event.event_type == "sprint_scope_removed":
            sprint_task_ids.discard(event.task_id)
            task_points.pop(event.task_id, None)
            completed_task_ids.discard(event.task_id)
        elif (
            event.event_type == "story_points_changed"
            and event.task_id in sprint_task_ids
        ):
            task_points[event.task_id] = event.new_story_points
        elif event.event_type == COMPLETION_EVENT_TYPE:
            completed_task_ids.add(event.task_id)

    remaining_task_ids = sprint_task_ids - completed_task_ids
    remaining_story_points = 0
    for task_id in remaining_task_ids:
        story_points = task_points.get(task_id)
        if story_points is not None:
            remaining_story_points += story_points
    unestimated_tasks = sum(
        1 for task_id in remaining_task_ids if task_points.get(task_id) is None
    )
    return remaining_story_points, unestimated_tasks


def _forecast_date(
    generated_at: datetime,
    remaining_story_points: int,
    velocity: float,
) -> str:
    if remaining_story_points <= 0:
        return generated_at.date().isoformat()
    sprint_count = int(-(-remaining_story_points // velocity))
    return (generated_at.date() + timedelta(days=sprint_count * 7)).isoformat()


def _stat_datetime(value: object) -> datetime:
    if isinstance(value, datetime):
        return value
    raise TypeError("Expected datetime value")


def _cycle_time_and_work_aging_charts(
    events: list[ProjectTaskChangeEvent],
    done_column_id: UUID | None,
    generated_at: datetime,
    active_sprint_ids: set[UUID],
) -> dict[str, ProjectDashboardCardRead]:
    if done_column_id is None:
        if not events:
            return {}
        return {
            "Cycle time chart": _empty_chart(
                "Cycle time chart",
                "missing_done_column_configuration",
            ),
            "Work aging chart": _empty_chart(
                "Work aging chart",
                "missing_done_column_configuration",
            ),
        }

    cycle_started_at: dict[UUID, datetime] = {}
    sprint_task_ids: set[UUID] = set()
    done_task_ids: set[UUID] = set()
    completed_task_ids: set[UUID] = set()
    cycle_entries: list[ProjectDashboardCardEntryRead] = []
    cycle_time_seconds: list[int] = []

    for event in events:
        if event.task_id is None or event.occurred_at is None:
            continue

        occurred_at = _as_utc(event.occurred_at)
        if event.event_type == "sprint_scope_added":
            if event.new_sprint_id in active_sprint_ids:
                sprint_task_ids.add(event.task_id)
            else:
                sprint_task_ids.discard(event.task_id)
        elif event.event_type == "sprint_scope_removed":
            sprint_task_ids.discard(event.task_id)

        if event.event_type != "workflow_column_changed" or event.new_column_id is None:
            continue

        cycle_started_at.setdefault(event.task_id, occurred_at)
        if event.new_column_id == done_column_id:
            done_task_ids.add(event.task_id)
            if event.task_id not in completed_task_ids:
                completed_task_ids.add(event.task_id)
                duration_seconds = max(
                    0,
                    int(
                        (
                            occurred_at - _as_utc(cycle_started_at[event.task_id])
                        ).total_seconds()
                    ),
                )
                cycle_time_seconds.append(duration_seconds)
                average_seconds = sum(cycle_time_seconds) // len(cycle_time_seconds)
                cycle_entries.append(
                    ProjectDashboardCardEntryRead(
                        label=_event_label(event),
                        values={
                            "task_id": str(event.task_id),
                            "cycle_time_seconds": duration_seconds,
                            "cycle_time_days": duration_seconds // 86400,
                            "completed_task_count": len(cycle_time_seconds),
                            "average_cycle_time_seconds": average_seconds,
                            "average_cycle_time_days": average_seconds // 86400,
                        },
                    )
                )
        elif event.previous_column_id == done_column_id:
            done_task_ids.discard(event.task_id)

    charts: dict[str, ProjectDashboardCardRead] = {}
    if cycle_entries:
        charts["Cycle time chart"] = ProjectDashboardCardRead(
            key=_chart_key("Cycle time chart"),
            title="Cycle time chart",
            series=[
                ProjectDashboardSeriesRead(
                    name="Project Task Cycle Time",
                    entries=cycle_entries,
                )
            ],
            entries=cycle_entries,
            empty_state=None,
        )
    elif events:
        charts["Cycle time chart"] = _empty_chart(
            "Cycle time chart",
            "no_finished_workflow_tasks",
        )

    active_work_aging_entries = _active_work_aging_entries(
        cycle_started_at,
        sprint_task_ids - done_task_ids,
        generated_at,
    )
    if active_work_aging_entries:
        charts["Work aging chart"] = ProjectDashboardCardRead(
            key=_chart_key("Work aging chart"),
            title="Work aging chart",
            series=[
                ProjectDashboardSeriesRead(
                    name="Active Sprint Task Age",
                    entries=active_work_aging_entries,
                )
            ],
            entries=active_work_aging_entries,
            empty_state=None,
        )
    elif events:
        charts["Work aging chart"] = _empty_chart(
            "Work aging chart",
            "no_active_workflow_sprint_tasks",
        )

    return charts


def _active_work_aging_entries(
    cycle_started_at: dict[UUID, datetime],
    active_task_ids: set[UUID],
    generated_at: datetime,
) -> list[ProjectDashboardCardEntryRead]:
    generated_at_utc = _as_utc(generated_at)
    entries: list[ProjectDashboardCardEntryRead] = []
    for task_id, started_at in sorted(
        cycle_started_at.items(),
        key=lambda item: (_as_utc(item[1]), str(item[0])),
    ):
        if task_id not in active_task_ids:
            continue
        work_age_seconds = max(
            0,
            int((generated_at_utc - _as_utc(started_at)).total_seconds()),
        )
        entries.append(
            ProjectDashboardCardEntryRead(
                label=str(task_id),
                values={
                    "task_id": str(task_id),
                    "started_at": started_at.isoformat(),
                    "work_age_seconds": work_age_seconds,
                    "work_age_days": work_age_seconds // 86400,
                },
            )
        )
    return entries


def _cumulative_flow_chart(
    events: list[ProjectTaskChangeEvent],
) -> dict[str, ProjectDashboardCardRead]:
    flow_events = [
        event
        for event in events
        if event.event_type == "workflow_column_changed"
        and event.task_id is not None
        and event.new_column_id is not None
        and event.new_column_name is not None
    ]
    if not flow_events:
        return {}

    columns: dict[UUID, dict[str, int | str]] = {}
    first_seen: dict[UUID, int] = {}
    task_columns: dict[UUID, UUID] = {}
    counts: dict[UUID, int] = {}
    chart_entries: list[ProjectDashboardCardEntryRead] = []
    series_entries: dict[UUID, list[ProjectDashboardCardEntryRead]] = {}

    for index, event in enumerate(flow_events):
        assert event.new_column_id is not None
        _remember_column(
            columns,
            first_seen,
            index,
            event.previous_column_id,
            event.previous_column_name,
            event.previous_column_position,
        )
        _remember_column(
            columns,
            first_seen,
            index,
            event.new_column_id,
            event.new_column_name,
            event.new_column_position,
        )

        tracked_column_id = task_columns.get(event.task_id)
        if tracked_column_id is None:
            tracked_column_id = event.previous_column_id
            if tracked_column_id is not None:
                counts[tracked_column_id] = counts.get(tracked_column_id, 0) + 1
        if tracked_column_id is not None:
            counts[tracked_column_id] = max(0, counts.get(tracked_column_id, 0) - 1)
        counts[event.new_column_id] = counts.get(event.new_column_id, 0) + 1
        task_columns[event.task_id] = event.new_column_id

        ordered_column_ids = _ordered_column_ids(columns, first_seen)
        label = _event_label(event)
        values: dict[str, int | float | str | None] = {
            str(columns[column_id]["name"]): counts.get(column_id, 0)
            for column_id in ordered_column_ids
        }
        values.update(
            {
                "from_column_id": str(event.previous_column_id)
                if event.previous_column_id is not None
                else None,
                "from_column_name": event.previous_column_name,
                "from_column_position": event.previous_column_position,
                "to_column_id": str(event.new_column_id),
                "to_column_name": event.new_column_name,
                "to_column_position": event.new_column_position,
            }
        )
        chart_entries.append(ProjectDashboardCardEntryRead(label=label, values=values))
        for column_id in ordered_column_ids:
            column = columns[column_id]
            series_entries.setdefault(column_id, []).append(
                ProjectDashboardCardEntryRead(
                    label=label,
                    values={
                        "workflow_column_id": str(column_id),
                        "workflow_column_name": str(column["name"]),
                        "workflow_column_position": int(column["position"]),
                        "task_count": counts.get(column_id, 0),
                    },
                )
            )

    ordered_column_ids = _ordered_column_ids(columns, first_seen)
    return {
        "Cumulative Flow Diagram": ProjectDashboardCardRead(
            key=_chart_key("Cumulative Flow Diagram"),
            title="Cumulative Flow Diagram",
            series=[
                ProjectDashboardSeriesRead(
                    name=str(columns[column_id]["name"]),
                    entries=series_entries.get(column_id, []),
                )
                for column_id in ordered_column_ids
            ],
            entries=chart_entries,
            empty_state=None,
        )
    }


def _rework_chart(
    events: list[ProjectTaskChangeEvent],
    done_column_id: UUID | None,
) -> dict[str, ProjectDashboardCardRead]:
    if done_column_id is None:
        if not events:
            return {}
        return {
            "Defect / rework chart": _empty_chart(
                "Defect / rework chart",
                "missing_done_column_configuration",
            )
        }

    rework_events = [
        event
        for event in events
        if event.event_type == "workflow_column_changed"
        and event.task_id is not None
        and event.previous_column_id == done_column_id
        and event.new_column_id != done_column_id
        and event.occurred_at is not None
    ]
    if not rework_events:
        if events:
            return {
                "Defect / rework chart": _empty_chart(
                    "Defect / rework chart",
                    "no_reworked_task_events",
                )
            }
        return {}

    buckets: dict[datetime, int] = {}
    for event in rework_events:
        if event.occurred_at is None:
            continue
        occurred_at = _as_utc(event.occurred_at)
        week_start = datetime.combine(
            occurred_at.date() - timedelta(days=occurred_at.weekday()),
            datetime.min.time(),
            tzinfo=UTC,
        )
        buckets[week_start] = buckets.get(week_start, 0) + 1

    cumulative_reworked_task_count = 0
    entries: list[ProjectDashboardCardEntryRead] = []
    for week_start, reworked_task_count in sorted(buckets.items()):
        cumulative_reworked_task_count += reworked_task_count
        entries.append(
            ProjectDashboardCardEntryRead(
                label=week_start.date().isoformat(),
                values={
                    "reworked_task_count": reworked_task_count,
                    "cumulative_reworked_task_count": cumulative_reworked_task_count,
                },
            )
        )

    return {
        "Defect / rework chart": ProjectDashboardCardRead(
            key=_chart_key("Defect / rework chart"),
            title="Defect / rework chart",
            series=[
                ProjectDashboardSeriesRead(
                    name="Reworked Tasks",
                    entries=entries,
                )
            ],
            entries=entries,
            empty_state=None,
        )
    }


def _blocked_work_chart(
    events: list[ProjectTaskChangeEvent],
    generated_at: datetime,
) -> dict[str, ProjectDashboardCardRead]:
    blocked_events = [
        event
        for event in events
        if event.event_type == "blocked_state_changed"
        and event.task_id is not None
        and event.is_blocked is not None
        and event.occurred_at is not None
    ]
    if not blocked_events:
        if events:
            return {
                "Blocked work chart": _empty_chart(
                    "Blocked work chart",
                    "no_blocked_project_task_events",
                )
            }
        return {}

    blocked_since: dict[UUID, datetime] = {}
    chart_entries: list[ProjectDashboardCardEntryRead] = []
    for event in blocked_events:
        occurred_at = event.occurred_at
        if occurred_at is None:
            continue
        if event.is_blocked:
            blocked_since[event.task_id] = occurred_at
        else:
            blocked_since.pop(event.task_id, None)
        chart_entries.append(
            _blocked_work_entry(_event_label(event), blocked_since, occurred_at)
        )

    if blocked_since:
        chart_entries.append(
            _blocked_work_entry("Current", blocked_since, generated_at)
        )

    return {
        "Blocked work chart": ProjectDashboardCardRead(
            key=_chart_key("Blocked work chart"),
            title="Blocked work chart",
            series=[
                ProjectDashboardSeriesRead(
                    name="Blocked Project Tasks",
                    entries=chart_entries,
                )
            ],
            entries=chart_entries,
            empty_state=None,
        )
    }


def _active_sprint_ids(sprints: list[ProjectSprint]) -> set[UUID]:
    active_sprint_ids = [
        sprint.id
        for sprint in sprints
        if sprint.id is not None
        and sprint.lifecycle_state == SprintLifecycleState.ACTIVE
    ]
    return set(active_sprint_ids[-1:])


def _scope_window_sprint_ids(sprints: list[ProjectSprint]) -> set[UUID]:
    active_sprint_ids = [
        sprint.id
        for sprint in sprints
        if sprint.id is not None
        and sprint.lifecycle_state == SprintLifecycleState.ACTIVE
    ]
    closed_sprint_ids = [
        sprint.id
        for sprint in sprints
        if sprint.id is not None
        and sprint.lifecycle_state == SprintLifecycleState.CLOSED
    ]
    return set(closed_sprint_ids[-6:] + active_sprint_ids[-1:])


def _recent_scope_sprint_ids(events: list[ProjectTaskChangeEvent]) -> set[UUID]:
    sprint_ids: list[UUID] = []
    for event in events:
        sprint_id = event.new_sprint_id or event.previous_sprint_id or event.sprint_id
        if sprint_id is not None and sprint_id not in sprint_ids:
            sprint_ids.append(sprint_id)
    return set(sprint_ids[-7:])


def _is_recent_scope_event(
    event: ProjectTaskChangeEvent,
    recent_sprint_ids: set[UUID],
) -> bool:
    if not recent_sprint_ids:
        return True
    sprint_id = event.new_sprint_id or event.previous_sprint_id or event.sprint_id
    return sprint_id is None or sprint_id in recent_sprint_ids


def _week_start(occurred_at: datetime | None) -> datetime:
    occurred_at = _as_utc(occurred_at or datetime.now(UTC))
    return datetime.combine(
        occurred_at.date() - timedelta(days=occurred_at.weekday()),
        datetime.min.time(),
        tzinfo=UTC,
    )


def _blocked_work_entry(
    label: str,
    blocked_since: dict[UUID, datetime],
    as_of: datetime,
) -> ProjectDashboardCardEntryRead:
    as_of_utc = _as_utc(as_of)
    blocked_ages = [
        max(0, int((as_of_utc - _as_utc(blocked_at)).total_seconds()))
        for blocked_at in blocked_since.values()
    ]
    oldest_blocked_age_seconds = max(blocked_ages, default=0)
    return ProjectDashboardCardEntryRead(
        label=label,
        values={
            "blocked_count": len(blocked_since),
            "oldest_blocked_age_seconds": oldest_blocked_age_seconds,
            "oldest_blocked_age_days": oldest_blocked_age_seconds // 86400,
        },
    )


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _remember_column(
    columns: dict[UUID, dict[str, int | str]],
    first_seen: dict[UUID, int],
    index: int,
    column_id: UUID | None,
    column_name: str | None,
    column_position: int | None,
) -> None:
    if column_id is None or column_name is None:
        return
    first_seen.setdefault(column_id, index)
    columns[column_id] = {
        "name": column_name,
        "position": column_position if column_position is not None else index,
    }


def _ordered_column_ids(
    columns: dict[UUID, dict[str, int | str]],
    first_seen: dict[UUID, int],
) -> list[UUID]:
    return sorted(
        columns,
        key=lambda column_id: (
            int(columns[column_id]["position"]),
            first_seen[column_id],
        ),
    )


def _entry(
    label: str,
    *,
    sprint_scope: int,
    scope_delta: int,
    tasks_added: int,
    tasks_removed: int,
    unestimated_tasks: int,
) -> ProjectDashboardCardEntryRead:
    return ProjectDashboardCardEntryRead(
        label=label,
        values={
            "sprint_scope": sprint_scope,
            "scope_delta": scope_delta,
            "tasks_added": tasks_added,
            "tasks_removed": tasks_removed,
            "unestimated_tasks": unestimated_tasks,
        },
    )


def _empty_chart(title: str, reason: str) -> ProjectDashboardCardRead:
    return ProjectDashboardCardRead(
        key=_chart_key(title),
        title=title,
        series=[],
        entries=[],
        empty_state=ProjectDashboardCardEmptyStateRead(
            reason=reason,
            message=_EMPTY_MESSAGES[title],
        ),
    )


def _event_label(event: ProjectTaskChangeEvent) -> str:
    occurred_at = event.occurred_at
    if occurred_at is None:
        return "Unknown date"
    return occurred_at.date().isoformat()


def _chart_key(title: str) -> str:
    return title.casefold().replace(" / ", "-").replace(" ", "-").replace("_", "-")
