"""Audit trail queries, version snapshot retrieval, and rollback execution for Golden Records."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text

from app.db.tenant import (
    reset_pg_search_path,
    resolve_table_schema,
    resolve_tenant_pg_context,
    set_pg_search_path,
    to_uuid_str,
)
from app.processing.er.golden_record.persistence import _get_active_engine

logger = logging.getLogger(__name__)


def _parse_json_field(raw: Any, fallback: Any) -> Any:
    if raw is None:
        return fallback
    if isinstance(raw, (dict, list)):
        return raw
    try:
        return json.loads(raw) if raw else fallback
    except Exception:
        return fallback


def get_golden_record(
    golden_id: str, tenant_id: str | None = None
) -> dict[str, Any] | None:
    """Retrieve the current state of a Golden Record by its ID across Flyway/Alembic schemas."""
    engine = _get_active_engine()
    raw_gid = str(golden_id)
    uuid_gid = to_uuid_str(raw_gid)

    with engine.connect() as conn:
        preferred = []
        tenant_ctx = None
        if tenant_id:
            tenant_ctx = resolve_tenant_pg_context(conn, tenant_id)
            preferred = [tenant_ctx["schema_name"], "tenant_default", "public"]
        else:
            preferred = ["tenant_default", "public"]

        found_schema, cols = resolve_table_schema(conn, "golden_records", preferred_schemas=preferred)
        is_flyway = "canonical_name" in cols
        set_pg_search_path(conn, found_schema)
        try:
            if is_flyway:
                if tenant_ctx:
                    query = text("""
                        SELECT id::text AS id, tenant_id::text AS tenant_id, version, source_count,
                               canonical_name, entity_type, properties, created_at, updated_at
                        FROM golden_records
                        WHERE id::text IN (:raw_id, :uuid_id)
                          AND tenant_id::text IN (:t_raw, :t_uuid, :t_slug)
                    """)
                    params = {
                        "raw_id": raw_gid,
                        "uuid_id": uuid_gid,
                        "t_raw": tenant_ctx["tenant_raw"],
                        "t_uuid": tenant_ctx["tenant_uuid"],
                        "t_slug": tenant_ctx["tenant_slug"],
                    }
                else:
                    query = text("""
                        SELECT id::text AS id, tenant_id::text AS tenant_id, version, source_count,
                               canonical_name, entity_type, properties, created_at, updated_at
                        FROM golden_records
                        WHERE id::text IN (:raw_id, :uuid_id)
                    """)
                    params = {"raw_id": raw_gid, "uuid_id": uuid_gid}

                row = conn.execute(query, params).mappings().first()
                if not row:
                    return None
                props = _parse_json_field(row["properties"], {})
                if not isinstance(props, dict):
                    props = {}
                s_ids = props.get("_source_record_ids", [])
                clean_attrs = {k: v for k, v in props.items() if not k.startswith("_")}
                return {
                    "golden_id": str(props.get("_raw_golden_id") or row["id"]),
                    "tenant_id": tenant_ctx["tenant_raw"] if tenant_ctx else str(row["tenant_id"]),
                    "version": max(1, int(row["version"] or 1)),
                    "cluster_size": int(row["source_count"] or 1),
                    "source_record_ids": s_ids if isinstance(s_ids, list) else [],
                    "created_at": str(row["created_at"]),
                    "updated_at": str(row["updated_at"]),
                    "attributes": clean_attrs,
                }

            if tenant_id:
                query = text("""
                    SELECT golden_id, tenant_id, version, cluster_size, source_record_ids, attributes, created_at, updated_at
                    FROM golden_records
                    WHERE golden_id = :golden_id AND tenant_id = :tenant_id
                """)
                params = {"golden_id": raw_gid, "tenant_id": tenant_id}
            else:
                query = text("""
                    SELECT golden_id, tenant_id, version, cluster_size, source_record_ids, attributes, created_at, updated_at
                    FROM golden_records
                    WHERE golden_id = :golden_id
                """)
                params = {"golden_id": raw_gid}

            row = conn.execute(query, params).mappings().first()
            if not row:
                return None

            s_ids = _parse_json_field(row["source_record_ids"], [])
            attrs = _parse_json_field(row["attributes"], {})

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
        finally:
            reset_pg_search_path(conn)


def get_golden_record_history(
    golden_id: str, tenant_id: str | None = None
) -> list[dict[str, Any]]:
    """Retrieve full audit history for a Golden Record ordered newest first."""
    engine = _get_active_engine()
    raw_gid = str(golden_id)
    uuid_gid = to_uuid_str(raw_gid)

    with engine.connect() as conn:
        tenant_ctx = resolve_tenant_pg_context(conn, tenant_id) if tenant_id else None
        preferred = [tenant_ctx["schema_name"], "tenant_default", "public"] if tenant_ctx else ["tenant_default", "public"]
        found_schema, _ = resolve_table_schema(conn, "golden_record_history", preferred_schemas=preferred)
        set_pg_search_path(conn, found_schema)
        try:
            if tenant_ctx:
                query = text("""
                    SELECT id, golden_id, tenant_id, version, cluster_size, source_record_ids, attributes, action, created_at
                    FROM golden_record_history
                    WHERE golden_id IN (:raw_id, :uuid_id)
                      AND tenant_id IN (:t_raw, :t_slug, :t_uuid)
                    ORDER BY version DESC
                """)
                params = {
                    "raw_id": raw_gid,
                    "uuid_id": uuid_gid,
                    "t_raw": tenant_ctx["tenant_raw"],
                    "t_slug": tenant_ctx["tenant_slug"],
                    "t_uuid": tenant_ctx["tenant_uuid"],
                }
            else:
                query = text("""
                    SELECT id, golden_id, tenant_id, version, cluster_size, source_record_ids, attributes, action, created_at
                    FROM golden_record_history
                    WHERE golden_id IN (:raw_id, :uuid_id)
                    ORDER BY version DESC
                """)
                params = {"raw_id": raw_gid, "uuid_id": uuid_gid}

            history_items = []
            rows = conn.execute(query, params).mappings().all()
            for row in rows:
                s_ids = _parse_json_field(row["source_record_ids"], [])
                attrs = _parse_json_field(row["attributes"], {})
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
        finally:
            reset_pg_search_path(conn)


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
    raw_gid = str(golden_id)
    uuid_gid = to_uuid_str(raw_gid)

    # 1. Fetch current golden record
    current = get_golden_record(raw_gid, tenant_id=tenant_id)
    if not current:
        raise KeyError(f"Golden Record '{golden_id}' not found")

    with engine.connect() as conn:
        tenant_ctx = resolve_tenant_pg_context(conn, tenant_id) if tenant_id else None
        preferred = [tenant_ctx["schema_name"], "tenant_default", "public"] if tenant_ctx else ["tenant_default", "public"]
        gr_schema, gr_cols = resolve_table_schema(conn, "golden_records", preferred_schemas=preferred)
        hist_schema, _ = resolve_table_schema(conn, "golden_record_history", preferred_schemas=preferred)
        is_flyway = "canonical_name" in gr_cols

        set_pg_search_path(conn, hist_schema)
        try:
            if tenant_ctx:
                find_snapshot_sql = text("""
                    SELECT id, golden_id, tenant_id, version, cluster_size, source_record_ids, attributes
                    FROM golden_record_history
                    WHERE golden_id IN (:raw_id, :uuid_id)
                      AND version = :target_version
                      AND tenant_id IN (:t_raw, :t_slug, :t_uuid)
                """)
                snapshot_params = {
                    "raw_id": raw_gid,
                    "uuid_id": uuid_gid,
                    "target_version": target_version,
                    "t_raw": tenant_ctx["tenant_raw"],
                    "t_slug": tenant_ctx["tenant_slug"],
                    "t_uuid": tenant_ctx["tenant_uuid"],
                }
            else:
                find_snapshot_sql = text("""
                    SELECT id, golden_id, tenant_id, version, cluster_size, source_record_ids, attributes
                    FROM golden_record_history
                    WHERE golden_id IN (:raw_id, :uuid_id) AND version = :target_version
                """)
                snapshot_params = {
                    "raw_id": raw_gid,
                    "uuid_id": uuid_gid,
                    "target_version": target_version,
                }
            snapshot = conn.execute(find_snapshot_sql, snapshot_params).mappings().first()
        finally:
            reset_pg_search_path(conn)

    if not snapshot:
        raise ValueError(
            f"Target version {target_version} not found in history for golden record '{golden_id}'"
        )

    new_version = current["version"] + 1
    snap_attrs = _parse_json_field(snapshot["attributes"], {})
    snap_sids = _parse_json_field(snapshot["source_record_ids"], [])

    insert_history_sql = text("""
        INSERT INTO golden_record_history (id, golden_id, tenant_id, version, cluster_size, source_record_ids, attributes, action, created_at)
        VALUES (:id, :golden_id, :tenant_id, :version, :cluster_size, :source_record_ids, :attributes, 'ROLLBACK', :created_at)
    """)

    with engine.begin() as conn:
        set_pg_search_path(conn, gr_schema or (tenant_ctx["schema_name"] if tenant_ctx else None))
        try:
            if is_flyway:
                restored_props = {
                    **(snap_attrs if isinstance(snap_attrs, dict) else {}),
                    "_raw_golden_id": current["golden_id"],
                    "_source_record_ids": snap_sids,
                }
                c_name = str(
                    (snap_attrs.get("canonical_name") or snap_attrs.get("name") or snap_attrs.get("full_name") or "Unnamed Entity")
                    if isinstance(snap_attrs, dict)
                    else "Unnamed Entity"
                )
                update_sql = text("""
                    UPDATE golden_records
                    SET version = :version, source_count = :source_count, canonical_name = :canonical_name,
                        properties = :properties, updated_at = :updated_at
                    WHERE id::text IN (:raw_id, :uuid_id)
                """)
                conn.execute(
                    update_sql,
                    {
                        "raw_id": raw_gid,
                        "uuid_id": uuid_gid,
                        "version": new_version,
                        "source_count": int(snapshot["cluster_size"] or 1),
                        "canonical_name": c_name,
                        "properties": json.dumps(restored_props),
                        "updated_at": now_utc,
                    },
                )
            else:
                if tenant_id:
                    update_sql = text("""
                        UPDATE golden_records
                        SET version = :version, cluster_size = :cluster_size, source_record_ids = :source_record_ids,
                            attributes = :attributes, updated_at = :updated_at
                        WHERE golden_id = :golden_id AND tenant_id = :tenant_id
                    """)
                    update_params = {
                        "golden_id": raw_gid,
                        "tenant_id": tenant_id,
                        "version": new_version,
                        "cluster_size": snapshot["cluster_size"],
                        "source_record_ids": snapshot["source_record_ids"],
                        "attributes": snapshot["attributes"],
                        "updated_at": now_utc,
                    }
                else:
                    update_sql = text("""
                        UPDATE golden_records
                        SET version = :version, cluster_size = :cluster_size, source_record_ids = :source_record_ids,
                            attributes = :attributes, updated_at = :updated_at
                        WHERE golden_id = :golden_id
                    """)
                    update_params = {
                        "golden_id": raw_gid,
                        "version": new_version,
                        "cluster_size": snapshot["cluster_size"],
                        "source_record_ids": snapshot["source_record_ids"],
                        "attributes": snapshot["attributes"],
                        "updated_at": now_utc,
                    }
                conn.execute(update_sql, update_params)

            set_pg_search_path(conn, hist_schema)
            conn.execute(
                insert_history_sql,
                {
                    "id": str(uuid.uuid4()),
                    "golden_id": snapshot["golden_id"],
                    "tenant_id": snapshot["tenant_id"],
                    "version": new_version,
                    "cluster_size": snapshot["cluster_size"],
                    "source_record_ids": snapshot["source_record_ids"],
                    "attributes": snapshot["attributes"],
                    "created_at": now_utc,
                },
            )
        finally:
            reset_pg_search_path(conn)

    logger.info(
        "Rolled back Golden Record '%s' from v%d to snapshot v%d (recorded as v%d)",
        golden_id,
        current["version"],
        target_version,
        new_version,
    )

    return get_golden_record(raw_gid, tenant_id=tenant_id) or {}
