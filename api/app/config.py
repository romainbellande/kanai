from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", extra="allow", env_nested_delimiter="__"
    )
    
    database_url: str

settings = Settings()