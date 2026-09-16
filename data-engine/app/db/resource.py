"""Dagster resource providing access to pooled SQLAlchemy database connections."""

from __future__ import annotations

from dagster import ConfigurableResource
from sqlalchemy import Engine

from app.db.session import DatabaseManager, get_db_manager


class DatabaseResource(ConfigurableResource):
    """Dagster resource providing pooled database connections to pipeline assets."""

    def get_manager(self) -> DatabaseManager:
        """Return the singleton DatabaseManager."""
        return get_db_manager()

    def get_engine(self) -> Engine:
        """Return the shared pooled PostgreSQL engine."""
        return self.get_manager().get_engine()

    def get_sqlite_engine(self, sqlite_path: str) -> Engine:
        """Return a persistent SQLite engine."""
        return self.get_manager().get_sqlite_engine(sqlite_path)

    def get_session(self):
        """Context manager yielding a transactional Session."""
        return self.get_manager().get_session()
