"""
tests/test_config.py
--------------------
Tests for application configuration loading.
"""

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
