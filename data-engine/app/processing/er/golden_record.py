"""Entity Resolution (ER) Golden Record Merge & Persistence Engine.

Merges clusters of matched records into unified canonical **Golden Records**
using attribute completeness and timestamp recency rules. Persists results to
the ``golden_records`` database table.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any

import polars as pl
from sqlalchemy import create_engine, text

from app.config import get_settings

logger = logging.getLogger(__name__)


def merge_cluster_to_golden_record(
    cluster_records: list[dict[str, Any]],
    tenant_id: str = "acme",
    golden_id: str | None = None,
) -> dict[str, Any]:
    """Merge a cluster of duplicate record dicts into a single canonical Golden Record.

    Merge policy for each field:
      1. Non-null values preferred.
      2. If multiple non-null values exist, pick the value from the record with the
         latest timestamp (e.g. ``updated_at``, ``joined_at``, ``staged_at``).
      3. If timestamps are equal or missing, pick the value with maximum string length
         (highest completeness).
    """
    if not cluster_records:
        return {}

    if not golden_id:
        golden_id = f"gr-{uuid.uuid4()}"

    source_ids = [str(r.get("id", r.get("raw_id", ""))) for r in cluster_records if "id" in r or "raw_id" in r]

    # Collect all unique attribute keys across cluster records
    all_keys: set[str] = set()
    for rec in cluster_records:
        all_keys.update(rec.keys())

    # Keys to exclude from golden attribute merging
    exclude_keys = {"id", "raw_id", "block_key", "decision", "confidence_score", "score_name", "score_dob", "score_email"}

    canonical_attributes: dict[str, Any] = {}

    for key in sorted(all_keys - exclude_keys):
        candidates = []
        for rec in cluster_records:
            val = rec.get(key)
            if val is not None and str(val).strip() != "":
                # Extract timestamp indicator if present
                ts = (
                    rec.get("updated_at")
                    or rec.get("joined_at")
                    or rec.get("staged_at")
                    or ""
                )
                str_val = str(val).strip()
                candidates.append((ts, len(str_val), val))

        if candidates:
            # Sort by timestamp desc, then length desc
            candidates.sort(key=lambda x: (str(x[0]), x[1]), reverse=True)
            canonical_attributes[key] = candidates[0][2]
        else:
            canonical_attributes[key] = None

    golden_record = {
        "golden_id": golden_id,
        "tenant_id": tenant_id,
        "cluster_size": len(cluster_records),
        "source_record_ids": source_ids,
        "created_at": datetime.now(timezone.utc).isoformat(),
        **canonical_attributes,
    }

    return golden_record


def merge_clusters_to_golden_records(
    clusters: list[list[dict[str, Any]]],
    tenant_id: str = "acme",
) -> pl.DataFrame:
    """Merge a list of record clusters into a Polars DataFrame of Golden Records."""
    golden_records = [
        merge_cluster_to_golden_record(cluster, tenant_id=tenant_id)
        for cluster in clusters
        if cluster
    ]

    if not golden_records:
        return pl.DataFrame()

    df = pl.DataFrame(golden_records)
    logger.info("Golden record merge complete — merged %d clusters into %d golden records", len(clusters), df.height)
    return df


def persist_golden_records(
    golden_records_df: pl.DataFrame,
    tenant_id: str = "acme",
) -> int:
    """Persist Golden Records to PostgreSQL / SQLite staging database table golden_records.

    Returns the number of golden records successfully written.
    """
    if golden_records_df.height == 0:
        return 0

    settings = get_settings()

    db_url = (
        f"postgresql+pg8000://{settings.postgres_user}:{settings.postgres_password}"
        f"@{settings.postgres_host}:{settings.postgres_port}/{settings.postgres_db}"
    )

    create_table_sql = """
    CREATE TABLE IF NOT EXISTS golden_records (
        golden_id VARCHAR(255) PRIMARY KEY,
        tenant_id VARCHAR(255),
        cluster_size INT,
        source_record_ids TEXT,
        attributes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """

    insert_sql = """
    INSERT INTO golden_records (golden_id, tenant_id, cluster_size, source_record_ids, attributes, created_at)
    VALUES (:golden_id, :tenant_id, :cluster_size, :source_record_ids, :attributes, :created_at);
    """

    params = []
    now_utc = datetime.now(timezone.utc)

    for row in golden_records_df.iter_rows(named=True):
        gid = str(row.get("golden_id", f"gr-{uuid.uuid4()}"))
        c_size = int(row.get("cluster_size", 1))
        s_ids = json.dumps(row.get("source_record_ids", []))
        
        attr_dict = {
            k: v for k, v in row.items()
            if k not in {"golden_id", "tenant_id", "cluster_size", "source_record_ids", "created_at"}
        }

        params.append({
            "golden_id": gid,
            "tenant_id": tenant_id,
            "cluster_size": c_size,
            "source_record_ids": s_ids,
            "attributes": json.dumps(attr_dict),
            "created_at": now_utc,
        })

    # Try PostgreSQL first
    pg_engine = None
    try:
        pg_engine = create_engine(db_url, pool_pre_ping=True)
        with pg_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        with pg_engine.begin() as conn:
            conn.execute(text(create_table_sql))
            conn.execute(text(insert_sql), params)
        logger.info("Persisted %d Golden Records to PostgreSQL golden_records table", len(params))
        return len(params)
    except Exception as exc:
        logger.warning("Could not persist Golden Records to PostgreSQL (%s). Using SQLite fallback.", exc)
    finally:
        if pg_engine is not None:
            pg_engine.dispose()

    # SQLite fallback
    sqlite_engine = None
    try:
        os.makedirs(os.path.join("storage", "sqlite"), exist_ok=True)
        sqlite_path = os.path.join("storage", "sqlite", "er_staging.db")
        sqlite_engine = create_engine(f"sqlite:///{sqlite_path}")

        with sqlite_engine.begin() as conn:
            conn.execute(text(create_table_sql))
            conn.execute(text(insert_sql), params)
        logger.info("Persisted %d Golden Records to SQLite golden_records table at %s", len(params), sqlite_path)
        return len(params)
    except Exception as exc:
        logger.error("Failed to persist Golden Records to SQLite: %s", exc)
        return 0
    finally:
        if sqlite_engine is not None:
            sqlite_engine.dispose()
