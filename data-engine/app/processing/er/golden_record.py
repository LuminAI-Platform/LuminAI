"""Entity Resolution (ER) Golden Record Merge, Versioning & Persistence Engine.

Merges clusters of matched records into unified canonical **Golden Records**
using attribute completeness and timestamp recency rules.
Maintains version history, point-in-time audit snapshots, and rollback capability
in the ``golden_records`` and ``golden_record_history`` database tables.
"""

from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache
import json
import logging
import os
from typing import Any
import uuid

import polars as pl
from sqlalchemy import text

logger = logging.getLogger(__name__)


@lru_cache(maxsize=32768)
def _parse_date_string_to_epoch(val_str: str) -> float:
    """Cached parsing of common date formats into UTC epoch timestamp."""
    for fmt in (
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%m/%d/%Y",
        "%d-%m-%Y",
    ):
        try:
            dt = datetime.strptime(val_str, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.timestamp()
        except ValueError:
            continue
    return 0.0


def _parse_ts_epoch(ts_val: Any) -> float:
    """Safely convert any date string or datetime into UTC epoch float for chronological sorting."""
    if not ts_val:
        return 0.0
    if isinstance(ts_val, (int, float)):
        return float(ts_val)
    if isinstance(ts_val, datetime):
        if ts_val.tzinfo is None:
            ts_val = ts_val.replace(tzinfo=timezone.utc)
        return ts_val.timestamp()

    val_str = str(ts_val).strip()
    if not val_str:
        return 0.0
    return _parse_date_string_to_epoch(val_str)


def merge_cluster_to_golden_record(
    cluster_records: list[dict[str, Any]],
    tenant_id: str = "acme",
    golden_id: str | None = None,
) -> dict[str, Any]:
    """Merge a cluster of duplicate record dicts into a single canonical Golden Record.

    Merge policy for each field:
      1. Non-null values preferred.
      2. If multiple non-null values exist, pick the value from the record with the
         latest chronological timestamp (e.g. ``updated_at``, ``joined_at``, ``staged_at``).
      3. If timestamps are equal or missing, pick the value with maximum string length
         (highest completeness).
    """
    if not cluster_records:
        return {}

    if not golden_id:
        golden_id = f"gr-{uuid.uuid4()}"

    source_ids = [
        str(r.get("id", r.get("raw_id", "")))
        for r in cluster_records
        if "id" in r or "raw_id" in r
    ]

    # Pre-parse timestamps once per cluster record to maximize performance
    rec_epochs = [
        _parse_ts_epoch(
            rec.get("updated_at") or rec.get("joined_at") or rec.get("staged_at") or ""
        )
        for rec in cluster_records
    ]

    # Collect all unique attribute keys across cluster records
    all_keys: set[str] = set()
    for rec in cluster_records:
        all_keys.update(rec.keys())

    # Keys to exclude from golden attribute merging
    exclude_keys = {
        "id",
        "raw_id",
        "block_key",
        "decision",
        "confidence_score",
        "score_name",
        "score_dob",
        "score_email",
        "version",
        "created_at",
        "updated_at",
    }

    canonical_attributes: dict[str, Any] = {}

    for key in sorted(all_keys - exclude_keys):
        candidates = []
        for i, rec in enumerate(cluster_records):
            val = rec.get(key)
            if val is not None and str(val).strip() != "":
                epoch = rec_epochs[i]
                str_val = str(val).strip()
                candidates.append((epoch, len(str_val), val))

        if candidates:
            # Sort chronologically by epoch desc, then completeness/length desc
            candidates.sort(key=lambda x: (x[0], x[1]), reverse=True)
            canonical_attributes[key] = candidates[0][2]
        else:
            canonical_attributes[key] = None

    resolved_tenant_id = tenant_id
    if resolved_tenant_id == "acme":
        for r in cluster_records:
            if r.get("tenant_id") and str(r.get("tenant_id")) != "acme":
                resolved_tenant_id = str(r.get("tenant_id"))
                break

    now_iso = datetime.now(timezone.utc).isoformat()
    golden_record = {
        "golden_id": golden_id,
        "tenant_id": resolved_tenant_id,
        "version": 1,
        "cluster_size": len(cluster_records),
        "source_record_ids": source_ids,
        "created_at": now_iso,
        "updated_at": now_iso,
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

    try:
        df = pl.DataFrame(golden_records)
    except Exception:
        # Resilient fallback for heterogeneous attribute schemas across records
        import pandas as pd

        df_pd = pd.DataFrame(golden_records)
        df = pl.from_pandas(df_pd)

    logger.info(
        "Golden record merge complete — merged %d clusters into %d golden records",
        len(clusters),
        df.height,
    )
    return df


def _get_active_engine():
    """Retrieve an active SQLAlchemy engine (PostgreSQL preferred, SQLite fallback)."""
    from app.db import ensure_tables_exist, get_engine, get_sqlite_engine

    try:
        pg_engine = get_engine()
        with pg_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        ensure_tables_exist(pg_engine)
        return pg_engine
    except Exception as exc:
        logger.debug(
            "PostgreSQL offline or unavailable (%s). Falling back to SQLite.", exc
        )
        os.makedirs(os.path.join("storage", "sqlite"), exist_ok=True)
        sqlite_path = os.path.join("storage", "sqlite", "er_staging.db")
        sqlite_engine = get_sqlite_engine(sqlite_path)
        ensure_tables_exist(sqlite_engine)
        return sqlite_engine


def persist_golden_records(
    golden_records_df: pl.DataFrame,
    tenant_id: str = "acme",
    batch_size: int = 500,
) -> int:
    """Persist Golden Records with version tracking, historical audit snapshots, and batched execution.

    Operates in chunks of `batch_size` (default 500) to minimize database round-trips:
      - Bulk queries existing records by IDs in each chunk.
      - Partitions into bulk updates and bulk inserts.
      - Uses SQLAlchemy executemany for high-throughput batch writes.

    If a golden record with the given `golden_id` already exists:
      - Increments `version`.
      - Updates attributes, cluster_size, source_record_ids, updated_at.
      - Writes a point-in-time snapshot to `golden_record_history` with action='UPDATED'.
    If it is a new golden record:
      - Inserts record into `golden_records` with version=1.
      - Writes initial snapshot to `golden_record_history` with action='CREATED'.

    Returns the number of golden records successfully written or updated.
    """
    if golden_records_df.height == 0:
        return 0

    from sqlalchemy import inspect
    from app.processing.er.classification import _to_uuid_str

    engine = _get_active_engine()
    now_utc = datetime.now(timezone.utc)
    persisted_count = 0

    with engine.connect() as conn:
        try:
            conn.execute(text("SET search_path TO tenant_default, public;"))
        except Exception:
            pass
        inspector = inspect(conn)
        cols = set()
        try:
            cols = {
                c["name"]
                for c in inspector.get_columns(
                    "golden_records", schema="tenant_default"
                )
            }
        except Exception:
            pass
        if not cols:
            try:
                cols = {c["name"] for c in inspector.get_columns("golden_records")}
            except Exception:
                cols = set()

    is_postgres_schema = "canonical_name" in cols

    all_rows = golden_records_df.to_dicts()
    total_records = len(all_rows)

    with engine.begin() as conn:
        try:
            conn.execute(text("SET search_path TO tenant_default, public;"))
        except Exception:
            pass

        if is_postgres_schema:
            insert_record_sql = text("""
                INSERT INTO golden_records (id, tenant_id, entity_type, canonical_name, properties, confidence_score, source_count, version, created_at, updated_at)
                VALUES (:id, :tenant_id, :entity_type, :canonical_name, :properties, :confidence_score, :source_count, :version, :created_at, :updated_at)
            """)
            update_record_sql = text("""
                UPDATE golden_records
                SET version = :version, source_count = :source_count, canonical_name = :canonical_name,
                    properties = :properties, updated_at = :updated_at
                WHERE id = :id
            """)

            for offset in range(0, total_records, batch_size):
                chunk = all_rows[offset : offset + batch_size]
                chunk_gids = []
                chunk_prepared = []

                for row in chunk:
                    raw_gid = str(row.get("golden_id") or row.get("id") or uuid.uuid4())
                    gid_uuid = _to_uuid_str(raw_gid)
                    rec_tenant = _to_uuid_str(str(row.get("tenant_id") or tenant_id))
                    c_size = int(row.get("cluster_size", row.get("source_count", 1)))
                    c_name = str(
                        row.get("canonical_name")
                        or row.get("name")
                        or row.get("full_name")
                        or "Unnamed Entity"
                    )
                    e_type = str(row.get("entity_type") or "Entity")
                    c_score = float(row.get("confidence_score", 1.0))

                    attr_dict = {
                        k: v
                        for k, v in row.items()
                        if k
                        not in {
                            "golden_id",
                            "id",
                            "tenant_id",
                            "version",
                            "cluster_size",
                            "source_record_ids",
                            "created_at",
                            "updated_at",
                            "entity_type",
                            "canonical_name",
                            "confidence_score",
                            "source_count",
                        }
                    }
                    chunk_prepared.append(
                        {
                            "id": gid_uuid,
                            "tenant_id": rec_tenant,
                            "entity_type": e_type,
                            "canonical_name": c_name,
                            "confidence_score": c_score,
                            "source_count": c_size,
                            "properties": json.dumps(attr_dict),
                        }
                    )
                    chunk_gids.append(gid_uuid)

                existing_map: dict[str, int] = {}
                if chunk_gids:
                    in_placeholders = [f":gid_{i}" for i in range(len(chunk_gids))]
                    params = {f"gid_{i}": gid for i, gid in enumerate(chunk_gids)}
                    batch_select_sql = text(
                        f"SELECT id, version FROM golden_records WHERE id IN ({','.join(in_placeholders)})"
                    )
                    existing_rows = (
                        conn.execute(batch_select_sql, params).mappings().fetchall()
                    )
                    for er in existing_rows:
                        existing_map[str(er["id"])] = int(er["version"])

                records_to_insert = []
                records_to_update = []

                for item in chunk_prepared:
                    gid = item["id"]
                    if gid in existing_map:
                        new_version = existing_map[gid] + 1
                        records_to_update.append(
                            {
                                "id": gid,
                                "version": new_version,
                                "source_count": item["source_count"],
                                "canonical_name": item["canonical_name"],
                                "properties": item["properties"],
                                "updated_at": now_utc,
                            }
                        )
                    else:
                        records_to_insert.append(
                            {
                                "id": gid,
                                "tenant_id": item["tenant_id"],
                                "entity_type": item["entity_type"],
                                "canonical_name": item["canonical_name"],
                                "properties": item["properties"],
                                "confidence_score": item["confidence_score"],
                                "source_count": item["source_count"],
                                "version": 1,
                                "created_at": now_utc,
                                "updated_at": now_utc,
                            }
                        )

                if records_to_insert:
                    conn.execute(insert_record_sql, records_to_insert)
                if records_to_update:
                    conn.execute(update_record_sql, records_to_update)
                persisted_count += len(chunk)
        else:
            # Declarative SQLite / SQLAlchemy schema
            insert_record_sql = text("""
                INSERT INTO golden_records (golden_id, tenant_id, version, cluster_size, source_record_ids, attributes, created_at, updated_at)
                VALUES (:golden_id, :tenant_id, :version, :cluster_size, :source_record_ids, :attributes, :created_at, :updated_at)
            """)
            update_record_sql = text("""
                UPDATE golden_records
                SET version = :version, cluster_size = :cluster_size, source_record_ids = :source_record_ids,
                    attributes = :attributes, updated_at = :updated_at
                WHERE golden_id = :golden_id
            """)
            insert_history_sql = text("""
                INSERT INTO golden_record_history (id, golden_id, tenant_id, version, cluster_size, source_record_ids, attributes, action, created_at)
                VALUES (:id, :golden_id, :tenant_id, :version, :cluster_size, :source_record_ids, :attributes, :action, :created_at)
            """)

            for offset in range(0, total_records, batch_size):
                chunk = all_rows[offset : offset + batch_size]
                chunk_prepared = []
                chunk_gids = []

                for row in chunk:
                    gid = str(row.get("golden_id") or f"gr-{uuid.uuid4()}")
                    c_size = int(row.get("cluster_size", 1))
                    s_ids = json.dumps(row.get("source_record_ids", []))
                    rec_tenant_id = str(row.get("tenant_id") or tenant_id)

                    attr_dict = {
                        k: v
                        for k, v in row.items()
                        if k
                        not in {
                            "golden_id",
                            "tenant_id",
                            "version",
                            "cluster_size",
                            "source_record_ids",
                            "created_at",
                            "updated_at",
                        }
                    }
                    attr_json = json.dumps(attr_dict)

                    chunk_prepared.append(
                        {
                            "golden_id": gid,
                            "tenant_id": rec_tenant_id,
                            "cluster_size": c_size,
                            "source_record_ids": s_ids,
                            "attributes": attr_json,
                        }
                    )
                    chunk_gids.append(gid)

                existing_map: dict[str, int] = {}
                if chunk_gids:
                    in_placeholders = [f":gid_{i}" for i in range(len(chunk_gids))]
                    params = {f"gid_{i}": gid for i, gid in enumerate(chunk_gids)}
                    batch_select_sql = text(
                        f"SELECT golden_id, version FROM golden_records WHERE golden_id IN ({','.join(in_placeholders)})"
                    )
                    existing_rows = (
                        conn.execute(batch_select_sql, params).mappings().fetchall()
                    )
                    for er in existing_rows:
                        existing_map[er["golden_id"]] = int(er["version"])

                records_to_insert = []
                records_to_update = []
                history_to_insert = []

                for item in chunk_prepared:
                    gid = item["golden_id"]
                    rec_tenant_id = item["tenant_id"]
                    c_size = item["cluster_size"]
                    s_ids = item["source_record_ids"]
                    attr_json = item["attributes"]

                    if gid in existing_map:
                        new_version = existing_map[gid] + 1
                        records_to_update.append(
                            {
                                "golden_id": gid,
                                "version": new_version,
                                "cluster_size": c_size,
                                "source_record_ids": s_ids,
                                "attributes": attr_json,
                                "updated_at": now_utc,
                            }
                        )
                        history_to_insert.append(
                            {
                                "id": str(uuid.uuid4()),
                                "golden_id": gid,
                                "tenant_id": rec_tenant_id,
                                "version": new_version,
                                "cluster_size": c_size,
                                "source_record_ids": s_ids,
                                "attributes": attr_json,
                                "action": "UPDATED",
                                "created_at": now_utc,
                            }
                        )
                    else:
                        new_version = 1
                        records_to_insert.append(
                            {
                                "golden_id": gid,
                                "tenant_id": rec_tenant_id,
                                "version": new_version,
                                "cluster_size": c_size,
                                "source_record_ids": s_ids,
                                "attributes": attr_json,
                                "created_at": now_utc,
                                "updated_at": now_utc,
                            }
                        )
                        history_to_insert.append(
                            {
                                "id": str(uuid.uuid4()),
                                "golden_id": gid,
                                "tenant_id": rec_tenant_id,
                                "version": new_version,
                                "cluster_size": c_size,
                                "source_record_ids": s_ids,
                                "attributes": attr_json,
                                "action": "CREATED",
                                "created_at": now_utc,
                            }
                        )

                if records_to_insert:
                    conn.execute(insert_record_sql, records_to_insert)
                if records_to_update:
                    conn.execute(update_record_sql, records_to_update)
                if history_to_insert:
                    conn.execute(insert_history_sql, history_to_insert)

                persisted_count += len(chunk)

    logger.info(
        "Persisted %d Golden Records in batches of %d (with versioning & audit trail)",
        persisted_count,
        batch_size,
    )
    return persisted_count


def get_golden_record(
    golden_id: str, tenant_id: str | None = None
) -> dict[str, Any] | None:
    """Retrieve the current state of a Golden Record by its ID."""
    engine = _get_active_engine()
    query = text("""
        SELECT golden_id, tenant_id, version, cluster_size, source_record_ids, attributes, created_at, updated_at
        FROM golden_records
        WHERE golden_id = :golden_id
    """)

    with engine.connect() as conn:
        row = conn.execute(query, {"golden_id": golden_id}).mappings().first()
        if not row:
            return None

        if tenant_id and row["tenant_id"] != tenant_id and tenant_id != "acme":
            return None

        try:
            s_ids = (
                json.loads(row["source_record_ids"]) if row["source_record_ids"] else []
            )
        except Exception:
            s_ids = []

        try:
            attrs = json.loads(row["attributes"]) if row["attributes"] else {}
        except Exception:
            attrs = {}

        return {
            "golden_id": row["golden_id"],
            "tenant_id": row["tenant_id"],
            "version": int(row["version"]),
            "cluster_size": int(row["cluster_size"]),
            "source_record_ids": s_ids,
            "created_at": str(row["created_at"]),
            "updated_at": str(row["updated_at"]),
            "attributes": attrs,
        }


def get_golden_record_history(
    golden_id: str, tenant_id: str | None = None
) -> list[dict[str, Any]]:
    """Retrieve full audit history for a Golden Record ordered newest first."""
    engine = _get_active_engine()
    query = text("""
        SELECT id, golden_id, tenant_id, version, cluster_size, source_record_ids, attributes, action, created_at
        FROM golden_record_history
        WHERE golden_id = :golden_id
        ORDER BY version DESC
    """)

    history_items = []
    with engine.connect() as conn:
        rows = conn.execute(query, {"golden_id": golden_id}).mappings().all()
        for row in rows:
            if tenant_id and row["tenant_id"] != tenant_id and tenant_id != "acme":
                continue

            try:
                s_ids = (
                    json.loads(row["source_record_ids"])
                    if row["source_record_ids"]
                    else []
                )
            except Exception:
                s_ids = []

            try:
                attrs = json.loads(row["attributes"]) if row["attributes"] else {}
            except Exception:
                attrs = {}

            history_items.append(
                {
                    "history_id": row["id"],
                    "golden_id": row["golden_id"],
                    "tenant_id": row["tenant_id"],
                    "version": int(row["version"]),
                    "cluster_size": int(row["cluster_size"]),
                    "source_record_ids": s_ids,
                    "action": row["action"],
                    "created_at": str(row["created_at"]),
                    "attributes": attrs,
                }
            )

    return history_items


def rollback_golden_record(
    golden_id: str,
    target_version: int,
    tenant_id: str | None = None,
) -> dict[str, Any]:
    """Rollback a Golden Record to a prior historical version snapshot.

    Creates a new version increment with action='ROLLBACK' preserving the full audit trail.
    """
    engine = _get_active_engine()
    now_utc = datetime.now(timezone.utc)

    # 1. Fetch current golden record
    current = get_golden_record(golden_id, tenant_id=tenant_id)
    if not current:
        raise KeyError(f"Golden Record '{golden_id}' not found")

    # 2. Fetch the target historical snapshot
    find_snapshot_sql = text("""
        SELECT id, golden_id, tenant_id, version, cluster_size, source_record_ids, attributes
        FROM golden_record_history
        WHERE golden_id = :golden_id AND version = :target_version
    """)

    with engine.connect() as conn:
        snapshot = (
            conn.execute(
                find_snapshot_sql,
                {"golden_id": golden_id, "target_version": target_version},
            )
            .mappings()
            .first()
        )

    if not snapshot:
        raise ValueError(
            f"Target version {target_version} not found in history for golden record '{golden_id}'"
        )

    new_version = current["version"] + 1

    # 3. Apply rollback update in a transaction
    update_sql = text("""
        UPDATE golden_records
        SET version = :version, cluster_size = :cluster_size, source_record_ids = :source_record_ids,
            attributes = :attributes, updated_at = :updated_at
        WHERE golden_id = :golden_id
    """)
    insert_history_sql = text("""
        INSERT INTO golden_record_history (id, golden_id, tenant_id, version, cluster_size, source_record_ids, attributes, action, created_at)
        VALUES (:id, :golden_id, :tenant_id, :version, :cluster_size, :source_record_ids, :attributes, 'ROLLBACK', :created_at)
    """)

    with engine.begin() as conn:
        conn.execute(
            update_sql,
            {
                "golden_id": golden_id,
                "version": new_version,
                "cluster_size": snapshot["cluster_size"],
                "source_record_ids": snapshot["source_record_ids"],
                "attributes": snapshot["attributes"],
                "updated_at": now_utc,
            },
        )
        conn.execute(
            insert_history_sql,
            {
                "id": str(uuid.uuid4()),
                "golden_id": golden_id,
                "tenant_id": current["tenant_id"],
                "version": new_version,
                "cluster_size": snapshot["cluster_size"],
                "source_record_ids": snapshot["source_record_ids"],
                "attributes": snapshot["attributes"],
                "created_at": now_utc,
            },
        )

    logger.info(
        "Rolled back Golden Record '%s' from v%d to snapshot v%d (recorded as v%d)",
        golden_id,
        current["version"],
        target_version,
        new_version,
    )

    return get_golden_record(golden_id, tenant_id=tenant_id) or {}
