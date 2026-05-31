"""Tests for task rank helpers."""

from uuid import UUID

import pytest
from pydantic import ValidationError

from app.models.task import Task
from app.schemas.task import TaskUpdate
from app.services.task_service import rank_between, task_to_read


def test_rank_between_returns_sortable_midpoints() -> None:
    """Ranks stay lexicographically between neighbors."""
    middle = rank_between("U", "j")

    assert "U" < middle < "j"
    assert rank_between(None, "U") < "U"
    assert rank_between("j", None) > "j"


def test_task_read_includes_rank() -> None:
    """Task API responses expose persisted ordering rank."""
    task = Task(
        id=UUID("00000000-0000-0000-0000-000000000001"),
        project_id=UUID("00000000-0000-0000-0000-000000000002"),
        title="Ranked task",
        status="todo",
        priority="medium",
        rank="U",
    )

    assert task_to_read(task).rank == "U"


def test_task_update_values_preserves_nullable_fields() -> None:
    """Explicit nulls clear nullable fields while omitted fields stay absent."""
    update = TaskUpdate(description=None, title="Updated")

    assert update.update_values() == {"title": "Updated", "description": None}


def test_task_update_rejects_null_for_required_fields() -> None:
    """Required task fields can be omitted for PATCH, but not nulled."""
    with pytest.raises(ValidationError):
        TaskUpdate(title=None)
