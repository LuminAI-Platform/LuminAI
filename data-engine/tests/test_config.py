"""Tests for application configuration loading."""

from app.config import Settings, get_settings


def test_default_settings():
    """Settings load with correct defaults."""
    settings = get_settings()
    assert settings.app_name == "LuminAI Data Engine"
    assert settings.app_version == "0.1.0"
    assert settings.app_port == 8000


def test_kafka_defaults():
    """Kafka settings have correct defaults."""
    settings = get_settings()
    assert settings.kafka_bootstrap_servers == "localhost:9092"
    assert settings.kafka_group_id == "data-engine"
    assert settings.kafka_topic_ingest_raw == "ingest.raw"
    assert settings.kafka_topic_ingest_valid == "ingest.valid"
    assert settings.kafka_topic_ingest_dead_letter == "ingest.dead_letter"


def test_kafka_enabled_default_false():
    """Kafka consumer is disabled by default."""
    settings = Settings(kafka_enabled=False)
    assert settings.kafka_enabled is False


def test_postgres_dsn():
    """PostgreSQL DSN is correctly constructed from components."""
    settings = Settings(
        postgres_host="db.example.com",
        postgres_port=5433,
        postgres_user="testuser",
        postgres_password="testpass",
        postgres_db="testdb",
    )
    assert settings.postgres_dsn == "postgresql://testuser:testpass@db.example.com:5433/testdb"


def test_database_url_override():
    """DATABASE_URL overrides component-based DSN construction."""
    settings = Settings(database_url="postgresql://user:pass@render-db:5432/luminai")
    assert settings.postgres_dsn == "postgresql://user:pass@render-db:5432/luminai"


def test_security_defaults():
    """Security settings have expected defaults for dev/test mode."""
    settings = get_settings()
    assert settings.auth_enabled is False
    assert settings.api_key == "luminai-internal-secret-key"
    assert settings.keycloak_realm == "luminai"
    assert settings.keycloak_client_id == "luminai-spa"


def test_keycloak_urls():
    """Keycloak JWKS and Issuer URLs are generated properly."""
    settings = Settings(
        keycloak_url="https://auth.luminai.com/",
        keycloak_realm="luminai",
    )
    assert settings.keycloak_jwks_url == "https://auth.luminai.com/realms/luminai/protocol/openid-connect/certs"
    assert settings.keycloak_issuer == "https://auth.luminai.com/realms/luminai"


def test_cors_origins_defaults():
    """CORS origins default to production and development URLs without wildcards."""
    get_settings.cache_clear()
    settings = get_settings()
    assert "*" not in settings.cors_origins
    assert "https://luminai-sand.vercel.app" in settings.cors_origins
    assert "https://luminai-api.onrender.com" in settings.cors_origins
    assert "https://luminai-data.onrender.com" in settings.cors_origins
    assert "http://localhost:5173" in settings.cors_origins

    # Direct class defaults without .env file override
    clean_settings = Settings(_env_file=None)
    assert "*" not in clean_settings.cors_origins
    assert "https://luminai-sand.vercel.app" in clean_settings.cors_origins
    assert "https://luminai-api.onrender.com" in clean_settings.cors_origins
    assert "https://luminai-data.onrender.com" in clean_settings.cors_origins


def test_cors_origins_normalization():
    """CORS origins strip trailing slashes and parse comma-separated strings."""
    settings = Settings(
        cors_origins="https://app.example.com/, http://localhost:3000/"
    )
    assert settings.cors_origins == ["https://app.example.com", "http://localhost:3000"]

