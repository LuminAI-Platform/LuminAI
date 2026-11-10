"""Entity Resolution pipeline execution trigger for Dagster."""

from __future__ import annotations

import logging
import time
import uuid
from typing import Optional

import app.processing.trigger as trig
from app.logging import bind_context
from app.processing.checks import er_referential_integrity_check
from app.processing.pipelines import er_pipeline
from app.processing.run_tracker import get_run_tracker
from app.telemetry import record_pipeline_duration, trace_span

logger = logging.getLogger(__name__)


def execute_er_pipeline(
    tenant_id: str = "acme",
    source_id: str = "default-source",
    run_id: Optional[str] = None,
) -> str | None:
    """Launch an Entity Resolution pipeline run for the given tenant."""
    active_run_id = run_id or str(uuid.uuid4())
    bind_context(
        tenant_id=str(tenant_id), source_id=str(source_id), run_id=active_run_id
    )
    tracker = get_run_tracker()
    tracker.start_run(
        active_run_id,
        message=f"Starting Entity Resolution pipeline for tenant '{tenant_id}'.",
    )

    logger.info(
        "Triggering Entity Resolution pipeline — tenant=%s, source=%s, run_id=%s",
        tenant_id,
        source_id,
        active_run_id,
    )

    start_time = time.perf_counter()
    try:
        with trace_span(
            "pipeline.orchestration.er",
            attributes={
                "tenant.id": str(tenant_id),
                "source.id": str(source_id),
                "run.id": str(active_run_id),
                "trigger": "manual_or_schedule",
            },
        ):
            result = trig.materialize(
                assets=[
                    er_pipeline.staged_records_for_er,
                    er_pipeline.er_blocked_pairs,
                    er_pipeline.er_scored_pairs,
                    er_pipeline.er_classified_pairs,
                    er_pipeline.er_golden_records,
                    er_referential_integrity_check,
                ],
                run_config={"resources": {}},
                tags={
                    "tenant_id": tenant_id,
                    "source_id": source_id,
                    "trigger": "manual_or_schedule",
                    "luminai_run_id": active_run_id,
                },
            )

            dagster_run_id = (
                str(result.run_id) if hasattr(result, "run_id") else active_run_id
            )

            # Track individual step successes and failures
            failed_step = None
            for event in result.all_events:
                if getattr(event, "is_step_success", False):
                    tracker.update_step(active_run_id, event.step_key)
                elif getattr(event, "is_step_failure", False):
                    failed_step = event.step_key
                    err_msg = str(
                        getattr(event, "step_failure_data", None)
                        or f"Step '{event.step_key}' failed"
                    )
                    tracker.record_step_error(
                        active_run_id, step_name=event.step_key, error=err_msg
                    )

            if result.success:
                duration = time.perf_counter() - start_time
                record_pipeline_duration("er_pipeline", duration, status="success")
                step_names = [
                    e.step_key
                    for e in result.all_events
                    if getattr(e, "is_step_success", False)
                ]
                tracker.complete_run(
                    active_run_id,
                    dagster_run_id=dagster_run_id,
                    message=f"Entity Resolution pipeline completed: {len(step_names)} assets materialized.",
                )
                logger.info(
                    "✅ ER pipeline completed — tenant=%s, run_id=%s, dagster_run_id=%s (took %.2fs)",
                    tenant_id,
                    active_run_id,
                    dagster_run_id,
                    duration,
                )
                return dagster_run_id
            else:
                duration = time.perf_counter() - start_time
                record_pipeline_duration("er_pipeline", duration, status="failed")
                tracker.fail_run(
                    active_run_id,
                    error="Dagster ER materialization failed.",
                    message="Entity Resolution pipeline failed.",
                    failed_step=failed_step,
                )
                logger.error(
                    "❌ ER pipeline failed — tenant=%s, run_id=%s, failed_step=%s",
                    tenant_id,
                    active_run_id,
                    failed_step,
                )
                return None
    except Exception as exc:
        duration = time.perf_counter() - start_time
        record_pipeline_duration("er_pipeline", duration, status="failed")
        tracker.fail_run(
            active_run_id,
            error=str(exc),
            message=f"Entity Resolution error: {exc}",
        )
        logger.exception(
            "❌ Error triggering ER pipeline — tenant=%s, run_id=%s",
            tenant_id,
            active_run_id,
        )
        return None
