"""Database querying and record loading utilities for dashboard analytics."""

from __future__ import annotations

import json
import logging
import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Tuple

import polars as pl
from sqlalchemy import text

logger = logging.getLogger(__name__)


def get_pg_engine():
    """Return the shared SQLAlchemy PostgreSQL engine."""
    from app.db import get_engine

    return get_engine()


def query_pg_scalar(sql: str, params: Dict[str, Any]) -> Any:
    """Execute a parameterized scalar query against PostgreSQL."""
    try:
        engine = get_pg_engine()
        with engine.connect() as conn:
            result = conn.execute(text(sql), params)
            row = result.fetchone()
            return row[0] if row else None
    except Exception as exc:
        logger.debug("PostgreSQL scalar query failed: %s", exc)
        return None


def query_pg_rows(sql: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Execute a parameterized query and return all rows as dicts."""
    try:
        engine = get_pg_engine()
        with engine.connect() as conn:
            result = conn.execute(text(sql), params)
            return [dict(row._mapping) for row in result]
    except Exception as exc:
        logger.debug("PostgreSQL row query failed: %s", exc)
        return []


def get_run_storage_path() -> str:
    """Return the path to the SQLite run-storage database."""
    return os.path.join("storage", "sqlite", "run_storage.db")


def query_sqlite_runs(sql: str, params: Tuple[Any, ...]) -> List[sqlite3.Row]:
    """Execute a parameterized read query against the SQLite run tracker DB."""
    db_path = get_run_storage_path()
    if not os.path.exists(db_path):
        return []
    try:
        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.execute(sql, params)
            return cur.fetchall()
    except Exception as exc:
        logger.debug("SQLite run query failed: %s", exc)
        return []


def query_sqlite_scalar(sql: str, params: Tuple[Any, ...]) -> Any:
    """Execute a parameterized scalar query against SQLite run storage."""
    db_path = get_run_storage_path()
    if not os.path.exists(db_path):
        return None
    try:
        with sqlite3.connect(db_path) as conn:
            cur = conn.execute(sql, params)
            row = cur.fetchone()
            return row[0] if row else None
    except Exception as exc:
        logger.debug("SQLite scalar query failed: %s", exc)
        return None


def load_golden_records_df(tenant_id: str) -> pl.DataFrame:
    """Load golden records for the tenant into a Polars DataFrame."""
    records: List[Dict[str, Any]] = []

    # Try PostgreSQL first
    try:
        engine = get_pg_engine()
        with engine.connect() as conn:
            result = conn.execute(
                text("SELECT * FROM golden_records WHERE tenant_id = :tenant_id"),
                {"tenant_id": tenant_id},
            )
            for row in result.mappings():
                records.append(dict(row))
    except Exception as exc:
        logger.debug("PostgreSQL golden records query failed: %s", exc)

    # Fallback to SQLite
    if not records:
        from app.db import get_sqlite_engine

        for path in (
            os.path.join("storage", "sqlite", "er_staging.db"),
            os.path.join("storage", "sqlite", "staging.db"),
        ):
            if os.path.exists(path):
                try:
                    sqlite_engine = get_sqlite_engine(path)
                    with sqlite_engine.connect() as conn:
                        result = conn.execute(
                            text(
                                "SELECT * FROM golden_records WHERE tenant_id = :tenant_id"
                            ),
                            {"tenant_id": tenant_id},
                        )
                        for row in result.mappings():
                            records.append(dict(row))
                    if records:
                        break
                except Exception as exc:
                    logger.debug("SQLite fallback failed for %s: %s", path, exc)

    if not records:
        return pl.DataFrame(
            schema={
                "golden_id": pl.Utf8,
                "tenant_id": pl.Utf8,
                "cluster_size": pl.Int64,
                "source_record_ids": pl.Utf8,
                "attributes": pl.Utf8,
                "created_at": pl.Utf8,
                "updated_at": pl.Utf8,
            }
        )

    # Normalize rows to ensure uniform datatypes
    normalized: List[Dict[str, Any]] = []
    for r in records:
        row = dict(r)
        for k, v in row.items():
            if isinstance(v, datetime):
                row[k] = v.isoformat()
            elif isinstance(v, (dict, list)):
                row[k] = json.dumps(v)
        normalized.append(row)

    return pl.DataFrame(
        normalized,
        infer_schema_length=None,
        schema_overrides={
            "updated_at": pl.Utf8,
            "created_at": pl.Utf8,
        },
    )
