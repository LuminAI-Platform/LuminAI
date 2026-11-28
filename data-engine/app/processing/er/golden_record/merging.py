"""Canonical Golden Record attribute merging and cluster resolution rules.

Applies multi-criteria survivorship hierarchy:
  1. Validation Status: Valid, verified values strictly win over unvalidated or invalid values.
  2. Source Priority: High-reliability source systems beat low-reliability feeds.
  3. Completeness: Richer, non-truncated values beat sparse entries.
  4. Recency: More recent updates take precedence when validity and reliability are tied.
  5. Provenance & Conflicts: Preserves explainable field provenance and unresolved conflicts.
"""

from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache
import logging
from typing import Any
import uuid

import polars as pl

from app.processing.engine.golden_record_engine import GoldenRecordEngine

logger = logging.getLogger(__name__)


@lru_cache(maxsize=32768)
def _parse_date_string_to_epoch(val_str: str) -> float:
    """Cached parsing of common date formats into UTC epoch timestamp."""
    for fmt in (
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%m/%d/%Y",
        "%d-%m-%Y",
    ):
        try:
            dt = datetime.strptime(val_str, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.timestamp()
        except ValueError:
            continue
    return 0.0


def _parse_ts_epoch(ts_val: Any) -> float:
    """Safely convert any date string or datetime into UTC epoch float for chronological sorting."""
    if not ts_val:
        return 0.0
    if isinstance(ts_val, (int, float)):
        return float(ts_val)
    if isinstance(ts_val, datetime):
        if ts_val.tzinfo is None:
            ts_val = ts_val.replace(tzinfo=timezone.utc)
        return ts_val.timestamp()

    val_str = str(ts_val).strip()
    if not val_str:
        return 0.0
    return _parse_date_string_to_epoch(val_str)


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
        stable_keys = sorted(
            str(r.get("raw_id") or r.get("id") or r.get("record_id") or "")
            for r in cluster_records
        )
        if any(stable_keys):
            seed = f"{tenant_id}:{'|'.join(stable_keys)}"
        else:
            import json as _json

            seed = f"{tenant_id}:{_json.dumps(cluster_records, sort_keys=True, default=str)}"
        golden_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, seed))

    entity_type_hint = (
        cluster_records[0].get("_entity_type")
        or cluster_records[0].get("entity_type")
        or cluster_records[0].get("entityType")
    )
    engine = GoldenRecordEngine()
    gr_output = engine.build_golden_record(
        cluster_records=cluster_records,
        tenant_id=tenant_id,
        golden_id=golden_id,
        entity_type=str(entity_type_hint) if entity_type_hint else None,
    )

    source_names = sorted(
        {
            str(r.get("_source_name") or r.get("source_name") or r.get("_table") or "").strip()
            for r in cluster_records
            if str(r.get("_source_name") or r.get("source_name") or r.get("_table") or "").strip()
        }
    )
    connection_ids = sorted(
        {
            str(r.get("_connection_id") or r.get("source_id") or "").strip()
            for r in cluster_records
            if str(r.get("_connection_id") or r.get("source_id") or "").strip()
        }
    )

    # Return dictionary with canonical attributes and audit metadata
    res = {
        "golden_id": gr_output.golden_id,
        "tenant_id": gr_output.tenant_id,
        "entity_type": gr_output.entity_type,
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
    if source_names:
        res["_source_name"] = source_names[0]
        res["_source_systems"] = source_names
    if connection_ids:
        res["_connection_id"] = connection_ids[0]
    return res


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
