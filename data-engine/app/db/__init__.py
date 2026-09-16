"""Database package providing connection pooling, session factories, and Dagster resources."""

from app.db.session import (
    DatabaseManager,
    get_db,
    get_db_manager,
    get_engine,
    get_session,
    get_sqlite_engine,
)
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

__all__ = [
    "DatabaseManager",
    "DatabaseResource",
    "get_db",
    "get_db_manager",
    "get_engine",
    "get_session",
    "get_sqlite_engine",
    "Base",
    "StagingRecord",
    "GoldenRecord",
    "ERCandidate",
    "ProvenanceRecord",
    "run_migrations",
    "run_downgrade",
    "ensure_tables_exist",
    "get_alembic_config",
]
