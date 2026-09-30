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
    environment: str = "development"  # "development", "staging", "production"
    enable_mock_auth: bool | None = None  # None: enabled only in non-production environments
    allow_synthetic_data: bool | None = None  # None: allowed only in non-production environments

    @property
    def is_production(self) -> bool:
        """Return True if application is running in production mode."""
        return self.environment.lower() in ("production", "prod")

    @property
    def mock_auth_allowed(self) -> bool:
        """Strictly prohibit mock/sandbox tokens in production unless explicitly opted in."""
        if self.enable_mock_auth is not None:
            return self.enable_mock_auth
        return not self.is_production

    @property
    def synthetic_data_allowed(self) -> bool:
        """Strictly prohibit silent synthetic data fallbacks in production."""
        if self.allow_synthetic_data is not None:
            return self.allow_synthetic_data
        return not self.is_production

    # Logging Configuration
    log_level: str = "INFO"
    log_format: str = "json"  # "json" for Kubernetes ELK/Loki, "console" for dev

    # Observability & Telemetry Configuration
    metrics_enabled: bool = True
    otel_enabled: bool = True
    otel_service_name: str = "luminai-data-engine"
    otel_exporter_otlp_endpoint: str | None = None
    otel_sample_rate: float = 1.0

    # Rate Limiting Configuration
    rate_limit_enabled: bool = True
    rate_limit_default_per_minute: int = 120
    rate_limit_pipeline_per_minute: int = 30


    # CORS Configuration
    cors_origins: list[str] | str = [
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
    kafka_security_protocol: str | None = None
    kafka_sasl_mechanism: str = "SCRAM-SHA-256"
    kafka_username: str | None = None
    kafka_password: str | None = None
    kafka_producer_max_retries: int = 3
    kafka_producer_initial_backoff: float = 0.5
    kafka_producer_backoff_multiplier: float = 2.0

    @property
    def kafka_security_conf(self) -> dict[str, Any]:
        """Return confluent-kafka security dictionary based on environment settings."""
        conf: dict[str, Any] = {}
        if self.kafka_security_protocol:
            conf["security.protocol"] = self.kafka_security_protocol
        elif self.kafka_username and self.kafka_password:
            conf["security.protocol"] = "SASL_SSL"

        if self.kafka_username and self.kafka_password:
            conf["sasl.mechanisms"] = self.kafka_sasl_mechanism or "SCRAM-SHA-256"
            conf["sasl.username"] = self.kafka_username
            conf["sasl.password"] = self.kafka_password
        return conf

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
    auto_migrate: bool = True  # Automatically run database migrations on application startup
    analytics_query_timeout_seconds: float = 30.0  # Maximum execution time for analytics queries

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
        """Connection DSN with explicit pg8000 driver and sanitized query parameters.

        Strips libpq/psycopg2 query parameters (such as sslmode, channel_binding)
        that pg8000.connect() rejects as unexpected keyword arguments.
        """
        if self.database_url:
            url = self.database_url
            if url.startswith("postgresql://"):
                url = url.replace("postgresql://", "postgresql+pg8000://", 1)
            elif url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+pg8000://", 1)

            from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

            parsed = urlparse(url)
            if parsed.query:
                query_params = parse_qs(parsed.query)
                for param in [
                    "sslmode",
                    "channel_binding",
                    "sslrootcert",
                    "sslcert",
                    "sslkey",
                    "gssencmode",
                    "target_session_attrs",
                ]:
                    query_params.pop(param, None)
                new_query = urlencode(query_params, doseq=True)
                url = urlunparse(parsed._replace(query=new_query))
            return url

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

