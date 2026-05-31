"""Database seeding services and startup hook."""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import DBSession
from app.models.user import User


@dataclass(slots=True)
class SeedContext:
    """Context shared with seeders during seed execution.

    Parameters:
        session: Database session used by seeders to read and write data.
        service: Seed service coordinating seeder execution and shared helpers.
        cache: Shared in-memory values keyed by seeder or resource name.
    """

    session: AsyncSession
    service: "SeedService"
    cache: dict[str, dict[Any, Any]]


class BaseSeeder:
    """Base class for seeders that populate application data.

    Subclasses declare a unique `name`, optional `depends_on` dependencies, and
    implement `seed` to perform database writes.
    """

    name: str
    depends_on: Sequence[str] = ()

    async def seed(self, ctx: SeedContext) -> None:
        """Seed application data for this seeder.

        Args:
            ctx: Seed execution context with database and service access.

        Raises:
            NotImplementedError: Raised when a subclass does not implement seeding.
        """

        raise NotImplementedError


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


class SeedAdminUserSeeder(BaseSeeder):
    """Seeder that ensures the default admin user exists."""

    name = "seed_admin_user"

    async def seed(self, ctx: SeedContext) -> None:
        """Create the seed admin user if it does not already exist.

        Args:
            ctx: Seeder execution context with access to persistence services.
        """
        await ctx.service.get_or_create(User, {"externalId": "seed-admin"})


def get_seeders() -> list[BaseSeeder]:
    """Return the seeders to run for application initialization.

    Returns:
        Ordered list of seeder instances.
    """

    return [SeedAdminUserSeeder()]


class SeederConfigurationError(Exception):
    """Raised when seeder registration or configuration is invalid."""

    pass


class SeederDependencyError(SeederConfigurationError):
    """Raised when a seeder dependency is missing or cannot be resolved."""

    pass


class SeederCycleError(SeederConfigurationError):
    """Raised when seeder dependencies contain a cycle."""

    pass


class SeederRunner:
    """Coordinates seeder execution for a database session.

    The runner validates unique seeder names, resolves dependencies between
    seeders, and commits all seed changes as a single transaction.
    """

    def __init__(self, seeders: Sequence[BaseSeeder], session: AsyncSession):
        """Initialize the `SeederRunner`.

        Args:
            seeders: Seeder instances to register for execution.
            session: Database session used by seeders and transaction handling.

        Raises:
            SeederConfigurationError: If multiple seeders share the same name.
        """
        self._session = session
        self._seeders_by_name: dict[str, BaseSeeder] = {}

        for seeder in seeders:
            if seeder.name in self._seeders_by_name:
                raise SeederConfigurationError(f"Duplicate seeder name '{seeder.name}'")
            self._seeders_by_name[seeder.name] = seeder

    async def run(self) -> None:
        """Run all registered seeders in dependency order.

        Commits the session when every seeder succeeds and rolls back the
        session if any seeder raises an exception.
        """
        ordered_seeders = self._resolve_order()
        ctx = SeedContext(
            session=self._session,
            service=SeedService(self._session),
            cache={},
        )

        try:
            for seeder in ordered_seeders:
                await seeder.seed(ctx)
            await self._session.commit()
        except Exception:
            await self._session.rollback()
            raise

    def _resolve_order(self) -> list[BaseSeeder]:
        ordered_seeders: list[BaseSeeder] = []
        temporary_marks: set[str] = set()
        permanent_marks: set[str] = set()

        for seeder_name in self._seeders_by_name:
            self._visit(
                seeder_name,
                ordered_seeders,
                temporary_marks,
                permanent_marks,
            )

        return ordered_seeders

    def _visit(
        self,
        seeder_name: str,
        ordered_seeders: list[BaseSeeder],
        temporary_marks: set[str],
        permanent_marks: set[str],
    ) -> None:
        if seeder_name in permanent_marks:
            return

        if seeder_name in temporary_marks:
            raise SeederCycleError(
                f"Seeder dependency cycle detected at '{seeder_name}'"
            )

        seeder = self._seeders_by_name.get(seeder_name)
        if seeder is None:
            raise SeederDependencyError(
                f"Seeder dependency '{seeder_name}' is not registered"
            )

        temporary_marks.add(seeder_name)
        for dependency_name in seeder.depends_on:
            if dependency_name not in self._seeders_by_name:
                raise SeederDependencyError(
                    f"Seeder '{seeder_name}' depends on missing seeder '{dependency_name}'"
                )
            self._visit(
                dependency_name,
                ordered_seeders,
                temporary_marks,
                permanent_marks,
            )

        temporary_marks.remove(seeder_name)
        permanent_marks.add(seeder_name)
        ordered_seeders.append(seeder)


async def seed_reference_data() -> None:
    """Seed registered reference data during application startup when enabled."""

    if not settings.should_seed_db_on_startup():
        return

    seeders = get_seeders()
    if not seeders:
        return

    async with DBSession() as session:
        runner = SeederRunner(seeders, session)
        await runner.run()
