"""Utilities for idempotently seeding database records."""

from collections.abc import Mapping, Sequence
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class SeedService:
    """Service for creating or updating seed data with an async session."""

    def __init__(self, session: AsyncSession):
        """Initialize the seed service.

        Args:
            session: Async SQLAlchemy session used for seed operations.
        """
        self._session = session

    async def get_or_create(
        self,
        model: type[Any],
        lookup: Mapping[str, Any],
        defaults: Mapping[str, Any] | None = None,
    ) -> Any:
        """Return an existing row matching lookup values or create it.

        Args:
            model: SQLAlchemy model class to query and instantiate.
            lookup: Field values used to find an existing row.
            defaults: Additional field values used only when creating a row.

        Returns:
            The existing or newly created model instance.
        """
        instance = await self._get_one(model, lookup)
        if instance is not None:
            return instance

        values = dict(lookup)
        if defaults is not None:
            values.update(defaults)

        instance = model(**values)
        self._session.add(instance)
        await self._session.flush()
        return instance

    async def upsert_by_unique(
        self,
        model: type[Any],
        unique_field: str,
        rows: Sequence[Mapping[str, Any]],
        update_fields: Sequence[str] | None = None,
    ) -> list[Any]:
        """Create or update rows identified by a unique field.

        Args:
            model: SQLAlchemy model class to query and instantiate.
            unique_field: Row key used to find existing records.
            rows: Seed row mappings to create or update.
            update_fields: Field names to update when a row already exists.

        Returns:
            Model instances corresponding to the provided rows.
        """
        instances: list[Any] = []

        for row in rows:
            unique_value = row[unique_field]
            instance = await self._get_one(model, {unique_field: unique_value})

            if instance is None:
                instance = model(**dict(row))
                self._session.add(instance)
            elif update_fields is not None:
                for field_name in update_fields:
                    if field_name in row:
                        setattr(instance, field_name, row[field_name])

            instances.append(instance)

        await self._session.flush()
        return instances

    async def _get_one(self, model: type[Any], lookup: Mapping[str, Any]) -> Any | None:
        statement = select(model).filter_by(**dict(lookup))
        result = await self._session.execute(statement)
        return result.scalars().first()
