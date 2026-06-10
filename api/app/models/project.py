"""Database models for projects and project membership."""

from datetime import date, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlmodel import Field, SQLModel


class SprintLifecycleState(StrEnum):
    """Lifecycle states for project sprints."""

    ACTIVE = "active"
    CLOSED = "closed"


class SprintTaskOutcome(StrEnum):
    """Close-time outcome for historical sprint task snapshots."""

    FINISHED = "finished"
    UNFINISHED = "unfinished"


class Project(SQLModel, table=True):
    """Represents a project tracked by the application.

    Parameters:
        id: Unique project identifier generated when the row is inserted.
        name: Human-readable project name.
        code: Unique three-character project code.
        priority: Project priority label.
        description: Optional project description.
        status: Optional project status label.
        updated_at: Timestamp updated when the project changes.
        created_at: Timestamp set when the project is created.
    """

    __tablename__ = "projects"  # type: ignore[bad-override]

    id: UUID | None = Field(
        default=None,
        sa_column=Column(Uuid(), primary_key=True, nullable=False, default=uuid4),
    )
    name: str = Field(sa_column=Column(String(), nullable=False))
    code: str = Field(sa_column=Column(String(length=3), nullable=False, unique=True))
    priority: str = Field(sa_column=Column(String(), nullable=False))
    description: str | None = Field(
        default=None,
        sa_column=Column(String(), nullable=True),
    )
    status: str | None = Field(
        default=None,
        sa_column=Column(String(), nullable=True),
    )
    done_column_id: UUID | None = Field(
        default=None,
        sa_column=Column(
            Uuid(),
            ForeignKey("project_columns.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    updated_at: datetime | None = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
        ),
    )
    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
        ),
    )


class ProjectColumn(SQLModel, table=True):
    """Represents an ordered workflow column owned by a project."""

    __tablename__ = "project_columns"  # type: ignore[bad-override]
    __table_args__ = (
        UniqueConstraint(
            "project_id", "name", name="uq_project_columns_project_id_name"
        ),
    )

    id: UUID | None = Field(
        default=None,
        sa_column=Column(Uuid(), primary_key=True, nullable=False, default=uuid4),
    )
    project_id: UUID = Field(
        sa_column=Column(
            Uuid(),
            ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
    )
    name: str = Field(sa_column=Column(String(length=80), nullable=False))
    description: str | None = Field(
        default=None,
        sa_column=Column(String(length=500), nullable=True),
    )
    position: int = Field(sa_column=Column(Integer(), nullable=False))
    updated_at: datetime | None = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
        ),
    )
    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
        ),
    )


class ProjectSprint(SQLModel, table=True):
    """Represents a lifecycle sprint scoped to one project."""

    __tablename__ = "project_sprints"  # type: ignore[bad-override]
    __table_args__ = (
        UniqueConstraint("project_id", "name", name="uq_project_sprints_project_name"),
    )

    id: UUID | None = Field(
        default=None,
        sa_column=Column(Uuid(), primary_key=True, nullable=False, default=uuid4),
    )
    project_id: UUID = Field(
        sa_column=Column(
            Uuid(),
            ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )
    name: str = Field(sa_column=Column(String(length=80), nullable=False))
    lifecycle_state: str = Field(
        default=SprintLifecycleState.ACTIVE,
        sa_column=Column(String(length=16), nullable=False, index=True),
    )
    planned_start_date: date = Field(sa_column=Column(Date(), nullable=False))
    planned_end_date: date = Field(sa_column=Column(Date(), nullable=False))
    goal: str | None = Field(default=None, sa_column=Column(Text(), nullable=True))
    closed_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    updated_at: datetime | None = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
        ),
    )
    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
        ),
    )


class ProjectSprintTaskSnapshot(SQLModel, table=True):
    """Immutable close-time task snapshot for a closed sprint."""

    __tablename__ = "project_sprint_task_snapshots"  # type: ignore[bad-override]

    id: UUID | None = Field(
        default=None,
        sa_column=Column(Uuid(), primary_key=True, nullable=False, default=uuid4),
    )
    sprint_id: UUID = Field(
        sa_column=Column(
            Uuid(),
            ForeignKey("project_sprints.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )
    task_id: UUID | None = Field(
        default=None,
        sa_column=Column(Uuid(), nullable=True, index=True),
    )
    column_id: UUID = Field(sa_column=Column(Uuid(), nullable=False))
    title: str = Field(sa_column=Column(String(), nullable=False))
    outcome: str = Field(sa_column=Column(String(length=16), nullable=False, index=True))
    priority: str | None = Field(default=None, sa_column=Column(String(), nullable=True))
    rank: str = Field(sa_column=Column(String(length=64), nullable=False))
    description: str | None = Field(default=None, sa_column=Column(Text(), nullable=True))
    acceptance_criteria: str | None = Field(
        default=None,
        sa_column=Column(Text(), nullable=True),
    )
    tag: str | None = Field(default=None, sa_column=Column(String(), nullable=True))
    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
        ),
    )


class ProjectOwner(SQLModel, table=True):
    """Associates a project with a user that owns it.

    Parameters:
        project_id: Project identifier for the ownership relationship.
        user_id: User identifier for the owner.
    """

    __tablename__ = "project_owners"  # type: ignore[bad-override]

    project_id: UUID = Field(
        sa_column=Column(
            Uuid(),
            ForeignKey("projects.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
    )
    user_id: UUID = Field(
        sa_column=Column(
            Uuid(),
            ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
    )


class ProjectMember(SQLModel, table=True):
    """Associates a project with a user that belongs to it.

    Parameters:
        project_id: Project identifier for the membership relationship.
        user_id: User identifier for the member.
    """

    __tablename__ = "project_members"  # type: ignore[bad-override]

    project_id: UUID = Field(
        sa_column=Column(
            Uuid(),
            ForeignKey("projects.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
    )
    user_id: UUID = Field(
        sa_column=Column(
            Uuid(),
            ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
    )


class ProjectChatMessage(SQLModel, table=True):
    """Persisted chat message scoped to one project."""

    __tablename__ = "project_chat_messages"  # type: ignore[bad-override]

    id: UUID | None = Field(
        default=None,
        sa_column=Column(Uuid(), primary_key=True, nullable=False, default=uuid4),
    )
    project_id: UUID = Field(
        sa_column=Column(
            Uuid(),
            ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )
    author_id: UUID | None = Field(
        default=None,
        sa_column=Column(
            Uuid(),
            ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )
    author_display_name: str = Field(sa_column=Column(String(), nullable=False))
    body: str = Field(sa_column=Column(Text(), nullable=False))
    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
            index=True,
        ),
    )
