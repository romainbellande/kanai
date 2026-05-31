"""Database models for project tasks."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, ForeignKey, String, Uuid, func
from sqlmodel import Field, SQLModel


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
    title: str = Field(sa_column=Column(String(), nullable=False))
    status: str = Field(sa_column=Column(String(), nullable=False))
    priority: str = Field(sa_column=Column(String(), nullable=False))
    rank: str = Field(
        default="U",
        sa_column=Column("task_rank", String(), nullable=False, server_default="U"),
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
