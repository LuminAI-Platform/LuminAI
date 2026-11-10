"""Dagster GraphQL status client for pipeline runs."""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from typing import Dict, Optional

from app.processing.run_tracker.models import RunRecord, RunStatusType

logger = logging.getLogger(__name__)


def query_dagster_graphql(graphql_url: str, run_id: str) -> Optional[RunRecord]:
    """Query Dagster GraphQL endpoint for run status if webserver is running."""
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
    payload = json.dumps({"query": query, "variables": {"runId": run_id}}).encode(
        "utf-8"
    )
    req = urllib.request.Request(
        graphql_url,
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
                pct = (
                    100
                    if status == "completed"
                    else min(int((len(steps_completed) / total_steps) * 100), 99)
                )

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
        logger.debug(
            "Dagster GraphQL query unreachable for run %s (%s)", run_id, exc
        )
    return None
