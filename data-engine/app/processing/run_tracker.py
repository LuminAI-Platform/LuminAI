"""Pipeline execution run tracker and Dagster status integration.

Provides thread-safe in-memory and SQLite-backed tracking of pipeline runs
triggered via API or Kafka consumer, with real-time step progress calculation
and fallback querying to Dagster's GraphQL API.
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import threading
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from app.config import get_settings

logger = logging.getLogger(__name__)

RunStatusType = Literal["queued", "running", "completed", "failed"]


@dataclass
class RunRecord:
    """Represents the execution state and progress of a pipeline run."""

    run_id: str
    pipeline_name: str
    tenant_id: str
    source_id: str
    status: RunStatusType = "queued"
    progress_pct: int = 0
    current_step: Optional[str] = None
    steps_completed: List[str] = field(default_factory=list)
    total_steps: int = 5
    message: str = "Pipeline queued."
    error: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    dagster_run_id: Optional[str] = None
    logs: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class PipelineRunTracker:
    """Thread-safe tracker for pipeline execution states with SQLite persistence."""

    def __init__(self, db_path: Optional[str] = None) -> None:
        self.settings = get_settings()
        self._lock = threading.Lock()
        self._runs: Dict[str, RunRecord] = {}

        self.db_path = db_path or os.path.join("storage", "sqlite", "run_storage.db")
        self._init_db()

    def _init_db(self) -> None:
        """Initialize the SQLite run storage table if it does not exist."""
        try:
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            with sqlite3.connect(self.db_path) as conn:
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
                        logs TEXT
                    );
                    """
                )
        except Exception as exc:
            logger.warning("Could not initialize SQLite run storage at %s: %s", self.db_path, exc)

    def _persist_to_db(self, record: RunRecord) -> None:
        """Write or update record in SQLite."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO pipeline_runs (
                        run_id, pipeline_name, tenant_id, source_id, status,
                        progress_pct, current_step, steps_completed, total_steps,
                        message, error, started_at, completed_at, dagster_run_id, logs
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
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
                    ),
                )
        except Exception as exc:
            logger.debug("Failed to persist run %s to SQLite: %s", record.run_id, exc)

    def _load_from_db(self, run_id: str) -> Optional[RunRecord]:
        """Load a record from SQLite by run_id."""
        if not os.path.exists(self.db_path):
            return None
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cur = conn.execute("SELECT * FROM pipeline_runs WHERE run_id = ?", (run_id,))
                row = cur.fetchone()
                if row:
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
                    )
        except Exception as exc:
            logger.debug("Failed to read run %s from SQLite: %s", run_id, exc)
        return None

    def init_run(
        self,
        run_id: str,
        pipeline_name: str,
        tenant_id: str,
        source_id: str,
        total_steps: int = 5,
        message: Optional[str] = None,
    ) -> RunRecord:
        """Create and register a newly queued pipeline run."""
        rec = RunRecord(
            run_id=run_id,
            pipeline_name=pipeline_name,
            tenant_id=tenant_id,
            source_id=source_id,
            status="queued",
            progress_pct=0,
            total_steps=total_steps,
            message=message or f"{pipeline_name} queued for source '{source_id}' (tenant: {tenant_id}).",
        )
        with self._lock:
            self._runs[run_id] = rec
            self._persist_to_db(rec)
        return rec

    def start_run(
        self,
        run_id: str,
        message: Optional[str] = None,
        dagster_run_id: Optional[str] = None,
    ) -> RunRecord:
        """Transition a run to 'running' status."""
        with self._lock:
            rec = self._runs.get(run_id) or self._load_from_db(run_id)
            if not rec:
                rec = RunRecord(
                    run_id=run_id,
                    pipeline_name="pipeline",
                    tenant_id="unknown",
                    source_id="unknown",
                )
            rec.status = "running"
            rec.started_at = datetime.now(timezone.utc).isoformat()
            if dagster_run_id:
                rec.dagster_run_id = dagster_run_id
            rec.message = message or "Pipeline execution started."
            self._runs[run_id] = rec
            self._persist_to_db(rec)
            return rec

    def update_step(
        self,
        run_id: str,
        step_name: str,
        message: Optional[str] = None,
    ) -> RunRecord:
        """Record progress when a pipeline step or asset finishes."""
        with self._lock:
            rec = self._runs.get(run_id) or self._load_from_db(run_id)
            if not rec:
                rec = RunRecord(
                    run_id=run_id,
                    pipeline_name="pipeline",
                    tenant_id="unknown",
                    source_id="unknown",
                    status="running",
                )
            if step_name not in rec.steps_completed:
                rec.steps_completed.append(step_name)
            rec.current_step = step_name
            # Progress calculation based on completed steps (capped at 99% until fully completed)
            completed_count = len(rec.steps_completed)
            calc_pct = int((completed_count / max(rec.total_steps, 1)) * 100)
            rec.progress_pct = min(calc_pct, 99)
            rec.message = message or f"Completed step '{step_name}' ({rec.progress_pct}%)."
            rec.logs.append(f"[{datetime.now(timezone.utc).isoformat()}] Step: {step_name}")
            self._runs[run_id] = rec
            self._persist_to_db(rec)
            return rec

    def complete_run(
        self,
        run_id: str,
        dagster_run_id: Optional[str] = None,
        message: Optional[str] = None,
    ) -> RunRecord:
        """Mark a pipeline run as 'completed' (100%)."""
        with self._lock:
            rec = self._runs.get(run_id) or self._load_from_db(run_id)
            if not rec:
                rec = RunRecord(
                    run_id=run_id,
                    pipeline_name="pipeline",
                    tenant_id="unknown",
                    source_id="unknown",
                )
            rec.status = "completed"
            rec.progress_pct = 100
            rec.completed_at = datetime.now(timezone.utc).isoformat()
            if dagster_run_id:
                rec.dagster_run_id = dagster_run_id
            rec.message = message or "Pipeline execution completed successfully."
            rec.logs.append(f"[{rec.completed_at}] Pipeline completed successfully.")
            self._runs[run_id] = rec
            self._persist_to_db(rec)
            return rec

    def fail_run(
        self,
        run_id: str,
        error: str,
        message: Optional[str] = None,
    ) -> RunRecord:
        """Mark a pipeline run as 'failed' with error details."""
        with self._lock:
            rec = self._runs.get(run_id) or self._load_from_db(run_id)
            if not rec:
                rec = RunRecord(
                    run_id=run_id,
                    pipeline_name="pipeline",
                    tenant_id="unknown",
                    source_id="unknown",
                )
            rec.status = "failed"
            rec.error = error
            rec.completed_at = datetime.now(timezone.utc).isoformat()
            rec.message = message or f"Pipeline execution failed: {error}"
            rec.logs.append(f"[{rec.completed_at}] Error: {error}")
            self._runs[run_id] = rec
            self._persist_to_db(rec)
            return rec

    def query_dagster_graphql(self, run_id: str) -> Optional[RunRecord]:
        """Query Dagster GraphQL endpoint for run status if webserver is running."""
        url = self.settings.resolved_dagster_graphql_url
        query = """
        query GetRunStatus($runId: ID!) {
            pipelineRunOrError(runId: $runId) {
                __typename
                ... on Run {
                    runId
                    status
                    stepStats {
                        stepKey
                        status
                    }
                }
                ... on RunNotFoundError {
                    message
                }
            }
        }
        """
        payload = json.dumps({"query": query, "variables": {"runId": run_id}}).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=2.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                run_data = data.get("data", {}).get("pipelineRunOrError", {})
                if run_data.get("__typename") == "Run":
                    raw_status = run_data.get("status", "QUEUED")
                    status_map: Dict[str, RunStatusType] = {
                        "SUCCESS": "completed",
                        "FAILURE": "failed",
                        "STARTED": "running",
                        "STARTING": "running",
                        "QUEUED": "queued",
                        "NOT_STARTED": "queued",
                        "CANCELING": "failed",
                        "CANCELED": "failed",
                    }
                    status = status_map.get(raw_status, "running")

                    step_stats = run_data.get("stepStats") or []
                    steps_completed = [
                        s["stepKey"] for s in step_stats if s.get("status") == "SUCCESS"
                    ]
                    total_steps = len(step_stats) or 5
                    pct = 100 if status == "completed" else min(int((len(steps_completed) / total_steps) * 100), 99)

                    return RunRecord(
                        run_id=run_id,
                        dagster_run_id=run_id,
                        pipeline_name="dagster_pipeline",
                        tenant_id="dagster",
                        source_id="dagster",
                        status=status,
                        progress_pct=pct,
                        steps_completed=steps_completed,
                        total_steps=total_steps,
                        message=f"Dagster run status: {raw_status}",
                    )
        except Exception as exc:
            logger.debug("Dagster GraphQL query unreachable for run %s (%s)", run_id, exc)
        return None

    def get_status(self, run_id: str) -> RunRecord:
        """Retrieve the current execution status of a pipeline run."""
        with self._lock:
            # 1. Check in-memory store
            if run_id in self._runs:
                return self._runs[run_id]

        # 2. Check persistent SQLite store
        db_rec = self._load_from_db(run_id)
        if db_rec:
            with self._lock:
                self._runs[run_id] = db_rec
            return db_rec

        # 3. Check Dagster GraphQL if available
        dagster_rec = self.query_dagster_graphql(run_id)
        if dagster_rec:
            with self._lock:
                self._runs[run_id] = dagster_rec
                self._persist_to_db(dagster_rec)
            return dagster_rec

        # 4. Unknown run fallback (status='failed', progress_pct=0 with clear message)
        return RunRecord(
            run_id=run_id,
            pipeline_name="unknown",
            tenant_id="unknown",
            source_id="unknown",
            status="failed",
            progress_pct=0,
            message=f"Pipeline run '{run_id}' not found in Dagster or active queue.",
        )


_global_tracker: Optional[PipelineRunTracker] = None
_tracker_lock = threading.Lock()


def get_run_tracker() -> PipelineRunTracker:
    """Return the global singleton PipelineRunTracker instance."""
    global _global_tracker
    with _tracker_lock:
        if _global_tracker is None:
            _global_tracker = PipelineRunTracker()
        return _global_tracker
