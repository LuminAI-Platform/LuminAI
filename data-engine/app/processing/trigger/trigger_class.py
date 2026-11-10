"""DagsterTrigger orchestrator class for LuminAI."""

from __future__ import annotations

import logging
from typing import Any, Optional

from app.processing.reconciliation import run_cross_store_reconciliation
from app.processing.run_tracker import get_run_tracker
from app.processing.trigger.cleaning_trigger import execute_cleaning_pipeline
from app.processing.trigger.edges_trigger import execute_generate_relational_edges
from app.processing.trigger.er_trigger import execute_er_pipeline

logger = logging.getLogger(__name__)


class DagsterTrigger:
    """Triggers Dagster pipeline materializations programmatically.

    Exposes methods to queue or execute cleaning, entity resolution,
    and reconciliation asset definitions.
    """

    def trigger_cleaning_pipeline(
        self,
        tenant_id: str,
        source_id: str,
        batch_metadata: dict[str, Any],
        run_id: Optional[str] = None,
    ) -> str | None:
        """Launch a cleaning pipeline run for the given tenant and source."""
        return execute_cleaning_pipeline(
            trigger_instance=self,
            tenant_id=tenant_id,
            source_id=source_id,
            batch_metadata=batch_metadata,
            run_id=run_id,
        )

    def trigger_er_pipeline(
        self,
        tenant_id: str = "acme",
        source_id: str = "default-source",
        run_id: Optional[str] = None,
    ) -> str | None:
        """Launch an Entity Resolution pipeline run for the given tenant."""
        return execute_er_pipeline(
            tenant_id=tenant_id,
            source_id=source_id,
            run_id=run_id,
        )

    def retry_pipeline(self, run_id: str) -> str | None:
        """Retry a previously failed pipeline run, resuming from checkpoints."""
        tracker = get_run_tracker()
        rec = tracker.get_status(run_id)
        if not rec or (
            rec.status == "failed" and rec.message.startswith("Pipeline run '")
        ):
            logger.error("Cannot retry unknown pipeline run %s", run_id)
            return None

        logger.info(
            "🔁 Retrying pipeline run %s (pipeline=%s, tenant=%s, attempt=%d, failed_step=%s)",
            run_id,
            rec.pipeline_name,
            rec.tenant_id,
            rec.retry_count,
            rec.failed_step,
        )

        if rec.pipeline_name == "cleaning_pipeline":
            options = (
                rec.metadata.get("options", {})
                if isinstance(rec.metadata, dict)
                else {}
            )
            return self.trigger_cleaning_pipeline(
                tenant_id=rec.tenant_id,
                source_id=rec.source_id,
                batch_metadata={"run_id": run_id, **options},
                run_id=run_id,
            )
        elif rec.pipeline_name == "er_pipeline":
            return self.trigger_er_pipeline(
                tenant_id=rec.tenant_id,
                source_id=rec.source_id,
                run_id=run_id,
            )
        else:
            logger.warning(
                "Unrecognized pipeline '%s' for retry on run %s",
                rec.pipeline_name,
                run_id,
            )
            tracker.fail_run(
                run_id, error=f"Cannot retry unrecognized pipeline: {rec.pipeline_name}"
            )
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
        logger.info(
            "Triggering Cross-Store Reconciliation — tenant=%s, entity_type=%s",
            tenant_id,
            entity_type,
        )
        report = run_cross_store_reconciliation(
            tenant_id=tenant_id,
            entity_type=entity_type,
            pg_records=pg_records,
            neo4j_records=neo4j_records,
            opensearch_records=opensearch_records,
        )
        return report.model_dump()

    def generate_relational_edges(
        self,
        tenant_id: str = "acme",
        records: Optional[list[dict[str, Any]]] = None,
        foreign_keys: Optional[dict[str, Any] | list[dict[str, Any]]] = None,
        source_id: str = "default-source",
        source_entity_type: Optional[str] = None,
        publish_to_kafka: bool = True,
        persist_to_db: bool = True,
    ) -> list[dict[str, Any]]:
        """Generate relational edges for cross-entity linking using foreign keys."""
        return execute_generate_relational_edges(
            tenant_id=tenant_id,
            records=records,
            foreign_keys=foreign_keys,
            source_id=source_id,
            source_entity_type=source_entity_type,
            publish_to_kafka=publish_to_kafka,
            persist_to_db=persist_to_db,
        )
