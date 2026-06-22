"""Centralized configuration loaded from the environment.

All secrets and tunables live here so the rest of the codebase never reads
``os.environ`` directly. Construct once via :func:`get_settings` (cached).
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Worker settings, populated from environment / ``.env``."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Postgres
    database_url: str = "postgresql://localhost:5432/nara"

    # Groq
    groq_api_key: str = ""
    groq_model_fast: str = "llama-3.1-8b-instant"
    groq_model_quality: str = "llama-3.3-70b-versatile"

    # OpenAI
    openai_api_key: str = ""
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536

    # Worker loop
    worker_poll_interval_ms: int = 2000
    stuck_entry_timeout_sec: int = 300
    pgboss_schema: str = "pgboss"


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide settings singleton."""
    return Settings()
