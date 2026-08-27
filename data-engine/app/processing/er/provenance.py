"""Entity Resolution (ER) Field-Level Provenance Tracking Engine.

Records field-level provenance metadata tracking which raw source dataset,
connector, and record contributed each property on the canonical Golden Record.
Persists metadata to the ``provenance`` database table.
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any

import polars as pl
from sqlalchemy import create_engine, text

from app.config import get_settings

logger = logging.getLogger(__name__)


def track_field_provenance(
    golden_record: dict[str, Any],
    cluster_records: list[dict[str, Any]],
    tenant_id: str = "acme",
) -> list[dict[str, Any]]:
    """Build field-level provenance entries for attributes of a Golden Record."""
    golden_id = str(golden_record.get("golden_id", ""))
    exclude_keys = {"golden_id", "tenant_id", "cluster_size", "source_record_ids", "created_at"}

    provenance_entries: list[dict[str, Any]] = []

    for attr, val in golden_record.items():
        if attr in exclude_keys or val is None or str(val).strip() == "":
            continue

        str_val = str(val).strip()
        contributor = None

        # Find which source record in the cluster contributed this attribute value
        for rec in cluster_records:
            rec_val = rec.get(attr)
            if rec_val is not None and str(rec_val).strip() == str_val:
                contributor = rec
                break

        if not contributor and cluster_records:
            contributor = cluster_records[0]

        source_rec_id = str(contributor.get("id", contributor.get("raw_id", "unknown"))) if contributor else "unknown"
        source_id = str(contributor.get("source_id", "unknown")) if contributor else "unknown"

        provenance_entries.append({
            "id": str(uuid.uuid4()),
            "golden_id": golden_id,
            "tenant_id": tenant_id,
            "attribute_name": attr,
            "attribute_value": str_val,
            "source_record_id": source_rec_id,
            "source_id": source_id,
            "confidence_score": float(golden_record.get("confidence_score", 1.0)),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    return provenance_entries


def persist_provenance_records(
    provenance_rows: list[dict[str, Any]] | pl.DataFrame,
    tenant_id: str = "acme",
) -> int:
    """Persist provenance rows to PostgreSQL / SQLite staging database table provenance."""
    if isinstance(provenance_rows, pl.DataFrame):
        rows = provenance_rows.to_dicts()
    else:
        rows = list(provenance_rows)

    if not rows:
        return 0

    settings = get_settings()

    db_url = (
        f"postgresql+pg8000://{settings.postgres_user}:{settings.postgres_password}"
        f"@{settings.postgres_host}:{settings.postgres_port}/{settings.postgres_db}"
    )

    create_table_sql = """
    CREATE TABLE IF NOT EXISTS provenance (
        id VARCHAR(36) PRIMARY KEY,
        golden_id VARCHAR(255),
        tenant_id VARCHAR(255),
        attribute_name VARCHAR(255),
        attribute_value TEXT,
        source_record_id VARCHAR(255),
        source_id VARCHAR(255),
        confidence_score FLOAT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """

    insert_sql = """
    INSERT INTO provenance (id, golden_id, tenant_id, attribute_name, attribute_value, source_record_id, source_id, confidence_score, created_at)
    VALUES (:id, :golden_id, :tenant_id, :attribute_name, :attribute_value, :source_record_id, :source_id, :confidence_score, :created_at);
    """

    now_utc = datetime.now(timezone.utc)
    params = []
    for r in rows:
        params.append({
            "id": str(r.get("id", uuid.uuid4())),
            "golden_id": str(r.get("golden_id", "")),
            "tenant_id": tenant_id,
            "attribute_name": str(r.get("attribute_name", "")),
            "attribute_value": str(r.get("attribute_value", "")),
            "source_record_id": str(r.get("source_record_id", "unknown")),
            "source_id": str(r.get("source_id", "unknown")),
            "confidence_score": float(r.get("confidence_score", 1.0)),
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
        logger.info("Persisted %d field-level provenance records to PostgreSQL", len(params))
        return len(params)
    except Exception as exc:
        logger.warning("Could not persist provenance to PostgreSQL (%s). Using SQLite fallback.", exc)
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
        logger.info("Persisted %d field-level provenance records to SQLite at %s", len(params), sqlite_path)
        return len(params)
    except Exception as exc:
        logger.error("Failed to persist provenance records to SQLite: %s", exc)
        return 0
    finally:
        if sqlite_engine is not None:
            sqlite_engine.dispose()
