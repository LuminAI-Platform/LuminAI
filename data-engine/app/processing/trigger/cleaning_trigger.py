"""Cleaning pipeline execution trigger for Dagster."""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any, Optional

import app.processing.trigger as trig
from app.config import get_settings
from app.logging import bind_context
from app.processing.checks import (
    cleaning_max_null_percentage_check,
    cleaning_min_row_count_check,
    cleaning_value_range_check,
)
from app.processing.pipelines import cleaning_pipeline
from app.processing.run_tracker import get_run_tracker
from app.telemetry import record_pipeline_duration, trace_span

logger = logging.getLogger(__name__)


def execute_cleaning_pipeline(
    trigger_instance,
    tenant_id: str,
    source_id: str,
    batch_metadata: dict[str, Any],
    run_id: Optional[str] = None,
) -> str | None:
    """Launch a cleaning pipeline run for the given tenant and source."""
    active_run_id = run_id or batch_metadata.get("run_id") or str(uuid.uuid4())
    bind_context(
        tenant_id=str(tenant_id), source_id=str(source_id), run_id=active_run_id
    )
    tracker = get_run_tracker()
    tracker.start_run(
        active_run_id,
        message=f"Starting data cleaning pipeline for source '{source_id}' (tenant: {tenant_id}).",
    )

    logger.info(
        "Triggering cleaning pipeline — tenant=%s, source=%s, rows=%s, run_id=%s",
        tenant_id,
        source_id,
        batch_metadata.get("total_rows") or batch_metadata.get("totalRows", "unknown"),
        active_run_id,
    )

    object_key = (
        batch_metadata.get("object_key")
        or batch_metadata.get("s3_key")
        or batch_metadata.get("file_path")
        or batch_metadata.get("source_path")
        or batch_metadata.get("filePath")
        or batch_metadata.get("key")
    )
    bucket = (
        batch_metadata.get("bucket")
        or batch_metadata.get("s3_bucket")
        or batch_metadata.get("bucket_name")
    )

    entity_type = (
        batch_metadata.get("entity_type")
        or batch_metadata.get("entityType")
        or batch_metadata.get("targetEntityType")
    )

    tags: dict[str, str] = {
        "tenant_id": str(tenant_id),
        "source_id": str(source_id),
        "trigger": "kafka_batch_complete",
        "luminai_run_id": str(active_run_id),
    }
    if entity_type:
        tags["entity_type"] = str(entity_type)
    if object_key:
        tags["object_key"] = str(object_key)
    if bucket:
        tags["bucket"] = str(bucket)

    settings = get_settings()
    raw_total_rows = batch_metadata.get("total_rows") or batch_metadata.get("totalRows")
    raw_file_size = batch_metadata.get("file_size_bytes") or batch_metadata.get("fileSizeBytes")
    if raw_total_rows is not None:
        tags["source_total_rows"] = str(raw_total_rows)
    if raw_file_size is not None:
        tags["file_size_bytes"] = str(raw_file_size)

    explicit_max_rows = batch_metadata.get("max_rows")
    if explicit_max_rows is not None:
        tags["max_rows"] = str(int(explicit_max_rows))
    elif object_key and settings.pipeline_max_ingest_rows > 0:
        tags["max_rows"] = str(settings.pipeline_max_ingest_rows)

    if object_key and settings.pipeline_max_download_bytes > 0:
        tags["max_bytes"] = str(settings.pipeline_max_download_bytes)

    start_time = time.perf_counter()
    try:
        with trace_span(
            "pipeline.orchestration.cleaning",
            attributes={
                "tenant.id": str(tenant_id),
                "source.id": str(source_id),
                "run.id": str(active_run_id),
                "trigger": "kafka_batch_complete",
            },
        ):
            result = trig.materialize(
                assets=[
                    cleaning_pipeline.raw_ingestion_data,
                    cleaning_pipeline.cleaned_ingestion_data,
                    cleaning_pipeline.deduplicated_ingestion_data,
                    cleaning_pipeline.validated_ingestion_data,
                    cleaning_pipeline.staged_ingestion_data,
                    cleaning_min_row_count_check,
                    cleaning_max_null_percentage_check,
                    cleaning_value_range_check,
                ],
                run_config={
                    "resources": {},
                },
                tags=tags,
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
                record_pipeline_duration(
                    "cleaning_pipeline", duration, status="success"
                )
                step_names = [
                    e.step_key
                    for e in result.all_events
                    if getattr(e, "is_step_success", False)
                ]
                tracker.complete_run(
                    active_run_id,
                    dagster_run_id=dagster_run_id,
                    message=f"Cleaning pipeline completed: {len(step_names)} assets materialized successfully.",
                )
                from app.processing.checkpoint import get_checkpoint_manager

                get_checkpoint_manager().clear_checkpoints(active_run_id)
                logger.info(
                    "✅ Cleaning pipeline completed — tenant=%s, source=%s, run_id=%s, dagster_run_id=%s (took %.2fs)",
                    tenant_id,
                    source_id,
                    active_run_id,
                    dagster_run_id,
                    duration,
                )
                # Automatically trigger Entity Resolution pipeline for complete pipeline orchestration
                if batch_metadata.get("auto_er", False):
                    try:
                        logger.info(
                            "🚀 Auto-triggering Entity Resolution pipeline post-cleaning — tenant=%s, source=%s",
                            tenant_id,
                            source_id,
                        )
                        trigger_instance.trigger_er_pipeline(
                            tenant_id=tenant_id,
                            source_id=source_id,
                        )
                    except Exception as er_exc:
                        logger.warning(
                            "⚠️ Automated post-cleaning ER trigger encountered an issue: %s",
                            er_exc,
                        )
                # Automatically generate relational edges if foreign keys specified
                if batch_metadata.get("foreign_keys") or batch_metadata.get(
                    "generate_edges"
                ):
                    try:
                        logger.info(
                            "🔗 Auto-triggering relational edge generator post-cleaning — tenant=%s, source=%s",
                            tenant_id,
                            source_id,
                        )
                        trigger_instance.generate_relational_edges(
                            tenant_id=tenant_id,
                            source_id=source_id,
                            foreign_keys=batch_metadata.get("foreign_keys"),
                            source_entity_type=batch_metadata.get("entity_type"),
                        )
                    except Exception as edge_exc:
                        logger.warning(
                            "⚠️ Automated post-cleaning relational edge generation encountered an issue: %s",
                            edge_exc,
                        )
                return dagster_run_id
            else:
                duration = time.perf_counter() - start_time
                record_pipeline_duration("cleaning_pipeline", duration, status="failed")
                tracker.fail_run(
                    active_run_id,
                    error="Dagster materialization completed with errors.",
                    message="Cleaning pipeline execution failed.",
                    failed_step=failed_step,
                )
                logger.error(
                    "❌ Cleaning pipeline failed — tenant=%s, source=%s, run_id=%s, failed_step=%s",
                    tenant_id,
                    source_id,
                    active_run_id,
                    failed_step,
                )
                return None

    except Exception as exc:
        duration = time.perf_counter() - start_time
        record_pipeline_duration("cleaning_pipeline", duration, status="failed")
        tracker.fail_run(
            active_run_id,
            error=str(exc),
            message=f"Cleaning pipeline error: {exc}",
        )
        logger.exception(
            "❌ Error triggering cleaning pipeline — tenant=%s, source=%s, run_id=%s",
            tenant_id,
            source_id,
            active_run_id,
        )
        return None
