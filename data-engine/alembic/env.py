"""Alembic environment configuration."""

import os
import sys
from logging.config import fileConfig

from sqlalchemy import pool
from alembic import context

# Ensure app package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import get_settings
from app.db.models import Base
from app.db.session import get_db_manager

# Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    """Return configured database URL, preferring dynamic app settings."""
    settings = get_settings()
    custom_url = config.get_main_option("sqlalchemy.url")
    if custom_url and custom_url != "postgresql+pg8000://luminai:luminai@localhost:5432/luminai":
        return custom_url
    return settings.postgres_driver_dsn


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    # Check if a connection was explicitly passed in attributes (e.g. from tests or programmatic runner)
    provided_connection = config.attributes.get("connection", None)

    if provided_connection is not None:
        context.configure(
            connection=provided_connection,
            target_metadata=target_metadata,
            render_as_batch=True,
        )
        with context.begin_transaction():
            context.run_migrations()
        return

    # Otherwise, retrieve or create the engine
    url = get_url()
    if url.startswith("sqlite"):
        from sqlalchemy import create_engine
        connectable = create_engine(url, poolclass=pool.StaticPool)
    else:
        connectable = get_db_manager().get_engine()

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
