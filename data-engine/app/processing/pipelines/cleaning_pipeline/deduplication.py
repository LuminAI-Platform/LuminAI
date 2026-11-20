"""Deduplication and entity resolution logic for the cleaning pipeline.

Applies multi-stage entity resolution:
  - Exact identifier and normalized email matching.
  - Multi-field weighted comparison with strict contradiction safeguard
    (records with conflicting identifiers are never merged).
  - Field-level attribute survivorship (retaining most complete, valid, and recent values).
  - Provenance tracking of all merge decisions.
"""

import logging
from typing import Any, Dict, List, Set

import polars as pl
from dagster import AssetExecutionContext

from app.processing.engine.deduplicator import MultiStageEntityResolver
from app.processing.engine.golden_record_engine import GoldenRecordEngine

logger = logging.getLogger(__name__)


def deduplicate_dataset(
    context: AssetExecutionContext,
    cleaned_df: pl.DataFrame,
) -> pl.DataFrame:
    """
    Deduplicate and consolidate records using multi-stage entity resolution and field survivorship.
    """
    initial_rows = cleaned_df.height
    context.log.info(
        "🔍 deduplicated_ingestion_data: starting with %d rows", initial_rows
    )

    if initial_rows <= 1:
        return cleaned_df

    records = cleaned_df.to_dicts()
    used_indices: Set[int] = set()
    clusters: List[List[Dict[str, Any]]] = []

    # Cluster records using MultiStageEntityResolver
    for i in range(len(records)):
        if i in used_indices:
            continue

        cluster = [records[i]]
        used_indices.add(i)

        for j in range(i + 1, len(records)):
            if j in used_indices:
                continue

            evidence = MultiStageEntityResolver.evaluate_pair(records[i], records[j])

            # Merge only if CONFIRMED or PROBABLE duplicate, with no identifier contradiction
            if evidence.decision in ("CONFIRMED_DUPLICATE", "PROBABLE_DUPLICATE"):
                cluster.append(records[j])
                used_indices.add(j)
                context.log.info(
                    "⚠️ Entity match confirmed (%s, score=%.2f): merging '%s' and '%s'",
                    evidence.decision,
                    evidence.overall_confidence,
                    records[i].get("name") or records[i].get("id"),
                    records[j].get("name") or records[j].get("id"),
                )

        clusters.append(cluster)

    # Consolidate each cluster using field-level survivorship
    golden_engine = GoldenRecordEngine()
    consolidated_records: List[Dict[str, Any]] = []
    merged_count = 0

    for cluster in clusters:
        if len(cluster) == 1:
            consolidated_records.append(cluster[0])
        else:
            merged_count += (len(cluster) - 1)
            gr_output = golden_engine.build_golden_record(
                cluster_records=cluster,
                tenant_id="acme",
                entity_type="Person",
            )
            # Combine consolidated attributes with the lead record's identifier
            lead_id = cluster[0].get("id") or cluster[0].get("record_id") or gr_output.golden_id
            consolidated = {
                **gr_output.attributes,
                "id": lead_id,
            }
            consolidated_records.append(consolidated)

    # Convert back to Polars DataFrame matching schema
    result_df = pl.DataFrame(consolidated_records)
    final_rows = result_df.height

    context.log.info(
        "✅ deduplicated_ingestion_data: complete — %d → %d rows (merged %d duplicate records)",
        initial_rows,
        final_rows,
        merged_count,
    )

    return result_df
