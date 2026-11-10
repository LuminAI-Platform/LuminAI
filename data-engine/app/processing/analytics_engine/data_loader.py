"""Data loading and schema normalization routines for DuckDB Analytics Engine."""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

import polars as pl
from sqlalchemy import text

logger = logging.getLogger(__name__)


def get_pg_engine():
    """Return pooled SQLAlchemy engine for PostgreSQL."""
    from app.db import get_engine

    return get_engine()


def normalize_dataframe(df: pl.DataFrame, target_table: str) -> pl.DataFrame:
    """Normalize dataframe columns across PostgreSQL and SQLite schema variations."""
    cols = df.columns
    if not cols:
        return df
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
    """Load records for the requested tenant from PostgreSQL or SQLite fallback."""
    target_table = (
        "golden_records" if "golden" in table_name.lower() else "staging_records"
    )
    if override_df is not None:
        return normalize_dataframe(override_df, target_table)

    records: List[Dict[str, Any]] = []

    # 1. Try PostgreSQL
    try:
        engine = get_pg_engine()
        with engine.connect() as conn:
            query = text(
                f"SELECT * FROM {target_table} WHERE tenant_id = :tenant_id"
            )
            result = conn.execute(query, {"tenant_id": tenant_id})
            for row in result.mappings():
                records.append(dict(row))
        if records:
            logger.debug(
                "Loaded %d rows for tenant %s from PostgreSQL %s",
                len(records),
                tenant_id,
                target_table,
            )
            return normalize_dataframe(pl.DataFrame(records), target_table)
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
