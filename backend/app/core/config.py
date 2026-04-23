import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    app_name: str = "KRSNAA MIS DOS Platform"
    # Fallback to SQLite if DATABASE_URL is not provided
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./krsnaa.db")
    jwt_secret: str = os.getenv("SECRET_KEY", "change-me-in-prod")
    jwt_algorithm: str = os.getenv("ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    environment: str = os.getenv("ENVIRONMENT", "development")


settings = Settings()
