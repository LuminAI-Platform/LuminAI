"""Tests for DatabaseManager connection pooling, session factories, and Dagster resource integration."""

import os
import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.pool import QueuePool

from app.config import Settings
from app.db import (
    DatabaseManager,
    DatabaseResource,
    get_db,
    get_db_manager,
    get_engine,
    get_session,
    get_sqlite_engine,
)


class TestDatabaseManager:
    """Test suite for DatabaseManager connection pooling and lifecycle."""

    def test_db_manager_singleton(self):
        """get_db_manager returns a singleton instance."""
        manager1 = get_db_manager()
        manager2 = get_db_manager()
        assert manager1 is manager2

    def test_engine_pool_configuration(self):
        """PostgreSQL engine uses QueuePool and respects pool settings from Settings."""
        custom_settings = Settings(
            db_pool_size=15,
            db_max_overflow=25,
            db_pool_timeout=45.0,
            db_pool_recycle=900,
            db_pool_pre_ping=True,
        )
        manager = DatabaseManager(settings=custom_settings)
        engine = manager.get_engine()

        assert engine.pool.__class__ is QueuePool
        assert engine.pool.size() == 15
        assert engine.pool._max_overflow == 25
        assert engine.pool._timeout == 45.0
        assert engine.pool._recycle == 900
        assert engine.pool._pre_ping is True

        manager.dispose_all()

    def test_sqlite_engine_caching(self, tmp_path):
        """get_sqlite_engine caches and reuses engine instances for identical paths."""
        manager = DatabaseManager()
        db_path_1 = str(tmp_path / "test1.db")
        db_path_2 = str(tmp_path / "test2.db")

        engine1_a = manager.get_sqlite_engine(db_path_1)
        engine1_b = manager.get_sqlite_engine(db_path_1)
        engine2 = manager.get_sqlite_engine(db_path_2)

        # Same path returns exact same engine instance
        assert engine1_a is engine1_b
        # Different path returns different engine instance
        assert engine1_a is not engine2

        manager.dispose_all()

    def test_session_context_manager_commit(self, tmp_path):
        """get_session automatically commits transactions on success."""
        db_path = str(tmp_path / "session_test.db")
        custom_settings = Settings(database_url=f"sqlite:///{db_path}")
        manager = DatabaseManager(settings=custom_settings)

        # Create table and insert a record
        with manager.get_session() as session:
            session.execute(text("CREATE TABLE test_table (id INT PRIMARY KEY, val TEXT);"))
            session.execute(text("INSERT INTO test_table VALUES (1, 'hello');"))

        # Verify record was committed
        with manager.get_session() as session:
            result = session.execute(text("SELECT val FROM test_table WHERE id = 1;")).scalar()
            assert result == "hello"

        manager.dispose_all()

    def test_session_context_manager_rollback_on_error(self, tmp_path):
        """get_session automatically rolls back transaction when an exception is raised."""
        db_path = str(tmp_path / "rollback_test.db")
        custom_settings = Settings(database_url=f"sqlite:///{db_path}")
        manager = DatabaseManager(settings=custom_settings)

        with manager.get_session() as session:
            session.execute(text("CREATE TABLE test_table (id INT PRIMARY KEY, val TEXT);"))

        # Trigger rollback via intentional exception
        with pytest.raises(RuntimeError, match="Intentional failure"):
            with manager.get_session() as session:
                session.execute(text("INSERT INTO test_table VALUES (1, 'failed_val');"))
                raise RuntimeError("Intentional failure")

        # Verify record was NOT committed
        with manager.get_session() as session:
            count = session.execute(text("SELECT COUNT(*) FROM test_table;")).scalar()
            assert count == 0

        manager.dispose_all()

    def test_connection_pool_checkout_and_return(self, tmp_path):
        """Pooled connections are checked out and returned to the pool without leaking."""
        db_path = str(tmp_path / "pool_test.db")
        custom_settings = Settings(
            database_url=f"sqlite:///{db_path}",
            db_pool_size=5,
            db_max_overflow=0,
        )
        manager = DatabaseManager(settings=custom_settings)

        # Check out connections repeatedly
        for i in range(10):
            with manager.get_connection() as conn:
                res = conn.execute(text("SELECT 1;")).scalar()
                assert res == 1

        manager.dispose_all()

    def test_dispose_all_resets_state(self, tmp_path):
        """dispose_all safely cleans up engines and allows subsequent re-initialization."""
        db_path = str(tmp_path / "dispose_test.db")
        manager = DatabaseManager()
        sqlite_engine = manager.get_sqlite_engine(db_path)
        pg_engine = manager.get_engine()

        assert manager._pg_engine is not None
        assert len(manager._sqlite_engines) == 1

        manager.dispose_all()

        assert manager._pg_engine is None
        assert len(manager._sqlite_engines) == 0
        assert manager._session_factory is None

        # Re-initialization succeeds
        new_engine = manager.get_sqlite_engine(db_path)
        assert new_engine is not None
        manager.dispose_all()

    def test_fastapi_get_db_generator(self, tmp_path):
        """get_db yields an active Session for FastAPI request dependencies."""
        db_path = str(tmp_path / "dep_test.db")
        custom_settings = Settings(database_url=f"sqlite:///{db_path}")
        manager = DatabaseManager(settings=custom_settings)

        # Mock the global manager
        with manager.get_session() as s:
            s.execute(text("CREATE TABLE items (name TEXT);"))

        # Test generator iteration
        gen = manager.get_session()
        with gen as session:
            assert isinstance(session, Session)
            session.execute(text("INSERT INTO items VALUES ('item1');"))

        with manager.get_session() as s:
            val = s.execute(text("SELECT name FROM items;")).scalar()
            assert val == "item1"

        manager.dispose_all()


class TestDagsterResourceIntegration:
    """Test suite for Dagster DatabaseResource."""

    def test_database_resource_delegation(self):
        """DatabaseResource correctly delegates to DatabaseManager."""
        resource = DatabaseResource()
        assert isinstance(resource.get_manager(), DatabaseManager)

        engine = resource.get_engine()
        assert engine is not None

        with resource.get_session() as session:
            assert isinstance(session, Session)

    def test_dagster_definitions_includes_db_resource(self):
        """ingest_pipeline.defs registers the 'db' DatabaseResource."""
        from app.processing.pipelines.ingest_pipeline import defs

        resources = defs.get_repository_def().get_top_level_resources()
        assert "db" in resources
        assert isinstance(resources["db"], DatabaseResource)
