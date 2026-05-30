"""Run registered seeders in dependency order within a database session."""

from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.seeder.base import BaseSeeder, SeedContext
from app.modules.seeder.service import SeedService


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

        Raises:
            SeederConfigurationError: If dependency resolution fails.
            Exception: Re-raises any exception raised by a seeder or session operation.
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
