"""Tests for Alembic database migration system and declarative models."""

import os
import pytest
from sqlalchemy import create_engine, inspect
from sqlalchemy.pool import StaticPool

from app.db.models import (
    Base,
    ERCandidate,
    GoldenRecord,
    ProvenanceRecord,
    StagingRecord,
)
from app.db.migrations import (
    ensure_tables_exist,
    get_alembic_config,
    run_downgrade,
    run_migrations,
)


class TestDeclarativeModels:
    """Test suite for declarative SQLAlchemy 2.0 ORM models."""

    def test_models_metadata_registration(self):
        """All core Data Engine tables are registered in Base.metadata."""
        table_names = set(Base.metadata.tables.keys())
        expected_tables = {"staging_records", "golden_records", "er_candidates", "provenance"}
        assert expected_tables.issubset(table_names), f"Missing tables: {expected_tables - table_names}"

    def test_staging_record_schema(self):
        """staging_records table columns and constraints."""
        table = Base.metadata.tables["staging_records"]
        assert "id" in table.columns
        assert table.columns["id"].primary_key
        assert "tenant_id" in table.columns
        assert "source_id" in table.columns
        assert "data" in table.columns
        assert "staged_at" in table.columns

    def test_golden_record_schema(self):
        """golden_records table columns and constraints."""
        table = Base.metadata.tables["golden_records"]
        assert "golden_id" in table.columns
        assert table.columns["golden_id"].primary_key
        assert "tenant_id" in table.columns
        assert "cluster_size" in table.columns
        assert "attributes" in table.columns

    def test_er_candidate_schema(self):
        """er_candidates table columns and constraints."""
        table = Base.metadata.tables["er_candidates"]
        assert "id" in table.columns
        assert table.columns["id"].primary_key
        assert "tenant_id" in table.columns
        assert "confidence_score" in table.columns
        assert "status" in table.columns

    def test_provenance_schema(self):
        """provenance table columns and constraints."""
        table = Base.metadata.tables["provenance"]
        assert "id" in table.columns
        assert table.columns["id"].primary_key
        assert "golden_id" in table.columns
        assert "attribute_name" in table.columns
        assert "source_record_id" in table.columns


class TestAlembicMigrations:
    """Test suite for running Alembic migration upgrades and downgrades."""

    def test_get_alembic_config(self):
        """get_alembic_config locates alembic.ini and loads configuration."""
        cfg = get_alembic_config()
        assert cfg is not None
        assert cfg.get_main_option("script_location") == "alembic"

    def test_run_migrations_upgrade_and_downgrade(self, tmp_path):
        """Alembic migrations upgrade to head and downgrade to base cleanly."""
        db_file = tmp_path / "migration_test.db"
        db_url = f"sqlite:///{db_file}"

        # 1. Run migrations up to head
        run_migrations(db_url=db_url, target_revision="head")

        engine = create_engine(db_url, poolclass=StaticPool)
        inspector = inspect(engine)
        tables_after_upgrade = set(inspector.get_table_names())

        assert "alembic_version" in tables_after_upgrade
        assert "staging_records" in tables_after_upgrade
        assert "golden_records" in tables_after_upgrade
        assert "er_candidates" in tables_after_upgrade
        assert "provenance" in tables_after_upgrade

        engine.dispose()

        # 2. Run downgrade back to base
        run_downgrade(db_url=db_url, target_revision="base")

        engine = create_engine(db_url, poolclass=StaticPool)
        inspector = inspect(engine)
        tables_after_downgrade = set(inspector.get_table_names())

        # Operational tables must be dropped
        assert "staging_records" not in tables_after_downgrade
        assert "golden_records" not in tables_after_downgrade
        assert "er_candidates" not in tables_after_downgrade
        assert "provenance" not in tables_after_downgrade

        engine.dispose()

    def test_ensure_tables_exist_idempotent(self, tmp_path):
        """ensure_tables_exist creates all tables and is safely idempotent."""
        db_file = tmp_path / "ensure_test.db"
        engine = create_engine(f"sqlite:///{db_file}", poolclass=StaticPool)

        # First call creates tables
        ensure_tables_exist(engine)
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        assert {"staging_records", "golden_records", "er_candidates", "provenance"}.issubset(tables)

        # Second call does not error out
        ensure_tables_exist(engine)
        inspector = inspect(engine)
        assert tables == set(inspector.get_table_names())

        engine.dispose()
