"""Thread-safe pipeline execution run tracker implementation."""

from __future__ import annotations

import logging
import os
import threading
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.config import get_settings
from app.processing.run_tracker.graphql import query_dagster_graphql as _query_graphql
from app.processing.run_tracker.models import RunRecord
from app.processing.run_tracker.storage import (
    init_db,
    load_record,
    persist_record,
)

logger = logging.getLogger(__name__)


class PipelineRunTracker:
    """Thread-safe tracker for pipeline execution states with SQLite persistence."""

    def __init__(self, db_path: Optional[str] = None) -> None:
        self.settings = get_settings()
        self._lock = threading.Lock()
        self._runs: Dict[str, RunRecord] = {}

        self.db_path = db_path or os.path.join("storage", "sqlite", "run_storage.db")
        self._init_db()

    def _init_db(self) -> None:
        """Initialize SQLite database storage."""
        init_db(self.db_path)

    def _persist_to_db(self, record: RunRecord) -> None:
        """Persist a RunRecord to SQLite database."""
        persist_record(self.db_path, record)

    def _load_from_db(self, run_id: str) -> Optional[RunRecord]:
        """Load a RunRecord from SQLite database."""
        return load_record(self.db_path, run_id)

    def init_run(
        self,
        run_id: str,
        pipeline_name: str,
        tenant_id: str,
        source_id: str,
        total_steps: int = 5,
        message: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
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
            message=message
            or f"{pipeline_name} queued for source '{source_id}' (tenant: {tenant_id}).",
            metadata=metadata or {},
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
            completed_count = len(rec.steps_completed)
            calc_pct = int((completed_count / max(rec.total_steps, 1)) * 100)
            rec.progress_pct = min(calc_pct, 99)
            rec.message = (
                message or f"Completed step '{step_name}' ({rec.progress_pct}%)."
            )
            rec.logs.append(
                f"[{datetime.now(timezone.utc).isoformat()}] Step: {step_name}"
            )
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

    def record_step_error(
        self,
        run_id: str,
        step_name: str,
        error: str,
        retry_count: Optional[int] = None,
    ) -> RunRecord:
        """Record step-specific failure details in error history."""
        with self._lock:
            rec = self._runs.get(run_id) or self._load_from_db(run_id)
            if not rec:
                rec = RunRecord(
                    run_id=run_id,
                    pipeline_name="pipeline",
                    tenant_id="unknown",
                    source_id="unknown",
                )
            rec.failed_step = step_name
            rec.error = error
            now_iso = datetime.now(timezone.utc).isoformat()
            rec.error_history.append(
                {
                    "step": step_name,
                    "error": error,
                    "timestamp": now_iso,
                    "retry_count": rec.retry_count
                    if retry_count is None
                    else retry_count,
                }
            )
            rec.logs.append(f"[{now_iso}] Step '{step_name}' failed: {error}")
            self._runs[run_id] = rec
            self._persist_to_db(rec)
            return rec

    def fail_run(
        self,
        run_id: str,
        error: str,
        message: Optional[str] = None,
        failed_step: Optional[str] = None,
    ) -> RunRecord:
        """Mark a pipeline run as 'failed' with error details and step history."""
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
            if failed_step:
                rec.failed_step = failed_step
            elif rec.current_step and not rec.failed_step:
                rec.failed_step = rec.current_step

            now_iso = datetime.now(timezone.utc).isoformat()
            rec.completed_at = now_iso
            rec.message = message or f"Pipeline execution failed: {error}"
            rec.logs.append(f"[{now_iso}] Error: {error}")

            if not rec.error_history or rec.error_history[-1].get("error") != error:
                rec.error_history.append(
                    {
                        "step": rec.failed_step or "pipeline",
                        "error": error,
                        "timestamp": now_iso,
                        "retry_count": rec.retry_count,
                    }
                )

            self._runs[run_id] = rec
            self._persist_to_db(rec)
            return rec

    def retry_run(
        self,
        run_id: str,
        message: Optional[str] = None,
    ) -> RunRecord:
        """Reset a failed run for partial re-execution, incrementing retry count."""
        with self._lock:
            rec = self._runs.get(run_id) or self._load_from_db(run_id)
            if not rec:
                rec = RunRecord(
                    run_id=run_id,
                    pipeline_name="pipeline",
                    tenant_id="unknown",
                    source_id="unknown",
                )
            rec.retry_count += 1
            rec.status = "running"
            rec.error = None
            now_iso = datetime.now(timezone.utc).isoformat()
            resumed_from = rec.failed_step or "checkpoint"
            rec.message = (
                message
                or f"Retrying pipeline run (attempt {rec.retry_count}/3) resuming from step '{resumed_from}'."
            )
            rec.logs.append(
                f"[{now_iso}] Retry attempt {rec.retry_count} started (resuming after '{resumed_from}')."
            )
            self._runs[run_id] = rec
            self._persist_to_db(rec)
            return rec

    def query_dagster_graphql(self, run_id: str) -> Optional[RunRecord]:
        """Query Dagster GraphQL endpoint for run status if webserver is running."""
        return _query_graphql(self.settings.resolved_dagster_graphql_url, run_id)

    def get_status(self, run_id: str) -> RunRecord:
        """Retrieve the current execution status of a pipeline run."""
        with self._lock:
            if run_id in self._runs:
                return self._runs[run_id]

        db_rec = self._load_from_db(run_id)
        if db_rec:
            with self._lock:
                self._runs[run_id] = db_rec
            return db_rec

        dagster_rec = self.query_dagster_graphql(run_id)
        if dagster_rec:
            with self._lock:
                self._runs[run_id] = dagster_rec
                self._persist_to_db(dagster_rec)
            return dagster_rec

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
