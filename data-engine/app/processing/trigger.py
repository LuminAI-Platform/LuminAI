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
from typing import Any, Dict, Optional

from dagster import materialize

from app.processing.pipelines import cleaning_pipeline, er_pipeline
from app.processing.reconciliation import run_cross_store_reconciliation

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
    ) -> str | None:
        """
        Launch a cleaning pipeline run for the given tenant and source.

        Args:
            tenant_id:      Tenant scoping the pipeline run.
            source_id:      ID of the data source that finished ingestion.
            batch_metadata: Full batch-complete message payload from Kafka,
                            including row counts, source path, and schema info.

        Returns:
            The Dagster run ID if successful, or ``None`` on failure.
        """
        logger.info(
            "Triggering cleaning pipeline — tenant=%s, source=%s, rows=%s",
            tenant_id,
            source_id,
            batch_metadata.get("total_rows") or batch_metadata.get("totalRows", "unknown"),
        )

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
                tags={
                    "tenant_id": tenant_id,
                    "source_id": source_id,
                    "trigger": "kafka_batch_complete",
                },
            )

            if result.success:
                run_id = str(result.run_id) if hasattr(result, "run_id") else "in-process"
                logger.info(
                    "✅ Cleaning pipeline completed — tenant=%s, source=%s, run_id=%s",
                    tenant_id,
                    source_id,
                    run_id,
                )
                return run_id
            else:
                logger.error(
                    "❌ Cleaning pipeline failed — tenant=%s, source=%s",
                    tenant_id,
                    source_id,
                )
                return None

        except Exception:
            logger.exception(
                "❌ Error triggering cleaning pipeline — tenant=%s, source=%s",
                tenant_id,
                source_id,
            )
            return None

    def trigger_er_pipeline(
        self,
        tenant_id: str = "acme",
        source_id: str = "default-source",
    ) -> str | None:
        """Launch an Entity Resolution pipeline run for the given tenant."""
        logger.info("Triggering Entity Resolution pipeline — tenant=%s, source=%s", tenant_id, source_id)

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
                },
            )

            if result.success:
                run_id = str(result.run_id) if hasattr(result, "run_id") else "in-process"
                logger.info("✅ ER pipeline completed — tenant=%s, run_id=%s", tenant_id, run_id)
                return run_id
            else:
                logger.error("❌ ER pipeline failed — tenant=%s", tenant_id)
                return None
        except Exception:
            logger.exception("❌ Error triggering ER pipeline — tenant=%s", tenant_id)
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
