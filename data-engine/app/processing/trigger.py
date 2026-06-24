"""
app/processing/trigger.py
--------------------------
Programmatic trigger for Dagster pipeline runs.

When the Kafka consumer receives a batch-complete signal on ``ingest.raw``,
this module launches a Dagster asset materialization for the cleaning pipeline.

Sprint 1 approach: In-process trigger using ``dagster.materialize`` for
simplicity. Production will switch to the Dagster GraphQL API for
decoupled orchestration.
"""

from __future__ import annotations

import logging
from typing import Any

from dagster import materialize

from app.processing.pipelines import cleaning_pipeline

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
            batch_metadata.get("total_rows", "unknown"),
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
