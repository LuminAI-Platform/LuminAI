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
    tenant_id: str = "acme",
    entity_type: str = "Person",
) -> pl.DataFrame:
    """
    Deduplicate and consolidate records using blocked multi-stage entity resolution and field survivorship.
    """
    initial_rows = cleaned_df.height
    context.log.info(
        "🔍 deduplicated_ingestion_data: starting with %d rows (tenant=%s)",
        initial_rows,
        tenant_id,
    )

    if initial_rows <= 1:
        return cleaned_df

    records = cleaned_df.to_dicts()
    used_indices: Set[int] = set()
    clusters: List[List[Dict[str, Any]]] = []

    # Build inverted blocking index so we avoid O(N^2) all-pairs comparison
    blocks: Dict[str, List[int]] = {}
    for idx, rec in enumerate(records):
        idents = MultiStageEntityResolver.extract_identifiers(rec)
        for itype, ival in idents.items():
            if ival:
                blocks.setdefault(f"id:{itype}:{ival}", []).append(idx)

        raw_email = str(rec.get("email") or rec.get("contact_email") or "").strip().lower()
        if "@" in raw_email:
            uname = raw_email.split("@")[0]
            if uname:
                blocks.setdefault(f"eml:{uname}", []).append(idx)

        raw_name = str(rec.get("name") or rec.get("full_name") or "").strip().lower()
        if len(raw_name) >= 2:
            blocks.setdefault(f"nam:{raw_name[:3]}", []).append(idx)

        raw_dob = str(rec.get("dob") or rec.get("date_of_birth") or rec.get("birth_date") or "").strip()
        if len(raw_dob) >= 4:
            blocks.setdefault(f"dob:{raw_dob[:10]}", []).append(idx)

    candidate_map: Dict[int, Set[int]] = {i: set() for i in range(len(records))}
    max_exact_block = 200
    window = 20
    for idx_list in blocks.values():
        if len(idx_list) <= 1:
            continue
        if len(idx_list) < max_exact_block:
            for a_pos in range(len(idx_list)):
                ia = idx_list[a_pos]
                for b_pos in range(a_pos + 1, len(idx_list)):
                    ib = idx_list[b_pos]
                    candidate_map[min(ia, ib)].add(max(ia, ib))
        else:
            ordered = sorted(
                idx_list,
                key=lambda k: (
                    str(records[k].get("email") or records[k].get("contact_email") or "").strip().lower(),
                    str(records[k].get("name") or records[k].get("full_name") or "").strip().lower(),
                    k,
                ),
            )
            for a_pos in range(len(ordered)):
                ia = ordered[a_pos]
                for b_pos in range(a_pos + 1, min(len(ordered), a_pos + window + 1)):
                    ib = ordered[b_pos]
                    candidate_map[min(ia, ib)].add(max(ia, ib))

    # Cluster candidate pairs using MultiStageEntityResolver
    for i in range(len(records)):
        if i in used_indices:
            continue

        cluster = [records[i]]
        used_indices.add(i)

        for j in sorted(candidate_map.get(i, set())):
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
            rec_tenant = str(cluster[0].get("tenant_id") or tenant_id)
            rec_etype = str(cluster[0].get("entity_type") or entity_type)
            gr_output = golden_engine.build_golden_record(
                cluster_records=cluster,
                tenant_id=rec_tenant,
                entity_type=rec_etype,
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
