from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "KRSNAA MIS DOS Platform"
    database_url: str = "sqlite:///./krsnaa.db"
    jwt_secret: str = "change-me-in-prod"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60


settings = Settings()
