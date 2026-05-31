"""Database model metadata registration."""

from importlib import import_module

from sqlmodel import SQLModel


def import_models() -> None:
    """Import application models so SQLModel metadata includes their tables."""
    import_module("app.models.project")
    import_module("app.models.task")
    import_module("app.models.user")


metadata = SQLModel.metadata
