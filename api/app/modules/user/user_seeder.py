"""Seed default user records."""

from app.modules.seeder.base import BaseSeeder, SeedContext
from app.modules.user.user_model import User


class SeedAdminUserSeeder(BaseSeeder):
    """Seeder that ensures the default admin user exists."""

    name = "seed_admin_user"

    async def seed(self, ctx: SeedContext) -> None:
        """Create the seed admin user if it does not already exist.

        Args:
            ctx: Seeder execution context with access to persistence services.
        """
        await ctx.service.get_or_create(User, {"externalId": "seed-admin"})
