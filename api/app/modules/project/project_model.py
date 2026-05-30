"""Database models for projects, project membership, and tasks."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, ForeignKey, String, Uuid, func
from sqlmodel import Field, SQLModel


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


class Task(SQLModel, table=True):
    """Represents a task within a project.

    Parameters:
        id: Unique task identifier generated when the row is inserted.
        project_id: Project identifier for the task.
        title: Human-readable task title.
        status: Current task status label.
        priority: Task priority label.
        assignee_id: Optional user identifier for the assigned user.
        description: Optional task description.
        acceptance_criteria: Optional criteria required to complete the task.
        tag: Optional task categorization label.
        updated_at: Timestamp updated when the task changes.
        created_at: Timestamp set when the task is created.
    """

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
