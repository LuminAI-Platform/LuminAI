"""Canonical Golden Record attribute merging and cluster resolution rules."""

from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache
import logging
from typing import Any
import uuid

import polars as pl

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

    Merge policy for each field:
      1. Non-null values preferred.
      2. If multiple non-null values exist, pick the value from the record with the
         latest chronological timestamp (e.g. ``updated_at``, ``joined_at``, ``staged_at``).
      3. If timestamps are equal or missing, pick the value with maximum string length
         (highest completeness).
    """
    if not cluster_records:
        return {}

    if not golden_id:
        golden_id = f"gr-{uuid.uuid4()}"

    source_ids = [
        str(r.get("id", r.get("raw_id", "")))
        for r in cluster_records
        if "id" in r or "raw_id" in r
    ]

    # Pre-parse timestamps once per cluster record to maximize performance
    rec_epochs = [
        _parse_ts_epoch(
            rec.get("updated_at") or rec.get("joined_at") or rec.get("staged_at") or ""
        )
        for rec in cluster_records
    ]

    # Collect all unique attribute keys across cluster records
    all_keys: set[str] = set()
    for rec in cluster_records:
        all_keys.update(rec.keys())

    # Keys to exclude from golden attribute merging
    exclude_keys = {
        "id",
        "raw_id",
        "block_key",
        "decision",
        "confidence_score",
        "score_name",
        "score_dob",
        "score_email",
        "version",
        "created_at",
        "updated_at",
    }

    canonical_attributes: dict[str, Any] = {}

    for key in sorted(all_keys - exclude_keys):
        candidates = []
        for i, rec in enumerate(cluster_records):
            val = rec.get(key)
            if val is not None and str(val).strip() != "":
                epoch = rec_epochs[i]
                str_val = str(val).strip()
                candidates.append((epoch, len(str_val), val))

        if candidates:
            # Sort chronologically by epoch desc, then completeness/length desc
            candidates.sort(key=lambda x: (x[0], x[1]), reverse=True)
            canonical_attributes[key] = candidates[0][2]
        else:
            canonical_attributes[key] = None

    resolved_tenant_id = tenant_id
    if resolved_tenant_id == "acme":
        for r in cluster_records:
            if r.get("tenant_id") and str(r.get("tenant_id")) != "acme":
                resolved_tenant_id = str(r.get("tenant_id"))
                break

    now_iso = datetime.now(timezone.utc).isoformat()
    golden_record = {
        "golden_id": golden_id,
        "tenant_id": resolved_tenant_id,
        "version": 1,
        "cluster_size": len(cluster_records),
        "source_record_ids": source_ids,
        "created_at": now_iso,
        "updated_at": now_iso,
        **canonical_attributes,
    }

    return golden_record


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
