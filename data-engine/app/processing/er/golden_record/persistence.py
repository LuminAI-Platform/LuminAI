"""Database persistence and batched upserts for Golden Records."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
import os
import uuid

import polars as pl
from sqlalchemy import inspect, text

logger = logging.getLogger(__name__)


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

    from app.processing.er.classification import _to_uuid_str

    engine = _get_active_engine()
    now_utc = datetime.now(timezone.utc)
    persisted_count = 0

    schema_name = (
        f"tenant_{tenant_id}"
        if not str(tenant_id).startswith("tenant_")
        else str(tenant_id)
    )

    with engine.connect() as conn:
        try:
            conn.execute(
                text(f"SET search_path TO {schema_name}, tenant_default, public;")
            )
        except Exception:
            pass
        inspector = inspect(conn)
        cols = set()
        try:
            cols = {
                c["name"]
                for c in inspector.get_columns("golden_records", schema=schema_name)
            }
        except Exception:
            pass
        if not cols:
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
            conn.execute(
                text(f"SET search_path TO {schema_name}, tenant_default, public;")
            )
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
