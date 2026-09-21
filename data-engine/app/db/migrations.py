"""Database migration management utilities for LuminAI Data Engine."""

from __future__ import annotations

import os
from typing import Optional

from alembic import command
from alembic.config import Config
from sqlalchemy import Engine
import structlog

from app.config import get_settings
from app.db.models import Base
from app.db.session import get_db_manager

logger = structlog.get_logger(__name__)


def get_alembic_config(db_url: Optional[str] = None) -> Config:
    """Return configured Alembic Config instance."""
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ini_path = os.path.join(base_dir, "alembic.ini")

    if not os.path.exists(ini_path):
        raise FileNotFoundError(f"Alembic configuration file not found at {ini_path}")

    alembic_cfg = Config(ini_path)
    if db_url:
        alembic_cfg.set_main_option("sqlalchemy.url", db_url)
    return alembic_cfg


def run_migrations(
    db_url: Optional[str] = None,
    target_revision: str = "head",
    engine: Optional[Engine] = None,
) -> None:
    """Run Alembic database migrations up to the target revision (default: head)."""
    settings = get_settings()
    url = db_url or (engine.url.render_as_string(hide_password=False) if engine else settings.postgres_driver_dsn)

    logger.info("Running database migrations", target_revision=target_revision)
    alembic_cfg = get_alembic_config(url)

    if engine is not None:
        with engine.begin() as connection:
            alembic_cfg.attributes["connection"] = connection
            command.upgrade(alembic_cfg, target_revision)
    else:
        command.upgrade(alembic_cfg, target_revision)

    logger.info("Database migrations complete", target_revision=target_revision)


def run_downgrade(
    target_revision: str = "base",
    db_url: Optional[str] = None,
    engine: Optional[Engine] = None,
) -> None:
    """Downgrade Alembic database migrations down to target revision (default: base)."""
    settings = get_settings()
    url = db_url or (engine.url.render_as_string(hide_password=False) if engine else settings.postgres_driver_dsn)

    logger.info("Rolling back database migrations", target_revision=target_revision)
    alembic_cfg = get_alembic_config(url)

    if engine is not None:
        with engine.begin() as connection:
            alembic_cfg.attributes["connection"] = connection
            command.downgrade(alembic_cfg, target_revision)
    else:
        command.downgrade(alembic_cfg, target_revision)

    logger.info("Database rollback complete", target_revision=target_revision)


def ensure_tables_exist(engine: Optional[Engine] = None) -> None:
    """Ensure all declarative tables exist on the specified or default engine.

    Used by pipelines and test environments to guarantee table availability
    without requiring manual migration commands.
    """
    target_engine = engine or get_db_manager().get_engine()
    Base.metadata.create_all(bind=target_engine)

    # Align pre-existing golden_records table columns if needed
    try:
        from sqlalchemy import inspect, text
        inspector = inspect(target_engine)
        if "golden_records" in inspector.get_table_names():
            columns = {col["name"] for col in inspector.get_columns("golden_records")}
            with target_engine.begin() as conn:
                if "version" not in columns:
                    conn.execute(text("ALTER TABLE golden_records ADD COLUMN version INTEGER DEFAULT 1 NOT NULL"))
                if "updated_at" not in columns:
                    conn.execute(text("ALTER TABLE golden_records ADD COLUMN updated_at DATETIME"))
    except Exception as exc:
        logger.debug("Schema alignment notice: %s", exc)

    logger.debug("Ensured database tables exist", engine=str(target_engine.url))
