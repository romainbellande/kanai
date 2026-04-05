from collections.abc import Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    from app.modules.seeder.service import SeedService


@dataclass(slots=True)
class SeedContext:
    session: AsyncSession
    service: "SeedService"
    cache: dict[str, dict[Any, Any]]


class BaseSeeder:
    name: str
    depends_on: Sequence[str] = ()

    async def seed(self, ctx: SeedContext) -> None:
        raise NotImplementedError
