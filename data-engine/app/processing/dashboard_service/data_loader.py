"""Database querying and record loading utilities for dashboard analytics."""

from __future__ import annotations

import json
import logging
import os
import re
import sqlite3
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Tuple
import uuid

import polars as pl
from sqlalchemy import inspect, text

from app.db.tenant import (
    is_postgres_conn,
    reset_pg_search_path,
    resolve_table_schema,
    resolve_tenant_pg_context,
    set_pg_search_path,
)

logger = logging.getLogger(__name__)


def _infer_target_table(sql: str) -> str | None:
    m = re.search(r"\bFROM\s+([a-zA-Z_][a-zA-Z0-9_]*)", sql, re.IGNORECASE)
    return m.group(1) if m else None


def _adapt_pg_params(conn, sql: str, params: Dict[str, Any]) -> Dict[str, Any]:
    """Resolve tenant search_path and coerce ``tenant_id`` to UUID when targeting Flyway UUID columns."""
    adapted = dict(params or {})
    t_val = adapted.get("tenant_id")
    if not t_val or not is_postgres_conn(conn):
        return adapted

    tenant_ctx = resolve_tenant_pg_context(conn, str(t_val))
    target_table = _infer_target_table(sql)
    found_schema = tenant_ctx["schema_name"]
    if target_table:
        inspected_schema, _ = resolve_table_schema(
            conn,
            target_table,
            preferred_schemas=[tenant_ctx["schema_name"], "tenant_default", "public"],
        )
        if inspected_schema:
            found_schema = inspected_schema
            try:
                cols = inspect(conn).get_columns(target_table, schema=inspected_schema)
                t_col = next((c for c in cols if c["name"] == "tenant_id"), None)
                if t_col and "UUID" in str(t_col.get("type", "")).upper():
                    adapted["tenant_id"] = tenant_ctx["tenant_uuid"]
            except Exception:
                pass
    set_pg_search_path(conn, found_schema)
    return adapted


def get_pg_engine():
    """Return the shared SQLAlchemy PostgreSQL engine."""
    from app.db import get_engine

    return get_engine()


def query_pg_scalar(sql: str, params: Dict[str, Any]) -> Any:
    """Execute a parameterized scalar query against PostgreSQL with tenant schema resolution."""
    try:
        engine = get_pg_engine()
        with engine.connect() as conn:
            adapted_params = _adapt_pg_params(conn, sql, params)
            try:
                result = conn.execute(text(sql), adapted_params)
                row = result.fetchone()
                return row[0] if row else None
            finally:
                reset_pg_search_path(conn)
    except Exception as exc:
        logger.debug("PostgreSQL scalar query failed: %s", exc)
        return None


def query_pg_rows(sql: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Execute a parameterized query and return all rows as dicts with tenant schema resolution."""
    try:
        engine = get_pg_engine()
        with engine.connect() as conn:
            adapted_params = _adapt_pg_params(conn, sql, params)
            try:
                result = conn.execute(text(sql), adapted_params)
                return [dict(row._mapping) for row in result]
            finally:
                reset_pg_search_path(conn)
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
    """Load golden records for the tenant into a normalized Polars DataFrame."""
    records: List[Dict[str, Any]] = []

    # Try PostgreSQL first (resolving tenant_{slug} schema & Flyway/Alembic columns)
    try:
        engine = get_pg_engine()
        with engine.connect() as conn:
            tenant_ctx = resolve_tenant_pg_context(conn, tenant_id)
            found_schema, cols = resolve_table_schema(
                conn,
                "golden_records",
                preferred_schemas=[tenant_ctx["schema_name"], "tenant_default", "public"],
            )
            if cols:
                set_pg_search_path(conn, found_schema)
                try:
                    result = conn.execute(
                        text(
                            "SELECT * FROM golden_records "
                            "WHERE tenant_id::text IN (:t_raw, :t_slug, :t_uuid)"
                        ),
                        {
                            "t_raw": tenant_ctx["tenant_raw"],
                            "t_slug": tenant_ctx["tenant_slug"],
                            "t_uuid": tenant_ctx["tenant_uuid"],
                        },
                    )
                    for row in result.mappings():
                        records.append(dict(row))
                finally:
                    reset_pg_search_path(conn)
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

    # Normalize rows across Flyway (id, properties, source_count) & Alembic schemas
    normalized: List[Dict[str, Any]] = []
    for r in records:
        row: Dict[str, Any] = {}
        for k, v in r.items():
            if isinstance(v, datetime):
                row[k] = v.isoformat()
            elif isinstance(v, uuid.UUID):
                row[k] = str(v)
            elif isinstance(v, Decimal):
                row[k] = float(v)
            elif isinstance(v, (dict, list)):
                row[k] = json.dumps(v)
            else:
                row[k] = v
        if "properties" in row and "attributes" not in row:
            row["attributes"] = row["properties"]
        if "id" in row and "golden_id" not in row:
            row["golden_id"] = row["id"]
        if "source_count" in row and "cluster_size" not in row:
            row["cluster_size"] = row["source_count"]
        normalized.append(row)

    return pl.DataFrame(
        normalized,
        infer_schema_length=None,
        schema_overrides={
            "updated_at": pl.Utf8,
            "created_at": pl.Utf8,
        },
    )
