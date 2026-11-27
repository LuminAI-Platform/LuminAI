"""Database persistence and batched upserts for Golden Records."""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone

import polars as pl
from sqlalchemy import text

from app.db.tenant import (
    reset_pg_search_path,
    resolve_table_schema,
    resolve_tenant_pg_context,
    safe_schema_name,
    set_pg_search_path,
    to_uuid_str,
)
from app.processing.engine.golden_record_engine import GoldenRecordEngine

logger = logging.getLogger(__name__)


def _safe_schema_name(tenant_id: str) -> str:
    """Sanitize tenant identifier to prevent search_path injection."""
    return safe_schema_name(tenant_id)


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

    engine = _get_active_engine()
    now_utc = datetime.now(timezone.utc)
    persisted_count = 0

    with engine.connect() as conn:
        tenant_ctx = resolve_tenant_pg_context(conn, tenant_id)
        schema_name = tenant_ctx["schema_name"]
        resolved_tenant_uuid = tenant_ctx["tenant_uuid"]
        found_schema, cols = resolve_table_schema(
            conn, "golden_records", preferred_schemas=[schema_name, "tenant_default", "public"]
        )
        _, hist_cols = resolve_table_schema(
            conn, "golden_record_history", preferred_schemas=[schema_name, "tenant_default", "public"]
        )
        source_ids_schema, _ = resolve_table_schema(
            conn, "golden_records_source_ids", preferred_schemas=[found_schema or schema_name]
        )

    is_postgres_schema = "canonical_name" in cols
    has_history_table = bool(hist_cols)
    target_schema = found_schema or schema_name
    if found_schema and found_schema != schema_name and schema_name != "tenant_default":
        logger.warning(
            "Target schema '%s' lacked golden_records; falling back to schema '%s'",
            schema_name,
            found_schema,
        )
    has_source_ids_table = is_postgres_schema and source_ids_schema == target_schema

    all_rows = golden_records_df.to_dicts()
    total_records = len(all_rows)

    insert_history_sql = text("""
        INSERT INTO golden_record_history (id, golden_id, tenant_id, version, cluster_size, source_record_ids, attributes, action, created_at)
        VALUES (:id, :golden_id, :tenant_id, :version, :cluster_size, :source_record_ids, :attributes, :action, :created_at)
    """)

    with engine.begin() as conn:
        set_pg_search_path(conn, target_schema)

        if is_postgres_schema:
            insert_record_sql = text("""
                INSERT INTO golden_records (id, tenant_id, entity_type, canonical_name, properties, confidence_score, source_count, version, created_at, updated_at)
                VALUES (:id, :tenant_id, :entity_type, :canonical_name, :properties, :confidence_score, :source_count, :version, :created_at, :updated_at)
            """)
            update_record_sql = text("""
                UPDATE golden_records
                SET version = :version, source_count = :source_count, canonical_name = :canonical_name,
                    properties = :properties, confidence_score = :confidence_score, updated_at = :updated_at
                WHERE id = :id
            """)

            cleared_sync_cids: set[str] = set()
            for offset in range(0, total_records, batch_size):
                chunk = all_rows[offset : offset + batch_size]
                chunk_gids = []
                chunk_prepared = []

                for row in chunk:
                    raw_gid = str(row.get("golden_id") or row.get("id") or uuid.uuid4())
                    gid_uuid = to_uuid_str(raw_gid)
                    row_tenant_raw = str(row.get("tenant_id") or tenant_id)
                    rec_tenant = (
                        resolved_tenant_uuid
                        if row_tenant_raw == tenant_id
                        else to_uuid_str(row_tenant_raw)
                    )
                    c_size = int(row.get("cluster_size", row.get("source_count", 1)))
                    c_name = GoldenRecordEngine.resolve_canonical_name(row, fallback_id=None)
                    e_type = GoldenRecordEngine.infer_entity_type(
                        row, row.get("entity_type") or row.get("entityType")
                    )
                    try:
                        c_score = float(row.get("confidence_score") if row.get("confidence_score") is not None else 1.0)
                    except (ValueError, TypeError):
                        c_score = 1.0
                    try:
                        q_score = float(row.get("quality_score") if row.get("quality_score") is not None else 1.0)
                    except (ValueError, TypeError):
                        q_score = 1.0
                    q_state = str(row.get("quality_state") or "VERIFIED")
                    s_ids_val = row.get("source_record_ids", [])
                    s_ids_json = s_ids_val if isinstance(s_ids_val, str) else json.dumps(s_ids_val)
                    conflicts_val = row.get("conflicts")

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
                            "quality_state",
                            "quality_score",
                            "conflicts",
                            "created_at",
                            "updated_at",
                            "entity_type",
                            "canonical_name",
                            "confidence_score",
                            "source_count",
                        }
                    }
                    # Preserve audit, quality, conflict, and source attribution metadata in properties JSONB
                    s_ids_list = (
                        s_ids_val
                        if not isinstance(s_ids_val, str)
                        else json.loads(s_ids_val)
                    )
                    props_dict = {
                        **attr_dict,
                        "_raw_golden_id": raw_gid,
                        "_quality_state": q_state,
                        "_quality_score": q_score,
                        "_source_record_ids": s_ids_list,
                    }
                    if row.get("_source_name"):
                        props_dict["_source_name"] = str(row["_source_name"])
                    if row.get("_source_systems"):
                        props_dict["_source_systems"] = list(row["_source_systems"])
                    if row.get("_connection_id"):
                        props_dict["_connection_id"] = str(row["_connection_id"])
                    if conflicts_val is not None:
                        props_dict["_conflicts"] = conflicts_val

                    chunk_prepared.append(
                        {
                            "id": gid_uuid,
                            "raw_gid": raw_gid,
                            "tenant_id": rec_tenant,
                            "tenant_raw": row_tenant_raw,
                            "entity_type": e_type,
                            "canonical_name": c_name,
                            "confidence_score": c_score,
                            "source_count": c_size,
                            "source_record_ids_list": s_ids_list if isinstance(s_ids_list, list) else [],
                            "source_record_ids_json": s_ids_json,
                            "connection_id": str(row["_connection_id"]) if row.get("_connection_id") else None,
                            "properties": json.dumps(props_dict, default=str),
                            "attributes_json": json.dumps(attr_dict, default=str),
                        }
                    )
                    chunk_gids.append(gid_uuid)

                conn_ids_to_upgrade = {
                    item["connection_id"]
                    for item in chunk_prepared
                    if item.get("connection_id") and item["connection_id"] not in cleared_sync_cids
                }
                for cid in conn_ids_to_upgrade:
                    cleared_sync_cids.add(cid)
                    conn.execute(
                        text(
                            "DELETE FROM golden_records WHERE tenant_id = :tid "
                            "AND properties->>'_connection_id' = :cid "
                            "AND properties ? '_sync_persisted'"
                        ),
                        {"tid": resolved_tenant_uuid, "cid": cid},
                    )

                existing_map: dict[str, int] = {}
                if chunk_gids:
                    in_placeholders = [f":gid_{i}" for i in range(len(chunk_gids))]
                    params = {f"gid_{i}": gid for i, gid in enumerate(chunk_gids)}
                    batch_select_sql = text(
                        f"SELECT id::text AS id, version FROM golden_records WHERE id::text IN ({','.join(in_placeholders)})"
                    )
                    existing_rows = (
                        conn.execute(batch_select_sql, params).mappings().fetchall()
                    )
                    for er in existing_rows:
                        existing_map[str(er["id"])] = int(er["version"])

                records_to_insert = []
                records_to_update = []
                history_to_insert = []

                for item in chunk_prepared:
                    gid = item["id"]
                    if gid in existing_map:
                        new_version = max(1, existing_map[gid]) + 1
                        records_to_update.append(
                            {
                                "id": gid,
                                "version": new_version,
                                "source_count": item["source_count"],
                                "canonical_name": item["canonical_name"],
                                "properties": item["properties"],
                                "confidence_score": item["confidence_score"],
                                "updated_at": now_utc,
                            }
                        )
                        history_action = "UPDATED"
                    else:
                        new_version = 1
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
                        history_action = "CREATED"

                    if has_history_table:
                        history_to_insert.append(
                            {
                                "id": str(uuid.uuid4()),
                                "golden_id": item["raw_gid"],
                                "tenant_id": item["tenant_raw"],
                                "version": new_version,
                                "cluster_size": item["source_count"],
                                "source_record_ids": item["source_record_ids_json"],
                                "attributes": item["attributes_json"],
                                "action": history_action,
                                "created_at": now_utc,
                            }
                        )

                if records_to_insert:
                    conn.execute(insert_record_sql, records_to_insert)
                if records_to_update:
                    conn.execute(update_record_sql, records_to_update)
                if has_source_ids_table:
                    src_id_rows = []
                    for item in chunk_prepared:
                        gid = item["id"]
                        seen_sids: set[str] = set()
                        for sid in item.get("source_record_ids_list", []):
                            if not sid:
                                continue
                            sid_uuid = to_uuid_str(sid)
                            if sid_uuid not in seen_sids:
                                seen_sids.add(sid_uuid)
                                src_id_rows.append(
                                    {"golden_record_id": gid, "source_record_id": sid_uuid}
                                )
                    if src_id_rows:
                        conn.execute(
                            text(
                                """
                                INSERT INTO golden_records_source_ids (golden_record_id, source_record_id)
                                VALUES (:golden_record_id, :source_record_id)
                                ON CONFLICT DO NOTHING
                                """
                            ),
                            src_id_rows,
                        )
                if history_to_insert:
                    conn.execute(insert_history_sql, history_to_insert)
                persisted_count += len(chunk)
        else:
            # Declarative SQLite / SQLAlchemy schema
            has_quality_cols = ("quality_state" in cols) or (not cols)
            if has_quality_cols:
                insert_record_sql = text("""
                    INSERT INTO golden_records (golden_id, tenant_id, version, cluster_size, source_record_ids, attributes, quality_state, quality_score, confidence_score, conflicts, created_at, updated_at)
                    VALUES (:golden_id, :tenant_id, :version, :cluster_size, :source_record_ids, :attributes, :quality_state, :quality_score, :confidence_score, :conflicts, :created_at, :updated_at)
                """)
                update_record_sql = text("""
                    UPDATE golden_records
                    SET version = :version, cluster_size = :cluster_size, source_record_ids = :source_record_ids,
                        attributes = :attributes, quality_state = :quality_state, quality_score = :quality_score,
                        confidence_score = :confidence_score, conflicts = :conflicts, updated_at = :updated_at
                    WHERE golden_id = :golden_id
                """)
            else:
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

            cleared_sync_cids: set[str] = set()
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
                            "quality_state",
                            "quality_score",
                            "confidence_score",
                            "conflicts",
                            "created_at",
                            "updated_at",
                        }
                    }
                    attr_json = json.dumps(attr_dict)

                    q_state = str(row.get("quality_state") or "VERIFIED")
                    try:
                        q_score = float(row.get("quality_score") if row.get("quality_score") is not None else 1.0)
                    except (ValueError, TypeError):
                        q_score = 1.0
                    try:
                        conf_score = float(row.get("confidence_score") if row.get("confidence_score") is not None else 1.0)
                    except (ValueError, TypeError):
                        conf_score = 1.0
                    c_conflicts = row.get("conflicts")
                    if isinstance(c_conflicts, (dict, list)):
                        c_conflicts = json.dumps(c_conflicts)
                    elif c_conflicts is not None:
                        c_conflicts = str(c_conflicts)

                    chunk_prepared.append(
                        {
                            "golden_id": gid,
                            "tenant_id": rec_tenant_id,
                            "cluster_size": c_size,
                            "source_record_ids": s_ids,
                            "attributes": attr_json,
                            "quality_state": q_state,
                            "quality_score": q_score,
                            "confidence_score": conf_score,
                            "conflicts": c_conflicts,
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
                        rec_update = {
                            "golden_id": gid,
                            "version": new_version,
                            "cluster_size": c_size,
                            "source_record_ids": s_ids,
                            "attributes": attr_json,
                            "updated_at": now_utc,
                        }
                        if has_quality_cols:
                            rec_update["quality_state"] = item["quality_state"]
                            rec_update["quality_score"] = item["quality_score"]
                            rec_update["confidence_score"] = item["confidence_score"]
                            rec_update["conflicts"] = item["conflicts"]
                        records_to_update.append(rec_update)
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
                        rec_insert = {
                            "golden_id": gid,
                            "tenant_id": rec_tenant_id,
                            "version": new_version,
                            "cluster_size": c_size,
                            "source_record_ids": s_ids,
                            "attributes": attr_json,
                            "created_at": now_utc,
                            "updated_at": now_utc,
                        }
                        if has_quality_cols:
                            rec_insert["quality_state"] = item["quality_state"]
                            rec_insert["quality_score"] = item["quality_score"]
                            rec_insert["confidence_score"] = item["confidence_score"]
                            rec_insert["conflicts"] = item["conflicts"]
                        records_to_insert.append(rec_insert)
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

        reset_pg_search_path(conn)

    logger.info(
        "Persisted %d Golden Records in batches of %d (with versioning & audit trail)",
        persisted_count,
        batch_size,
    )
    return persisted_count
