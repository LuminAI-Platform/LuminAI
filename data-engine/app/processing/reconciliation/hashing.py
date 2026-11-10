"""Deterministic SHA-256 hashing routines for entity records and stores."""

from __future__ import annotations

import hashlib
import json
from typing import Any, Dict, List

from app.processing.reconciliation.models import StoreEntityRecord


def compute_record_hash(record_data: Dict[str, Any]) -> str:
    """Compute a deterministic SHA-256 hash for an entity attribute dictionary.

    Sorts keys recursively and handles standard types and None values.
    Excludes non-deterministic or metadata keys (e.g. created_at, timestamps).
    """
    excluded_keys = {
        "created_at",
        "updated_at",
        "staged_at",
        "synced_at",
        "reconciled_at",
        "source_record_ids",
        "cluster_size",
    }

    filtered_data = {
        k: v for k, v in record_data.items() if k not in excluded_keys and v is not None
    }

    normalized = {}
    for k, v in sorted(filtered_data.items()):
        if isinstance(v, (dict, list)):
            normalized[k] = json.dumps(v, sort_keys=True)
        else:
            normalized[k] = str(v).strip().lower()

    canonical_str = json.dumps(normalized, sort_keys=True)
    return hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()


def compute_store_aggregate_checksum(entity_records: List[StoreEntityRecord]) -> str:
    """Compute a combined aggregate SHA-256 checksum over sorted entity records.

    Provides O(N) aggregate checksum verification across entire tenant dataset.
    """
    if not entity_records:
        return hashlib.sha256(b"EMPTY_STORE").hexdigest()

    sorted_records = sorted(entity_records, key=lambda r: r.entity_id)
    hasher = hashlib.sha256()

    for r in sorted_records:
        hasher.update(f"{r.entity_id}:{r.attributes_hash}".encode("utf-8"))

    return hasher.hexdigest()
