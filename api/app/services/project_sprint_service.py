"""Service workflows for project sprints."""

from datetime import UTC, date, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import (
    ProjectSprint,
    ProjectSprintTaskSnapshot,
    SprintLifecycleState,
    SprintTaskOutcome,
)
from app.models.task import Task
from app.repositories.project_repository import ProjectRepository
from app.repositories.task_repository import TaskRepository
from app.schemas.project import (
    ProjectSprintClosePreviewRead,
    ProjectSprintCloseRead,
    ProjectSprintHistoryRead,
    ProjectSprintRead,
    ProjectSprintTaskAdd,
    ProjectSprintTaskSnapshotRead,
    ProjectSprintUpdate,
)
from app.schemas.task import TaskRead
from app.services.project_access import ProjectAccess, ProjectRole
from app.services.project_backlog_service import (
    DEFAULT_TASK_RANK,
    rank_between,
    task_to_read,
)


class ProjectSprintService:
    """Coordinates project sprint lifecycle operations."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize the service with a database session."""
        self._session = session
        self._repository = ProjectRepository(session)
        self._task_repository = TaskRepository(session)
        self._access = ProjectAccess(session)

    async def get_active(
        self,
        project_id: UUID,
        user_id: UUID,
    ) -> ProjectSprintRead | None:
        """Return the active sprint for a project visible to a participant."""
        await self._access.require_project(project_id, user_id)
        sprint = await self._repository.get_active_sprint(project_id)
        return sprint_to_read(sprint) if sprint else None

    async def create(
        self,
        project_id: UUID,
        user_id: UUID,
        *,
        planned_start_date: date,
        planned_end_date: date,
        goal: str | None,
        task_ids: list[UUID] | None = None,
    ) -> ProjectSprintRead:
        """Create an active sprint for a project owner."""
        project = await self._access.require_project(
            project_id,
            user_id,
            role=ProjectRole.OWNER,
        )
        if planned_end_date < planned_start_date:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Sprint end date must be on or after start date",
            )

        if await self._repository.get_active_sprint(project_id) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Project already has an active sprint",
            )
        for existing_sprint in await self._repository.list_sprints_by_project(
            project_id
        ):
            if self._timebox_overlaps(
                planned_start_date,
                planned_end_date,
                existing_sprint,
            ):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Sprint timebox overlaps an existing sprint",
                )

        sprint_number = await self._repository.count_sprints_by_project(project_id) + 1
        sprint = await self._repository.add_sprint(
            ProjectSprint(
                project_id=project_id,
                name=f"Sprint {sprint_number}",
                lifecycle_state=SprintLifecycleState.ACTIVE,
                planned_start_date=planned_start_date,
                planned_end_date=planned_end_date,
                goal=goal,
            )
        )
        if sprint.id is None:
            raise RuntimeError("Sprint ID is missing")
        for task_id in task_ids or []:
            task = await self._require_backlog_task(
                project_id,
                task_id,
                project.done_column_id,
            )
            task.sprint_id = sprint.id
            task.backlog_rank = None
        await self._repository.commit()
        await self._repository.refresh_sprint(sprint)
        return sprint_to_read(sprint)

    async def add_task_to_active(
        self,
        project_id: UUID,
        user_id: UUID,
        payload: ProjectSprintTaskAdd,
    ) -> TaskRead:
        """Add one existing Backlog task to the active sprint."""
        project = await self._access.require_project(project_id, user_id)
        sprint = await self._repository.get_active_sprint(project_id)
        if sprint is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Active sprint not found",
            )
        if sprint.id is None:
            raise RuntimeError("Sprint ID is missing")

        task = await self._require_backlog_task(
            project_id,
            payload.task_id,
            project.done_column_id,
        )
        task.sprint_id = sprint.id
        task.backlog_rank = None
        return task_to_read(await self._task_repository.update(task))

    async def remove_task_from_active(
        self,
        project_id: UUID,
        user_id: UUID,
        task_id: UUID,
    ) -> TaskRead:
        """Remove one active sprint task back to the top of the Backlog."""
        project = await self._access.require_project(project_id, user_id)
        sprint = await self._repository.get_active_sprint(project_id)
        if sprint is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Active sprint not found",
            )
        if sprint.id is None:
            raise RuntimeError("Sprint ID is missing")

        task = await self._task_repository.get_by_project(project_id, task_id)
        if task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found",
            )
        if task.sprint_id != sprint.id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Task is not in the active sprint",
            )

        first_backlog_task = next(
            iter(
                sorted(
                    await self._task_repository.list_backlog_candidates(
                        project_id,
                        project.done_column_id,
                    ),
                    key=lambda task: (
                        task.backlog_rank is None,
                        task.backlog_rank or "",
                        task.created_at,
                        str(task.id),
                    ),
                )
            ),
            None,
        )
        task.sprint_id = None
        task.backlog_rank = (
            rank_between(None, first_backlog_task.backlog_rank)
            if first_backlog_task and first_backlog_task.backlog_rank
            else DEFAULT_TASK_RANK
        )
        return task_to_read(await self._task_repository.update(task))

    async def close_confirmation(
        self,
        project_id: UUID,
        user_id: UUID,
    ) -> ProjectSprintClosePreviewRead:
        """Return close-time counts and carryover tasks for the active sprint."""
        project = await self._access.require_project(
            project_id,
            user_id,
            role=ProjectRole.OWNER,
        )
        sprint = await self._require_active_sprint(project_id)
        tasks = await self._task_repository.list_by_project_and_sprint(
            project_id,
            self._require_sprint_id(sprint),
        )
        finished_tasks, unfinished_tasks = self._classify_sprint_tasks(
            tasks,
            project.done_column_id,
        )
        return ProjectSprintClosePreviewRead(
            sprint=sprint_to_read(sprint),
            finished_count=len(finished_tasks),
            unfinished_count=len(unfinished_tasks),
            unfinished_tasks=[task_to_read(task) for task in unfinished_tasks],
            carryover_statement="Unfinished tasks will move to the top of the Backlog.",
        )

    async def close_active(
        self,
        project_id: UUID,
        user_id: UUID,
    ) -> ProjectSprintCloseRead:
        """Close the active sprint and snapshot its final membership."""
        project = await self._access.require_project(
            project_id,
            user_id,
            role=ProjectRole.OWNER,
        )
        sprint = await self._require_active_sprint(project_id)
        sprint_id = self._require_sprint_id(sprint)
        tasks = await self._task_repository.list_by_project_and_sprint(
            project_id,
            sprint_id,
        )
        columns = await self._repository.list_columns_by_project(project_id)
        column_positions = {
            column.id: index for index, column in enumerate(columns) if column.id
        }
        sorted_tasks = sorted(
            tasks,
            key=lambda task: (
                column_positions.get(task.column_id, len(column_positions)),
                task.rank,
                task.created_at,
                str(task.id),
            ),
        )
        finished_tasks, unfinished_tasks = self._classify_sprint_tasks(
            sorted_tasks,
            project.done_column_id,
        )

        snapshots: list[ProjectSprintTaskSnapshot] = []
        for task in sorted_tasks:
            snapshot = self._snapshot_task(
                sprint_id,
                task,
                SprintTaskOutcome.FINISHED
                if task in finished_tasks
                else SprintTaskOutcome.UNFINISHED,
            )
            self._session.add(snapshot)
            snapshots.append(snapshot)

        for index, task in enumerate(unfinished_tasks):
            task.sprint_id = None
            task.backlog_rank = f"!{index:06d}"

        sprint.lifecycle_state = SprintLifecycleState.CLOSED
        sprint.closed_at = datetime.now(UTC)
        await self._repository.commit()
        await self._repository.refresh_sprint(sprint)
        for task in unfinished_tasks:
            await self._session.refresh(task)
        for snapshot in snapshots:
            await self._session.refresh(snapshot)

        return ProjectSprintCloseRead(
            sprint=sprint_to_read(sprint),
            finished_count=len(finished_tasks),
            unfinished_count=len(unfinished_tasks),
            unfinished_tasks=[task_to_read(task) for task in unfinished_tasks],
            carryover_statement="Unfinished tasks will move to the top of the Backlog.",
            snapshots=[snapshot_to_read(snapshot) for snapshot in snapshots],
        )

    async def list_history(
        self,
        project_id: UUID,
        user_id: UUID,
    ) -> list[ProjectSprintHistoryRead]:
        """Return closed sprint history from immutable snapshots."""
        await self._access.require_project(project_id, user_id)
        history: list[ProjectSprintHistoryRead] = []
        for sprint in await self._repository.list_closed_sprints(project_id):
            sprint_id = self._require_sprint_id(sprint)
            snapshots = await self._repository.list_sprint_task_snapshots(sprint_id)
            live_task_ids: set[UUID] = set()
            for snapshot in snapshots:
                if snapshot.task_id is None:
                    continue
                if (
                    await self._task_repository.get_by_project(
                        project_id,
                        snapshot.task_id,
                    )
                    is not None
                ):
                    live_task_ids.add(snapshot.task_id)
            history.append(
                ProjectSprintHistoryRead(
                    sprint=sprint_to_read(sprint),
                    finished_count=sum(
                        1
                        for snapshot in snapshots
                        if snapshot.outcome == SprintTaskOutcome.FINISHED
                    ),
                    unfinished_count=sum(
                        1
                        for snapshot in snapshots
                        if snapshot.outcome == SprintTaskOutcome.UNFINISHED
                    ),
                    snapshots=[
                        snapshot_to_read(
                            snapshot,
                            live_task_exists=snapshot.task_id in live_task_ids,
                        )
                        for snapshot in snapshots
                    ],
                )
            )
        return history

    async def update_active(
        self,
        project_id: UUID,
        user_id: UUID,
        payload: ProjectSprintUpdate,
    ) -> ProjectSprintRead:
        """Update active sprint metadata for a project owner."""
        await self._access.require_project(
            project_id,
            user_id,
            role=ProjectRole.OWNER,
        )
        sprint = await self._repository.get_active_sprint(project_id)
        if sprint is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Active sprint not found",
            )

        values = payload.update_values()
        planned_start_date = values.get("planned_start_date", sprint.planned_start_date)
        planned_end_date = values.get("planned_end_date", sprint.planned_end_date)
        if not isinstance(planned_start_date, date) or not isinstance(
            planned_end_date, date
        ):
            raise RuntimeError("Sprint dates were not parsed")
        if planned_end_date < planned_start_date:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Sprint end date must be on or after start date",
            )
        sprint_id = self._require_sprint_id(sprint)
        for existing_sprint in await self._repository.list_sprints_by_project(
            project_id
        ):
            if existing_sprint.id == sprint_id:
                continue
            if self._timebox_overlaps(
                planned_start_date,
                planned_end_date,
                existing_sprint,
            ):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Sprint timebox overlaps an existing sprint",
                )

        for field_name, value in values.items():
            setattr(sprint, field_name, value)

        await self._repository.commit()
        await self._repository.refresh_sprint(sprint)
        return sprint_to_read(sprint)

    async def _require_active_sprint(self, project_id: UUID) -> ProjectSprint:
        sprint = await self._repository.get_active_sprint(project_id)
        if sprint is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Active sprint not found",
            )
        return sprint

    @staticmethod
    def _require_sprint_id(sprint: ProjectSprint) -> UUID:
        if sprint.id is None:
            raise RuntimeError("Sprint ID is missing")
        return sprint.id

    @staticmethod
    def _classify_sprint_tasks(
        tasks: list[Task],
        done_column_id: UUID | None,
    ) -> tuple[list[Task], list[Task]]:
        finished_tasks: list[Task] = []
        unfinished_tasks: list[Task] = []
        for task in tasks:
            if done_column_id is not None and task.column_id == done_column_id:
                finished_tasks.append(task)
            else:
                unfinished_tasks.append(task)
        return finished_tasks, unfinished_tasks

    @staticmethod
    def _snapshot_task(
        sprint_id: UUID,
        task: Task,
        outcome: SprintTaskOutcome,
    ) -> ProjectSprintTaskSnapshot:
        return ProjectSprintTaskSnapshot(
            sprint_id=sprint_id,
            task_id=task.id,
            column_id=task.column_id,
            title=task.title,
            outcome=outcome,
            priority=task.priority,
            rank=task.rank,
            description=task.description,
            acceptance_criteria=task.acceptance_criteria,
            tag=task.tag,
        )

    @staticmethod
    def _timebox_overlaps(
        planned_start_date: date,
        planned_end_date: date,
        existing_sprint: ProjectSprint,
    ) -> bool:
        return (
            planned_start_date <= existing_sprint.planned_end_date
            and planned_end_date >= existing_sprint.planned_start_date
        )

    async def _require_backlog_task(
        self,
        project_id: UUID,
        task_id: UUID,
        done_column_id: UUID | None,
    ) -> Task:
        task = await self._task_repository.get_by_project(project_id, task_id)
        if task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found",
            )
        if done_column_id is not None and task.column_id == done_column_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Done tasks cannot be added to the active sprint",
            )
        if task.sprint_id is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Task is not in the Backlog",
            )
        return task


