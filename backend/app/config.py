from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL, make_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "CPM Common API"
    app_env: Literal["development", "production"] = "development"
    database_url: str
    jwt_secret_key: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = Field(default=60, ge=1, le=1440)
    api_docs_enabled: bool = True
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    )
    admin_username: str | None = None
    admin_password: str | None = Field(default=None, min_length=8, max_length=72)
    firebase_service_account_file: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()


def normalize_database_url(value: str, *, require_ssl: bool = False) -> URL:
    url = make_url(value)
    if url.drivername in {"postgres", "postgresql"}:
        url = url.set(drivername="postgresql+psycopg")
    if require_ssl and url.drivername.startswith("postgresql"):
        query = dict(url.query)
        query["sslmode"] = "require"
        url = url.set(query=query)
    return url
