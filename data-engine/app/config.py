"""Centralised application configuration using Pydantic BaseSettings.

All values can be overridden via environment variables or a local .env file.
"""

from functools import lru_cache
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application-wide settings parsed from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Service Configuration
    app_name: str = "LuminAI Data Engine"
    app_version: str = "0.1.0"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    app_frontend_url: str = "https://luminai-sand.vercel.app"
    debug: bool = False

    # Logging Configuration
    log_level: str = "INFO"
    log_format: str = "json"  # "json" for Kubernetes ELK/Loki, "console" for dev

    # CORS Configuration
    cors_origins: list[str] = [
        "https://luminai-sand.vercel.app",
        "https://luminai-api.onrender.com",
        "https://luminai-data.onrender.com",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8000",
        "http://localhost:8080",
    ]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                v = json.loads(v)
            else:
                v = [item.strip() for item in v.split(",") if item.strip()]
        if isinstance(v, (list, tuple)):
            return [str(origin).rstrip("/") for origin in v]
        return v

    # Kafka Configuration
    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_group_id: str = "data-engine"
    kafka_enabled: bool = False  # Set True when Kafka broker is available
    kafka_topic_ingest_raw: str = "ingest.raw"
    kafka_topic_ingest_valid: str = "ingest.valid"
    kafka_topic_ingest_dead_letter: str = "ingest.dead_letter"
    kafka_topic_entity_resolved: str = "entity.resolved"

    # Database & Redis Configuration
    database_url: str | None = None
    redis_url: str | None = None
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "luminai"
    postgres_password: str = "luminai"
    postgres_db: str = "luminai"
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout: float = 30.0
    db_pool_recycle: int = 1800
    db_pool_pre_ping: bool = True

    @property
    def postgres_dsn(self) -> str:
        if self.database_url:
            return self.database_url
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def postgres_driver_dsn(self) -> str:
        """Connection DSN with explicit pg8000 driver."""
        if self.database_url:
            if self.database_url.startswith("postgresql://"):
                return self.database_url.replace("postgresql://", "postgresql+pg8000://", 1)
            return self.database_url
        return (
            f"postgresql+pg8000://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    # MinIO / S3 Configuration
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_secure: bool = False
    minio_bucket_raw: str = "luminai-raw"
    minio_region: str = "us-east-1"

    @property
    def minio_url(self) -> str:
        proto = "https" if self.minio_secure else "http"
        endpoint = self.minio_endpoint
        if endpoint.startswith("http://") or endpoint.startswith("https://"):
            return endpoint
        return f"{proto}://{endpoint}"


    # Dagster Orchestrator Configuration
    dagster_host: str = "localhost"
    dagster_port: int = 3001
    dagster_graphql_url: str | None = None

    @property
    def resolved_dagster_graphql_url(self) -> str:
        if self.dagster_graphql_url:
            return self.dagster_graphql_url
        return f"http://{self.dagster_host}:{self.dagster_port}/graphql"

    # Authentication & Keycloak OIDC Configuration
    auth_enabled: bool = False  # Set True via AUTH_ENABLED=true in production
    api_key: str = "luminai-internal-secret-key"
    keycloak_url: str = "http://localhost:8080"
    keycloak_realm: str = "luminai"
    keycloak_client_id: str = "luminai-spa"
    keycloak_audience: str | None = None
    keycloak_public_key: str | None = None

    @property
    def keycloak_jwks_url(self) -> str:
        url = self.keycloak_url.rstrip("/")
        return f"{url}/realms/{self.keycloak_realm}/protocol/openid-connect/certs"

    @property
    def keycloak_issuer(self) -> str:
        url = self.keycloak_url.rstrip("/")
        return f"{url}/realms/{self.keycloak_realm}"



@lru_cache
def get_settings() -> Settings:
    """Return a cached singleton Settings instance."""
    return Settings()

