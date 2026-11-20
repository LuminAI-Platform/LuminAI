"""Canonical Golden Record attribute merging and cluster resolution rules.

Applies multi-criteria survivorship hierarchy:
  1. Validation Status: Valid, verified values strictly win over unvalidated or invalid values.
  2. Source Priority: High-reliability source systems beat low-reliability feeds.
  3. Completeness: Richer, non-truncated values beat sparse entries.
  4. Recency: More recent updates take precedence when validity and reliability are tied.
  5. Provenance & Conflicts: Preserves explainable field provenance and unresolved conflicts.
"""

from __future__ import annotations

import logging
from typing import Any
import uuid

import polars as pl

from app.processing.engine.golden_record_engine import GoldenRecordEngine

logger = logging.getLogger(__name__)


def merge_cluster_to_golden_record(
    cluster_records: list[dict[str, Any]],
    tenant_id: str = "acme",
    golden_id: str | None = None,
) -> dict[str, Any]:
    """Merge a cluster of duplicate record dicts into a single canonical Golden Record.

    Applies field-level survivorship rules (validity > source trust > recency > completeness).
    Maintains provenance and conflict tracking.
    """
    if not cluster_records:
        return {}

    if not golden_id:
        golden_id = f"gr-{uuid.uuid4()}"

    engine = GoldenRecordEngine()
    gr_output = engine.build_golden_record(
        cluster_records=cluster_records,
        tenant_id=tenant_id,
        golden_id=golden_id,
    )

    # Return dictionary with canonical attributes and audit metadata
    return {
        "golden_id": gr_output.golden_id,
        "tenant_id": gr_output.tenant_id,
        "version": gr_output.version,
        "cluster_size": gr_output.cluster_size,
        "source_record_ids": gr_output.source_record_ids,
        "canonical_name": gr_output.canonical_name,
        "quality_state": gr_output.quality_state,
        "quality_score": gr_output.quality_score,
        "confidence_score": gr_output.confidence_score,
        "created_at": gr_output.created_at,
        "updated_at": gr_output.updated_at,
        "_field_provenance": {k: as_dict_safe(v) for k, v in gr_output.field_provenance.items()},
        "_conflicts": gr_output.conflicts,
        **gr_output.attributes,
    }


def as_dict_safe(obj: Any) -> Any:
    if hasattr(obj, "__dict__"):
        return obj.__dict__
    return obj


def merge_clusters_to_golden_records(
    clusters: list[list[dict[str, Any]]],
    tenant_id: str = "acme",
) -> pl.DataFrame:
    """Merge a list of record clusters into a Polars DataFrame of Golden Records."""
    golden_records = [
        merge_cluster_to_golden_record(cluster, tenant_id=tenant_id)
        for cluster in clusters
        if cluster
    ]

    if not golden_records:
        return pl.DataFrame()

    try:
        df = pl.DataFrame(golden_records)
    except Exception:
        # Resilient fallback for heterogeneous attribute schemas across records
        import pandas as pd

        df_pd = pd.DataFrame(golden_records)
        df = pl.from_pandas(df_pd)

    logger.info(
        "Golden record merge complete — merged %d clusters into %d golden records",
        len(clusters),
        df.height,
    )
    return df
