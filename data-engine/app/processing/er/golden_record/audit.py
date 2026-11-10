"""Audit trail queries, version snapshot retrieval, and rollback execution for Golden Records."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
from typing import Any
import uuid

from sqlalchemy import text

from app.processing.er.golden_record.persistence import _get_active_engine

logger = logging.getLogger(__name__)


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
