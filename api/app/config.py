from enum import StrEnum
from functools import cache

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import BaseModel


class Environment(StrEnum):
    LOCAL = "local"
    DEV = "dev"
    STA = "staging"
    PROD = "prod"


class AuthSettings(BaseModel):
    discovery_endpoint: str
    audience: str


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", extra="allow", env_nested_delimiter="__"
    )

    database_url: str
    redis_url: str
    environment: Environment
    auth: AuthSettings

    def is_local(self) -> bool:
        return self.environment == Environment.LOCAL

    def is_dev(self) -> bool:
        return self.environment == Environment.DEV

    def should_init_db_on_startup(self) -> bool:
        return self.is_local() or self.is_dev()

    def should_seed_db_on_startup(self) -> bool:
        return self.is_local() or self.is_dev()


@cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
