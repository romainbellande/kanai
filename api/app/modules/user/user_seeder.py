from app.modules.seeder.base import BaseSeeder, SeedContext
from app.modules.user.user_model import User


class SeedAdminUserSeeder(BaseSeeder):
    name = "seed_admin_user"

    async def seed(self, ctx: SeedContext) -> None:
        await ctx.service.get_or_create(User, {"externalId": "seed-admin"})
