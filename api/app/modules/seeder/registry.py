"""Seeder registry for application data initialization."""

from app.modules.seeder.base import BaseSeeder
from app.modules.user.user_seeder import SeedAdminUserSeeder


def get_seeders() -> list[BaseSeeder]:
    """Return the seeders to run for application initialization.

    Returns:
        Ordered list of seeder instances.
    """

    return [SeedAdminUserSeeder()]
