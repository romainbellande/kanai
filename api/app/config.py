"""Application configuration loaded from environment variables."""

from enum import StrEnum
from functools import cache

from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(StrEnum):
    """Deployment environments supported by the application."""

    LOCAL = "local"
    DEV = "dev"
    STA = "staging"
    PROD = "prod"


class AuthSettings(BaseModel):
    """Authentication provider configuration.

    Attributes:
        discovery_endpoint: OpenID Connect discovery document URL.
        audience: Expected token audience for API authentication.
    """

    discovery_endpoint: str
    audience: str


class Settings(BaseSettings):
    """Environment-backed application settings.

    Attributes:
        database_url: Database connection URL.
        redis_url: Redis connection URL.
        environment: Current deployment environment.
        auth: Authentication provider settings.
        client_origin: Allowed client application origin.
    """

    model_config = SettingsConfigDict(
        env_file=".env", extra="allow", env_nested_delimiter="__"
    )

    database_url: str
    redis_url: str
    environment: Environment
    auth: AuthSettings
    client_origin: str

    def is_local(self) -> bool:
        """Return whether the application is running locally.

        Returns:
            True when the configured environment is local.
        """

        return self.environment == Environment.LOCAL

    def is_dev(self) -> bool:
        """Return whether the application is running in development.

        Returns:
            True when the configured environment is development.
        """

        return self.environment == Environment.DEV

    def should_init_db_on_startup(self) -> bool:
        """Return whether startup should initialize database schema.

        Returns:
            True when database initialization should run during startup.
        """

        return self.is_local() or self.is_dev()

    def should_seed_db_on_startup(self) -> bool:
        """Return whether startup should seed database data.

        Returns:
            True when database seeding should run during startup.
        """

        return self.is_local() or self.is_dev()


@cache
def get_settings() -> Settings:
    """Load and cache application settings.

    Returns:
        The configured application settings instance.
    """

    return Settings()  # type: ignore[call-arg]


settings = get_settings()
