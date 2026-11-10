"""SQLite persistence backend for pipeline run records."""

from __future__ import annotations

import json
import logging
import os
import sqlite3
from typing import Optional

from app.processing.run_tracker.models import RunRecord

logger = logging.getLogger(__name__)


def init_db(db_path: str) -> None:
    """Initialize the SQLite run storage table and apply column migrations if needed."""
    try:
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        with sqlite3.connect(db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS pipeline_runs (
                    run_id TEXT PRIMARY KEY,
                    pipeline_name TEXT,
                    tenant_id TEXT,
                    source_id TEXT,
                    status TEXT,
                    progress_pct INTEGER,
                    current_step TEXT,
                    steps_completed TEXT,
                    total_steps INTEGER,
                    message TEXT,
                    error TEXT,
                    started_at TEXT,
                    completed_at TEXT,
                    dagster_run_id TEXT,
                    logs TEXT,
                    retry_count INTEGER DEFAULT 0,
                    failed_step TEXT,
                    error_history TEXT,
                    metadata TEXT
                );
                """
            )
            # Ensure new columns exist if table was previously created with older schema
            existing_cols = {
                row[1]
                for row in conn.execute(
                    "PRAGMA table_info(pipeline_runs)"
                ).fetchall()
            }
            if "retry_count" not in existing_cols:
                conn.execute(
                    "ALTER TABLE pipeline_runs ADD COLUMN retry_count INTEGER DEFAULT 0"
                )
            if "failed_step" not in existing_cols:
                conn.execute(
                    "ALTER TABLE pipeline_runs ADD COLUMN failed_step TEXT"
                )
            if "error_history" not in existing_cols:
                conn.execute(
                    "ALTER TABLE pipeline_runs ADD COLUMN error_history TEXT"
                )
            if "metadata" not in existing_cols:
                conn.execute("ALTER TABLE pipeline_runs ADD COLUMN metadata TEXT")
    except Exception as exc:
        logger.warning(
            "Could not initialize SQLite run storage at %s: %s", db_path, exc
        )


def persist_record(db_path: str, record: RunRecord) -> None:
    """Write or update record in SQLite database."""
    try:
        with sqlite3.connect(db_path) as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO pipeline_runs (
                    run_id, pipeline_name, tenant_id, source_id, status,
                    progress_pct, current_step, steps_completed, total_steps,
                    message, error, started_at, completed_at, dagster_run_id, logs,
                    retry_count, failed_step, error_history, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    record.run_id,
                    record.pipeline_name,
                    record.tenant_id,
                    record.source_id,
                    record.status,
                    record.progress_pct,
                    record.current_step,
                    json.dumps(record.steps_completed),
                    record.total_steps,
                    record.message,
                    record.error,
                    record.started_at,
                    record.completed_at,
                    record.dagster_run_id,
                    json.dumps(record.logs),
                    record.retry_count,
                    record.failed_step,
                    json.dumps(record.error_history),
                    json.dumps(record.metadata),
                ),
            )
    except Exception as exc:
        logger.debug("Failed to persist run %s to SQLite: %s", record.run_id, exc)


def load_record(db_path: str, run_id: str) -> Optional[RunRecord]:
    """Load a record from SQLite database by run_id."""
    if not os.path.exists(db_path):
        return None
    try:
        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.execute(
                "SELECT * FROM pipeline_runs WHERE run_id = ?", (run_id,)
            )
            row = cur.fetchone()
            if row:
                row_keys = row.keys()
                return RunRecord(
                    run_id=row["run_id"],
                    pipeline_name=row["pipeline_name"] or "pipeline",
                    tenant_id=row["tenant_id"] or "unknown",
                    source_id=row["source_id"] or "unknown",
                    status=row["status"] or "queued",
                    progress_pct=int(row["progress_pct"] or 0),
                    current_step=row["current_step"],
                    steps_completed=json.loads(row["steps_completed"] or "[]"),
                    total_steps=int(row["total_steps"] or 5),
                    message=row["message"] or "",
                    error=row["error"],
                    started_at=row["started_at"],
                    completed_at=row["completed_at"],
                    dagster_run_id=row["dagster_run_id"],
                    logs=json.loads(row["logs"] or "[]"),
                    retry_count=int(row["retry_count"])
                    if "retry_count" in row_keys and row["retry_count"] is not None
                    else 0,
                    failed_step=row["failed_step"]
                    if "failed_step" in row_keys
                    else None,
                    error_history=json.loads(row["error_history"] or "[]")
                    if "error_history" in row_keys and row["error_history"]
                    else [],
                    metadata=json.loads(row["metadata"] or "{}")
                    if "metadata" in row_keys and row["metadata"]
                    else {},
                )
    except Exception as exc:
        logger.debug("Failed to read run %s from SQLite: %s", run_id, exc)
    return None
