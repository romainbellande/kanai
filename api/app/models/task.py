"""Database models for project tasks."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Uuid,
    func,
)
from sqlmodel import Field, SQLModel


class TaskDependency(SQLModel, table=True):
    """Directed task dependency edge within one project."""

    __tablename__ = "task_dependencies"  # type: ignore[bad-override]
    __table_args__ = (
        CheckConstraint(
            "dependent_task_id != prerequisite_task_id",
            name="ck_task_dependencies_no_self_edge",
        ),
    )

    project_id: UUID = Field(
        sa_column=Column(
            Uuid(),
            ForeignKey("projects.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
    )
    dependent_task_id: UUID = Field(
        sa_column=Column(
            Uuid(),
            ForeignKey("tasks.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
    )
    prerequisite_task_id: UUID = Field(
        sa_column=Column(
            Uuid(),
            ForeignKey("tasks.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
    )


class Task(SQLModel, table=True):
    """Represents a task within a project."""

    __tablename__ = "tasks"  # type: ignore[bad-override]

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
    sprint_id: UUID | None = Field(
        default=None,
        sa_column=Column(
            Uuid(),
            ForeignKey("project_sprints.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )
    column_id: UUID = Field(
        sa_column=Column(
            Uuid(),
            ForeignKey("project_columns.id", ondelete="RESTRICT"),
            nullable=False,
        ),
    )
    title: str = Field(sa_column=Column(String(), nullable=False))
    priority: str = Field(sa_column=Column(String(), nullable=False))
    story_points: int | None = Field(
        default=None,
        sa_column=Column(Integer(), nullable=True),
    )
    rank: str = Field(
        default="U",
        sa_column=Column("task_rank", String(), nullable=False, server_default="U"),
    )
    backlog_rank: str | None = Field(
        default=None,
        sa_column=Column(String(), nullable=True, index=True),
    )
    assignee_id: UUID | None = Field(
        default=None,
        sa_column=Column(
            Uuid(),
            ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    description: str | None = Field(
        default=None,
        sa_column=Column(String(), nullable=True),
    )
    acceptance_criteria: str | None = Field(
        default=None,
        sa_column=Column(String(), nullable=True),
    )
    tag: str | None = Field(
        default=None,
        sa_column=Column(String(), nullable=True),
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
