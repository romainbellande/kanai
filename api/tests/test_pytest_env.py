from typing import Any, cast

from app.core.config import Environment, Settings


def test_pytest_env_provides_required_settings_without_dotenv() -> None:
    settings = cast("Settings", cast("Any", Settings)(_env_file=None))

    assert settings.database_url == "sqlite+aiosqlite:///./test.db"
    assert settings.redis_url == "redis://localhost:6379/0"
    assert settings.environment == Environment.LOCAL
    assert settings.client_origin == "http://localhost:5173"
    assert settings.public_api_base_url == "https://api.example.test"
    assert settings.auth.discovery_endpoint == (
        "https://example.test/.well-known/openid-configuration"
    )
    assert settings.auth.audience == "kanai-api"
    assert settings.ai.model_name == "test-model"
    assert settings.ai.base_url == "https://ai.example.test/v1"
    assert settings.ai.api_key == "test-api-key"
