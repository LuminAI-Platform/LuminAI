"""Deduplication and entity resolution logic for the cleaning pipeline.

Applies multi-stage entity resolution:
  - Exact identifier, normalized email, and exact row signature matching.
  - Multi-field weighted comparison with strict contradiction safeguard
    (records with conflicting identifiers are never merged).
  - Transitive Union-Find clustering across duplicate pairs.
  - Field-level attribute survivorship (retaining most complete, valid, and recent values).
"""

import logging
from typing import Any, Dict, List

import polars as pl
from dagster import AssetExecutionContext

from app.processing.engine.deduplicator import MultiStageEntityResolver
from app.processing.engine.golden_record_engine import GoldenRecordEngine

logger = logging.getLogger(__name__)


def deduplicate_dataset(
    context: AssetExecutionContext,
    cleaned_df: pl.DataFrame,
    tenant_id: str = "acme",
    entity_type: str = "Person",
) -> pl.DataFrame:
    """Deduplicate and consolidate records using blocked multi-stage ER and field survivorship."""
    initial_rows = cleaned_df.height
    context.log.info(
        "🔍 deduplicated_ingestion_data: starting with %d rows (tenant=%s)",
        initial_rows,
        tenant_id,
    )

    if initial_rows <= 1:
        return cleaned_df

    records = cleaned_df.to_dicts()
    clustering = MultiStageEntityResolver.cluster_records(records)

    for mlog in clustering.merge_logs:
        context.log.info(
            "⚠️ Entity match confirmed (%s, score=%.2f): merging '%s' and '%s'",
            mlog["decision"],
            mlog["confidence_score"],
            mlog["lead_record_id"],
            mlog["merged_record_id"],
        )

    golden_engine = GoldenRecordEngine()
    consolidated_records: List[Dict[str, Any]] = []
    merged_count = 0

    for idx_cluster in clustering.clusters:
        if len(idx_cluster) == 1:
            consolidated_records.append(records[idx_cluster[0]])
        else:
            cluster = [records[idx] for idx in idx_cluster]
            merged_count += len(cluster) - 1
            rec_tenant = str(cluster[0].get("tenant_id") or tenant_id)
            rec_etype = str(cluster[0].get("entity_type") or entity_type)
            gr_output = golden_engine.build_golden_record(
                cluster_records=cluster,
                tenant_id=rec_tenant,
                entity_type=rec_etype,
            )
            lead_id = cluster[0].get("id") or cluster[0].get("record_id") or gr_output.golden_id
            consolidated = dict(cluster[0])
            consolidated.update(gr_output.attributes)
            consolidated["id"] = lead_id
            consolidated_records.append(consolidated)

    result_df = pl.DataFrame(consolidated_records)
    final_rows = result_df.height

    context.log.info(
        "✅ deduplicated_ingestion_data: complete — %d → %d rows (merged %d duplicate records)",
        initial_rows,
        final_rows,
        merged_count,
    )

    return result_df
