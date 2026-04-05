from collections.abc import Mapping, Sequence
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class SeedService:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_or_create(
        self,
        model: type[Any],
        lookup: Mapping[str, Any],
        defaults: Mapping[str, Any] | None = None,
    ) -> Any:
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
