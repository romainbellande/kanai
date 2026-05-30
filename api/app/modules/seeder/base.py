"""Base interfaces and context objects for database seeders."""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    from app.modules.seeder.service import SeedService


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

    Attributes:
        name: Unique seeder name used for registration and dependency checks.
        depends_on: Seeder names that must run before this seeder.
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
