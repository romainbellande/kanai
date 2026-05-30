"""Startup hooks for seeding reference data."""

from app.config import settings
from app.modules.seeder.registry import get_seeders
from app.modules.seeder.runner import SeederRunner
from app.services.database_service import DBSession


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
