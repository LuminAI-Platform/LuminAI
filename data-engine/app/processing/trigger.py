"""Programmatic trigger for Dagster pipeline runs.

When the Kafka consumer receives a batch-complete signal on ``ingest.raw``,
this module launches a Dagster asset materialization for the cleaning pipeline.
Also supports programmatic triggers for Entity Resolution (ER) and Data Reconciliation.

Orchestration strategy: Uses in-process trigger with ``dagster.materialize``.
Production deployment can switch to the Dagster GraphQL API for
decoupled daemon execution.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Optional

from dagster import materialize

from app.processing.pipelines import cleaning_pipeline, er_pipeline
from app.processing.reconciliation import run_cross_store_reconciliation
from app.processing.run_tracker import get_run_tracker

logger = logging.getLogger(__name__)


class DagsterTrigger:
    """
    Triggers Dagster pipeline materializations programmatically.

    Used as the ``on_batch_complete`` callback from
    :class:`~app.kafka.consumers.IngestRawConsumer`.
    """

    def trigger_cleaning_pipeline(
        self,
        tenant_id: str,
        source_id: str,
        batch_metadata: dict[str, Any],
        run_id: Optional[str] = None,
    ) -> str | None:
        """
        Launch a cleaning pipeline run for the given tenant and source.

        Args:
            tenant_id:      Tenant scoping the pipeline run.
            source_id:      ID of the data source that finished ingestion.
            batch_metadata: Full batch-complete message payload from Kafka,
                            including row counts, source path, and schema info.
            run_id:         Optional pre-registered pipeline execution tracking ID.

        Returns:
            The Dagster run ID if successful, or ``None`` on failure.
        """
        active_run_id = run_id or batch_metadata.get("run_id") or str(uuid.uuid4())
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

        tags: dict[str, str] = {
            "tenant_id": str(tenant_id),
            "source_id": str(source_id),
            "trigger": "kafka_batch_complete",
            "luminai_run_id": str(active_run_id),
        }
        if object_key:
            tags["object_key"] = str(object_key)
        if bucket:
            tags["bucket"] = str(bucket)

        try:
            # In-process materialization
            result = materialize(
                assets=[
                    cleaning_pipeline.raw_ingestion_data,
                    cleaning_pipeline.cleaned_ingestion_data,
                    cleaning_pipeline.deduplicated_ingestion_data,
                    cleaning_pipeline.validated_ingestion_data,
                    cleaning_pipeline.staged_ingestion_data,
                ],
                run_config={
                    "resources": {},
                },
                tags=tags,
            )

            dagster_run_id = str(result.run_id) if hasattr(result, "run_id") else active_run_id

            if result.success:
                step_names = [
                    e.step_key for e in result.all_events if getattr(e, "is_step_success", False)
                ]
                for step in step_names:
                    tracker.update_step(active_run_id, step)

                tracker.complete_run(
                    active_run_id,
                    dagster_run_id=dagster_run_id,
                    message=f"Cleaning pipeline completed: {len(step_names)} assets materialized successfully.",
                )
                logger.info(
                    "✅ Cleaning pipeline completed — tenant=%s, source=%s, run_id=%s, dagster_run_id=%s",
                    tenant_id,
                    source_id,
                    active_run_id,
                    dagster_run_id,
                )
                return dagster_run_id
            else:
                tracker.fail_run(
                    active_run_id,
                    error="Dagster materialization completed with errors.",
                    message="Cleaning pipeline execution failed.",
                )
                logger.error(
                    "❌ Cleaning pipeline failed — tenant=%s, source=%s, run_id=%s",
                    tenant_id,
                    source_id,
                    active_run_id,
                )
                return None

        except Exception as exc:
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

    def trigger_er_pipeline(
        self,
        tenant_id: str = "acme",
        source_id: str = "default-source",
        run_id: Optional[str] = None,
    ) -> str | None:
        """Launch an Entity Resolution pipeline run for the given tenant."""
        active_run_id = run_id or str(uuid.uuid4())
        tracker = get_run_tracker()
        tracker.start_run(
            active_run_id,
            message=f"Starting Entity Resolution pipeline for tenant '{tenant_id}'.",
        )

        logger.info("Triggering Entity Resolution pipeline — tenant=%s, source=%s, run_id=%s", tenant_id, source_id, active_run_id)

        try:
            result = materialize(
                assets=[
                    er_pipeline.staged_records_for_er,
                    er_pipeline.er_blocked_pairs,
                    er_pipeline.er_scored_pairs,
                    er_pipeline.er_classified_pairs,
                    er_pipeline.er_golden_records,
                ],
                run_config={"resources": {}},
                tags={
                    "tenant_id": tenant_id,
                    "source_id": source_id,
                    "trigger": "manual_or_schedule",
                    "luminai_run_id": active_run_id,
                },
            )

            dagster_run_id = str(result.run_id) if hasattr(result, "run_id") else active_run_id

            if result.success:
                step_names = [
                    e.step_key for e in result.all_events if getattr(e, "is_step_success", False)
                ]
                for step in step_names:
                    tracker.update_step(active_run_id, step)

                tracker.complete_run(
                    active_run_id,
                    dagster_run_id=dagster_run_id,
                    message=f"Entity Resolution pipeline completed: {len(step_names)} assets materialized.",
                )
                logger.info("✅ ER pipeline completed — tenant=%s, run_id=%s, dagster_run_id=%s", tenant_id, active_run_id, dagster_run_id)
                return dagster_run_id
            else:
                tracker.fail_run(
                    active_run_id,
                    error="Dagster ER materialization failed.",
                    message="Entity Resolution pipeline failed.",
                )
                logger.error("❌ ER pipeline failed — tenant=%s, run_id=%s", tenant_id, active_run_id)
                return None
        except Exception as exc:
            tracker.fail_run(
                active_run_id,
                error=str(exc),
                message=f"Entity Resolution error: {exc}",
            )
            logger.exception("❌ Error triggering ER pipeline — tenant=%s, run_id=%s", tenant_id, active_run_id)
            return None


    def trigger_reconciliation(
        self,
        tenant_id: str = "acme",
        entity_type: str = "Person",
        pg_records: Optional[list[dict[str, Any]]] = None,
        neo4j_records: Optional[list[dict[str, Any]]] = None,
        opensearch_records: Optional[list[dict[str, Any]]] = None,
    ) -> dict[str, Any]:
        """Execute a cross-store reconciliation job and return the report dict."""
        logger.info("Triggering Cross-Store Reconciliation — tenant=%s, entity_type=%s", tenant_id, entity_type)
        report = run_cross_store_reconciliation(
            tenant_id=tenant_id,
            entity_type=entity_type,
            pg_records=pg_records,
            neo4j_records=neo4j_records,
            opensearch_records=opensearch_records,
        )
        return report.model_dump()
