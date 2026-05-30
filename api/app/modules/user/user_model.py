"""Database model for user records."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, String, Uuid, func
from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    """Persisted user account linked to an external identity provider."""

    __tablename__ = "users"  # type: ignore[bad-override]

    id: UUID | None = Field(
        default=None,
        sa_column=Column(Uuid(), primary_key=True, nullable=False, default=uuid4),
    )
    externalId: str = Field(
        sa_column=Column("externalId", String(), nullable=False, unique=True),
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
