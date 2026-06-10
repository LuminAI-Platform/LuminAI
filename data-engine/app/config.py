"""
app/config.py
-------------
Centralised application configuration using Pydantic BaseSettings.
All values can be overridden via environment variables or a local .env file.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application-wide settings parsed from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Service ────────────────────────────────────────────────────────────
    app_name: str = "LuminAI Data Engine"
    app_version: str = "0.1.0"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    debug: bool = False

    # ── CORS ───────────────────────────────────────────────────────────────
    # Origins allowed to call this API (comma-separated list for env override)
    cors_origins: list[str] = [
        "http://localhost:8080",  # Core Java Backend
        "http://localhost:5173",  # React Frontend (dev)
    ]

    # ── Kafka ──────────────────────────────────────────────────────────────
    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_group_id: str = "data-engine"
    kafka_topic_ingest_raw: str = "ingest.raw"
    kafka_topic_ingest_valid: str = "ingest.valid"
    kafka_topic_ingest_dead_letter: str = "ingest.dead_letter"

    # ── PostgreSQL ─────────────────────────────────────────────────────────
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "luminai"
    postgres_password: str = "luminai"
    postgres_db: str = "luminai"

    @property
    def postgres_dsn(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    # ── MinIO / S3 ─────────────────────────────────────────────────────────
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_secure: bool = False


@lru_cache
def get_settings() -> Settings:
    """Return a cached singleton Settings instance."""
    return Settings()
