"""Data quality score computation routines using DuckDB and Polars."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict

import duckdb
import polars as pl

logger = logging.getLogger(__name__)


def compute_completeness(df: pl.DataFrame, total_rows: int) -> float:
    """Completeness: percentage of golden records with non-empty attributes."""
    if total_rows == 0:
        return 0.0

    con = duckdb.connect()
    try:
        con.register("golden", df)
        result = con.execute(
            """
            SELECT COUNT(*) FROM golden
            WHERE attributes IS NOT NULL
              AND LENGTH(TRIM(attributes)) > 2
            """
        ).fetchone()
        non_empty = int(result[0]) if result else 0
        return round((non_empty / total_rows) * 100, 1)
    finally:
        con.close()


def compute_uniqueness(df: pl.DataFrame, total_rows: int) -> float:
    """Uniqueness: percentage of distinct golden_id values (detecting duplicates)."""
    if total_rows == 0:
        return 0.0

    con = duckdb.connect()
    try:
        con.register("golden", df)
        result = con.execute("SELECT COUNT(DISTINCT golden_id) FROM golden").fetchone()
        distinct = int(result[0]) if result else 0
        return round((distinct / total_rows) * 100, 1)
    finally:
        con.close()


def compute_consistency(df: pl.DataFrame, total_rows: int) -> float:
    """Consistency: percentage of records with valid, parseable JSON attributes."""
    if total_rows == 0:
        return 0.0

    valid_count = 0
    attrs_col = "attributes"
    if attrs_col in df.columns:
        for val in df[attrs_col].to_list():
            if val and isinstance(val, str):
                try:
                    parsed = json.loads(val)
                    if isinstance(parsed, dict) and len(parsed) > 0:
                        valid_count += 1
                except (json.JSONDecodeError, TypeError):
                    continue
            elif isinstance(val, dict) and len(val) > 0:
                valid_count += 1

    return round((valid_count / total_rows) * 100, 1)


def compute_timeliness(df: pl.DataFrame, total_rows: int) -> float:
    """Timeliness: percentage of records updated within the last 30 days."""
    if total_rows == 0:
        return 0.0

    now = datetime.now(timezone.utc)
    timely_count = 0

    ts_col = "updated_at" if "updated_at" in df.columns else "created_at"
    if ts_col not in df.columns:
        return 100.0

    for val in df[ts_col].to_list():
        if val is None:
            continue
        try:
            if isinstance(val, datetime):
                ts = val if val.tzinfo else val.replace(tzinfo=timezone.utc)
            elif isinstance(val, str):
                ts = datetime.fromisoformat(val)
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
            else:
                continue
            delta = (now - ts).days
            if delta <= 30:
                timely_count += 1
        except (ValueError, TypeError):
            continue

    return round((timely_count / total_rows) * 100, 1)


def compute_data_quality(df: pl.DataFrame) -> Dict[str, Any]:
    """Compute overall quality metrics dictionary for a golden records dataframe."""
    total_rows = len(df)
    if total_rows == 0:
        return {
            "overallScore": 0.0,
            "completeness": 0.0,
            "uniqueness": 0.0,
            "consistency": 0.0,
            "timeliness": 0.0,
        }

    completeness = 0.0
    uniqueness = 0.0
    con = duckdb.connect()
    try:
        con.execute("PRAGMA threads=4")
        con.execute("PRAGMA preserve_insertion_order=false")
        con.register("golden", df)
        res = con.execute(
            """
            SELECT
                COUNT(CASE WHEN attributes IS NOT NULL AND LENGTH(TRIM(attributes)) > 2 THEN 1 END) AS non_empty,
                COUNT(DISTINCT golden_id) AS distinct_ids
            FROM golden
            """
        ).fetchone()
        if res:
            non_empty = int(res[0])
            distinct = int(res[1])
            completeness = round((non_empty / total_rows) * 100, 1)
            uniqueness = round((distinct / total_rows) * 100, 1)
    finally:
        con.close()

    consistency = compute_consistency(df, total_rows)
    timeliness = compute_timeliness(df, total_rows)

    overall = round(
        (completeness * 0.30)
        + (uniqueness * 0.30)
        + (consistency * 0.20)
        + (timeliness * 0.20),
        1,
    )

    return {
        "overallScore": overall,
        "completeness": completeness,
        "uniqueness": uniqueness,
        "consistency": consistency,
        "timeliness": timeliness,
    }
