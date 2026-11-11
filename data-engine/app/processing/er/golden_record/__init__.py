"""Entity Resolution (ER) Golden Record Merge, Versioning & Persistence Engine.

Decomposed into:
  - merging.py     → Canonical attribute merging and cluster resolution rules
  - persistence.py → Batched database writes, multi-tenant schema resolution, and upserts
  - audit.py       → Point-in-time snapshot retrieval, history queries, and rollback capability

All functions and models are re-exported at package root for 100% backward compatibility.
"""

from app.processing.er.golden_record.audit import (
    get_golden_record,
    get_golden_record_history,
    rollback_golden_record,
)
from app.processing.er.golden_record.merging import (
    _parse_date_string_to_epoch,
    _parse_ts_epoch,
    merge_cluster_to_golden_record,
    merge_clusters_to_golden_records,
)
from app.processing.er.golden_record.persistence import (
    _get_active_engine,
    persist_golden_records,
)

__all__ = [
    # Merging
    "_parse_date_string_to_epoch",
    "_parse_ts_epoch",
    "merge_cluster_to_golden_record",
    "merge_clusters_to_golden_records",
    # Persistence
    "_get_active_engine",
    "persist_golden_records",
    # Audit & Rollback
    "get_golden_record",
    "get_golden_record_history",
    "rollback_golden_record",
]
