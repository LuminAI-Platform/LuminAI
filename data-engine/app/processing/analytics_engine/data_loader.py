"""Data loading and schema normalization routines for DuckDB Analytics Engine."""

from __future__ import annotations

import json
import logging
import os
from decimal import Decimal
from typing import Any, Dict, List, Optional
import uuid

import polars as pl
from sqlalchemy import text

from app.db.tenant import (
    reset_pg_search_path,
    resolve_table_schema,
    resolve_tenant_pg_context,
    set_pg_search_path,
)

logger = logging.getLogger(__name__)


def _serialize_pg_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize SQLAlchemy/PostgreSQL values (dict, Decimal, UUID, datetime) for Polars."""
    out: Dict[str, Any] = {}
    for k, v in row.items():
        if isinstance(v, uuid.UUID):
            out[k] = str(v)
        elif isinstance(v, Decimal):
            out[k] = float(v)
        elif isinstance(v, (dict, list)):
            out[k] = json.dumps(v)
        else:
            out[k] = v
    return out


def get_pg_engine():
    """Return pooled SQLAlchemy engine for PostgreSQL."""
    from app.db import get_engine

    return get_engine()


def normalize_dataframe(df: pl.DataFrame, target_table: str) -> pl.DataFrame:
    """Normalize dataframe columns across PostgreSQL (Flyway) and SQLite/Alembic schemas."""
    cols = df.columns
    if not cols:
        return df

    # Ensure JSON columns parsed as Struct/Object become UTF-8 JSON strings for DuckDB json_extract
    json_str_exprs = []
    for json_col in ("attributes", "properties", "data"):
        if json_col in cols and df.schema[json_col] not in (pl.Utf8, pl.String):
            if df.schema[json_col] == pl.Object:
                serialized = [
                    json.dumps(v) if isinstance(v, (dict, list)) else (None if v is None else str(v))
                    for v in df[json_col].to_list()
                ]
                json_str_exprs.append(pl.Series(json_col, serialized, dtype=pl.Utf8))
            else:
                json_str_exprs.append(pl.col(json_col).cast(pl.Utf8).alias(json_col))
    if json_str_exprs:
        df = df.with_columns(json_str_exprs)
        cols = df.columns

    exprs = []
    if "golden" in target_table.lower():
        if "properties" in cols and "attributes" not in cols:
            exprs.append(pl.col("properties").cast(pl.Utf8).alias("attributes"))
        elif "attributes" in cols and "properties" not in cols:
            exprs.append(pl.col("attributes").cast(pl.Utf8).alias("properties"))

        if "id" in cols and "golden_id" not in cols:
            exprs.append(pl.col("id").cast(pl.Utf8).alias("golden_id"))
        elif "golden_id" in cols and "id" not in cols:
            exprs.append(pl.col("golden_id").cast(pl.Utf8).alias("id"))

    if "entity_type" not in cols:
        exprs.append(pl.lit("").alias("entity_type"))

    if exprs:
        df = df.with_columns(exprs)
    return df


def load_table_dataframe(
    table_name: str,
    tenant_id: str,
    override_df: Optional[pl.DataFrame] = None,
) -> pl.DataFrame:
    """Load records for the requested tenant from PostgreSQL (Flyway/Alembic) or SQLite fallback."""
    target_table = (
        "golden_records" if "golden" in table_name.lower() else "staging_records"
    )
    if override_df is not None:
        return normalize_dataframe(override_df, target_table)

    records: List[Dict[str, Any]] = []

    # 1. Try PostgreSQL (with tenant schema search_path + Flyway UUID/slug support)
    try:
        engine = get_pg_engine()
        with engine.connect() as conn:
            tenant_ctx = resolve_tenant_pg_context(conn, tenant_id)
            found_schema, cols = resolve_table_schema(
                conn,
                target_table,
                preferred_schemas=[tenant_ctx["schema_name"], "tenant_default", "public"],
            )
            if cols:
                set_pg_search_path(conn, found_schema)
                try:
                    query = text(
                        f"SELECT * FROM {target_table} "
                        "WHERE tenant_id::text IN (:t_raw, :t_slug, :t_uuid)"
                    )
                    result = conn.execute(
                        query,
                        {
                            "t_raw": tenant_ctx["tenant_raw"],
                            "t_slug": tenant_ctx["tenant_slug"],
                            "t_uuid": tenant_ctx["tenant_uuid"],
                        },
                    )
                    for row in result.mappings():
                        records.append(_serialize_pg_row(dict(row)))
                finally:
                    reset_pg_search_path(conn)
        if records:
            logger.debug(
                "Loaded %d rows for tenant %s from PostgreSQL %s",
                len(records),
                tenant_id,
                target_table,
            )
            return normalize_dataframe(pl.DataFrame(records, infer_schema_length=None), target_table)
    except Exception as exc:
        logger.debug("PostgreSQL query failed (%s). Checking SQLite fallback.", exc)

    # 2. Try SQLite Fallback
    from app.db import get_sqlite_engine

    sqlite_candidates = (
        [
            os.path.join("storage", "sqlite", "er_staging.db"),
            os.path.join("storage", "sqlite", "staging.db"),
        ]
        if target_table == "golden_records"
        else [
            os.path.join("storage", "sqlite", "staging.db"),
            os.path.join("storage", "sqlite", "er_staging.db"),
        ]
    )

    for sqlite_path in sqlite_candidates:
        if os.path.exists(sqlite_path):
            try:
                sqlite_engine = get_sqlite_engine(sqlite_path)
                with sqlite_engine.connect() as conn:
                    query = text(
                        f"SELECT * FROM {target_table} WHERE tenant_id = :tenant_id"
                    )
                    result = conn.execute(query, {"tenant_id": tenant_id})
                    for row in result.mappings():
                        records.append(dict(row))
                if records:
                    logger.debug(
                        "Loaded %d rows for tenant %s from SQLite %s",
                        len(records),
                        tenant_id,
                        sqlite_path,
                    )
                    return normalize_dataframe(pl.DataFrame(records), target_table)
            except Exception as sqle:
                logger.debug("SQLite check failed for %s: %s", sqlite_path, sqle)

    # If no records found, return an empty DataFrame with expected schema
    if target_table == "golden_records":
        return pl.DataFrame(
            schema={
                "golden_id": pl.Utf8,
                "tenant_id": pl.Utf8,
                "cluster_size": pl.Int64,
                "source_record_ids": pl.Utf8,
                "attributes": pl.Utf8,
                "created_at": pl.Datetime,
            }
        )
    else:
        return pl.DataFrame(
            schema={
                "id": pl.Utf8,
                "tenant_id": pl.Utf8,
                "source_id": pl.Utf8,
                "raw_id": pl.Utf8,
                "data": pl.Utf8,
                "staged_at": pl.Datetime,
            }
        )
