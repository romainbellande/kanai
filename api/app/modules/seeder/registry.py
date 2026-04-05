from app.modules.seeder.base import BaseSeeder
from app.modules.user.user_seeder import SeedAdminUserSeeder


def get_seeders() -> list[BaseSeeder]:
    return [SeedAdminUserSeeder()]
