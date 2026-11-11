"""Golden record synthesis, persistence, provenance, and event emission for ER pipeline."""

from __future__ import annotations

import logging
from typing import Any, Dict, List

import polars as pl
from dagster import AssetExecutionContext

import app.processing.pipelines.er_pipeline as er_pipe
from app.kafka.producers import EntityResolvedProducer
from app.processing.er.clustering import cluster_record_dictionaries
from app.processing.er.golden_record import (
    merge_clusters_to_golden_records,
    persist_golden_records,
)
from app.processing.er.provenance import (
    persist_provenance_records,
    track_field_provenance,
)
from app.processing.pipelines.er_pipeline.helpers import _extract_run_tags
from app.telemetry import record_er_metrics, trace_span

logger = logging.getLogger(__name__)


def synthesize_and_persist_golden_records(
    context: AssetExecutionContext,
    er_classified_pairs: pl.DataFrame,
    staged_records_for_er: pl.DataFrame,
) -> pl.DataFrame:
    """Synthesize canonical Golden Records, persist them, and publish to Kafka."""
    tags = _extract_run_tags(context)
    tenant_id = tags.get("tenant_id") or "acme"
    run_id = tags.get("luminai_run_id") or tags.get("dagster/run_id")
    cp_mgr = er_pipe.get_checkpoint_manager()
    if run_id:
        cached = cp_mgr.load_checkpoint(run_id, "er_golden_records")
        if cached is not None:
            context.log.info(
                "⏩ Reusing checkpoint for er_golden_records (%d rows)", cached.height
            )
            return cached

    context.log.info(
        "👑 er_golden_records: clustering matches and synthesizing Golden Records (tenant: %s)…",
        tenant_id,
    )

    with trace_span(
        "er.golden_records",
        attributes={
            "tenant.id": str(tenant_id),
            "records.input": int(staged_records_for_er.height),
        },
    ):
        records_list = staged_records_for_er.to_dicts()
        clusters = cluster_record_dictionaries(
            er_classified_pairs, records_list, id_col="id"
        )

        context.log.info(
            "👑 Graph clustering resolved %d distinct clusters from %d input records",
            len(clusters),
            len(records_list),
        )

        # Synthesize Golden Records
        golden_records_df = merge_clusters_to_golden_records(
            clusters, tenant_id=tenant_id
        )

        # Persist Golden Records to DB
        persisted_gr = persist_golden_records(golden_records_df, tenant_id=tenant_id)
        context.log.info(
            "👑 Successfully persisted %d Golden Records to database (tenant: %s)",
            persisted_gr,
            tenant_id,
        )

        pipeline_entity_type = tags.get("entity_type") or "Person"

        record_er_metrics(
            tenant_id=tenant_id,
            clusters_count=len(clusters),
            golden_records_count=persisted_gr,
            entity_type=pipeline_entity_type,
        )

        # Track and persist field-level provenance
        all_provenance_entries: List[Dict[str, Any]] = []
        producer = EntityResolvedProducer()

        for cluster in clusters:
            cluster_records = cluster
            if not cluster_records:
                continue

            golden_rec = next(
                (
                    gr
                    for gr in golden_records_df.to_dicts()
                    if any(
                        str(r.get("id")) in gr.get("source_record_ids", [])
                        for r in cluster_records
                    )
                ),
                None,
            )

            if golden_rec:
                resolved_entity_type = str(
                    golden_rec.get("entity_type") or pipeline_entity_type
                )
                prov_entries = track_field_provenance(
                    golden_rec, cluster_records, tenant_id=tenant_id
                )
                all_provenance_entries.extend(prov_entries)

                source_identifier = str(
                    tags.get("source_id")
                    or tags.get("connection_id")
                    or tags.get("connectionId")
                    or "er-engine"
                )
                # Publish entity.resolved Kafka event
                try:
                    producer.publish_resolved_entity(
                        tenant_id=tenant_id,
                        golden_id=str(golden_rec.get("golden_id")),
                        entity_type=resolved_entity_type,
                        payload=golden_rec,
                        source_id=source_identifier,
                    )
                except Exception as exc:
                    context.log.warning(
                        "Could not publish entity.resolved Kafka event: %s", exc
                    )

        if all_provenance_entries:
            persisted_prov = persist_provenance_records(
                all_provenance_entries, tenant_id=tenant_id
            )
            context.log.info(
                "👑 Successfully persisted %d field provenance records (tenant: %s)",
                persisted_prov,
                tenant_id,
            )

        context.log.info(
            "✅ er_golden_records: pipeline finished with %d canonical Golden Records",
            golden_records_df.height,
        )

        # Publish batch completion event to entity.resolved topic
        try:
            conn_id = (
                tags.get("connection_id")
                or tags.get("connectionId")
                or tags.get("source_id")
            )
            if conn_id and conn_id not in ("er-engine", "default-source"):
                producer.publish_batch_completion(
                    tenant_id=tenant_id,
                    connection_id=str(conn_id),
                    resolved_entities=int(persisted_gr),
                )
                context.log.info(
                    "📡 Published batch completion event for connection '%s' (%d entities)",
                    conn_id,
                    persisted_gr,
                )
        except Exception as exc:
            context.log.warning("Could not publish batch completion event: %s", exc)

        if run_id:
            cp_mgr.save_checkpoint(run_id, "er_golden_records", golden_records_df)
        return golden_records_df