def sprint_to_read(sprint: ProjectSprint) -> ProjectSprintRead:
    """Convert a sprint model into its API response schema."""
    if sprint.id is None:
        raise RuntimeError("Sprint ID is missing")

    return ProjectSprintRead(
        id=sprint.id,
        project_id=sprint.project_id,
        name=sprint.name,
        lifecycle_state=sprint.lifecycle_state,
        planned_start_date=sprint.planned_start_date,
        planned_end_date=sprint.planned_end_date,
        goal=sprint.goal,
        closed_at=sprint.closed_at,
        created_at=sprint.created_at,
        updated_at=sprint.updated_at,
    )


def snapshot_to_read(
    snapshot: ProjectSprintTaskSnapshot,
    *,
    live_task_exists: bool = False,
) -> ProjectSprintTaskSnapshotRead:
    """Convert a sprint task snapshot into an API response schema."""
    if snapshot.id is None:
        raise RuntimeError("Sprint task snapshot ID is missing")

    return ProjectSprintTaskSnapshotRead(
        id=snapshot.id,
        sprint_id=snapshot.sprint_id,
        task_id=snapshot.task_id,
        column_id=snapshot.column_id,
        title=snapshot.title,
        outcome=snapshot.outcome,
        priority=snapshot.priority,
        rank=snapshot.rank,
        description=snapshot.description,
        acceptance_criteria=snapshot.acceptance_criteria,
        tag=snapshot.tag,
        live_task_exists=live_task_exists,
        created_at=snapshot.created_at,
    )
