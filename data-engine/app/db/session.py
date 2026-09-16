"""Database connection pooling and session management module.

Provides a thread-safe singleton DatabaseManager that pools SQLAlchemy connections
using QueuePool with configurable sizing, timeouts, and connection recycling.
"""

from __future__ import annotations

import os
import threading
from contextlib import contextmanager
from functools import lru_cache
from typing import Dict, Generator, Optional

from sqlalchemy import Connection, Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import QueuePool

from app.config import Settings, get_settings
import structlog

logger = structlog.get_logger(__name__)


class DatabaseManager:
    """Manages pooled SQLAlchemy engines and session factories.

    Ensures that connections are pooled and reused across API endpoints, Dagster assets,
    and background worker routines without creating or disposing engines ad-hoc.
    """

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings: Settings = settings or get_settings()
        self._pg_engine: Optional[Engine] = None
        self._sqlite_engines: Dict[str, Engine] = {}
        self._session_factory: Optional[sessionmaker[Session]] = None
        self._lock = threading.RLock()

    def get_engine(self) -> Engine:
        """Return the shared singleton PostgreSQL engine with QueuePool pooling.

        Configured using settings for pool_size, max_overflow, pool_timeout,
        pool_recycle, and pool_pre_ping.
        """
        if self._pg_engine is None:
            with self._lock:
                if self._pg_engine is None:
                    db_url = self.settings.postgres_driver_dsn
                    if db_url.startswith("sqlite"):
                        from sqlalchemy.pool import StaticPool
                        self._pg_engine = create_engine(
                            db_url,
                            connect_args={"check_same_thread": False},
                            poolclass=StaticPool,
                        )
                    else:
                        logger.info(
                            "Initializing pooled PostgreSQL engine",
                            pool_size=self.settings.db_pool_size,
                            max_overflow=self.settings.db_max_overflow,
                            pool_timeout=self.settings.db_pool_timeout,
                            pool_recycle=self.settings.db_pool_recycle,
                        )
                        self._pg_engine = create_engine(
                            db_url,
                            poolclass=QueuePool,
                            pool_size=self.settings.db_pool_size,
                            max_overflow=self.settings.db_max_overflow,
                            pool_timeout=self.settings.db_pool_timeout,
                            pool_recycle=self.settings.db_pool_recycle,
                            pool_pre_ping=self.settings.db_pool_pre_ping,
                        )
        return self._pg_engine

    def get_sqlite_engine(self, sqlite_path: str) -> Engine:
        """Return a cached, persistent SQLite engine for the given database file.

        Avoids repeatedly tearing down SQLite connections and file handles.
        """
        norm_path = os.path.abspath(sqlite_path)
        if norm_path not in self._sqlite_engines:
            with self._lock:
                if norm_path not in self._sqlite_engines:
                    os.makedirs(os.path.dirname(norm_path), exist_ok=True)
                    logger.debug("Initializing persistent SQLite engine", path=norm_path)
                    engine = create_engine(
                        f"sqlite:///{norm_path}",
                        connect_args={"check_same_thread": False},
                        pool_pre_ping=True,
                    )
                    self._sqlite_engines[norm_path] = engine
        return self._sqlite_engines[norm_path]

    def get_session_factory(self) -> sessionmaker[Session]:
        """Return a thread-safe sessionmaker bound to the pooled PostgreSQL engine."""
        if self._session_factory is None:
            engine = self.get_engine()
            with self._lock:
                if self._session_factory is None:
                    self._session_factory = sessionmaker(
                        bind=engine,
                        autoflush=False,
                        expire_on_commit=False,
                    )
        return self._session_factory

    @contextmanager
    def get_session(self) -> Generator[Session, None, None]:
        """Context manager providing an active Session with automatic commit/rollback."""
        session = self.get_session_factory()()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    @contextmanager
    def get_connection(self) -> Generator[Connection, None, None]:
        """Context manager checking out a pooled connection from the engine."""
        engine = self.get_engine()
        with engine.connect() as conn:
            yield conn

    def dispose_all(self) -> None:
        """Gracefully close and dispose of all active connection pools."""
        with self._lock:
            if self._pg_engine is not None:
                logger.info("Disposing PostgreSQL connection pool")
                self._pg_engine.dispose()
                self._pg_engine = None

            for path, sqlite_engine in self._sqlite_engines.items():
                logger.debug("Disposing SQLite engine", path=path)
                sqlite_engine.dispose()
            self._sqlite_engines.clear()

            self._session_factory = None


@lru_cache(maxsize=1)
def get_db_manager() -> DatabaseManager:
    """Return the cached singleton DatabaseManager instance."""
    return DatabaseManager()


def get_engine() -> Engine:
    """Convenience helper to retrieve the pooled PostgreSQL engine."""
    return get_db_manager().get_engine()


def get_sqlite_engine(sqlite_path: str) -> Engine:
    """Convenience helper to retrieve a persistent SQLite engine."""
    return get_db_manager().get_sqlite_engine(sqlite_path)


def get_session():
    """Convenience context manager yielding an ORM session."""
    return get_db_manager().get_session()


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a database session per request."""
    with get_db_manager().get_session() as session:
        yield session
