"""Data models for cross-store reconciliation."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

ReconciliationStatus = Literal["HEALTHY", "DRIFT_DETECTED"]


class StoreEntityRecord(BaseModel):
    """Normalized entity representation from any storage backend for reconciliation."""

    entity_id: str
    tenant_id: str
    entity_type: str
    attributes_hash: str
    raw_data: Optional[Dict[str, Any]] = None


class StoreSyncMetrics(BaseModel):
    """Metrics snapshot for a specific storage engine."""

    store_name: str
    record_count: int
    checksum_hash: str
    entity_ids: List[str] = Field(default_factory=list)


class ReconciliationReport(BaseModel):
    """Structured report returned by the Cross-Store Reconciliation Engine."""

    report_id: str = Field(default_factory=lambda: f"rec-{uuid.uuid4()}")
    status: ReconciliationStatus
    tenant_id: str
    entity_type: str
    pg_count: int
    neo4j_count: int
    opensearch_count: int
    missing_in_neo4j: List[str] = Field(default_factory=list)
    missing_in_opensearch: List[str] = Field(default_factory=list)
    missing_in_postgres: List[str] = Field(default_factory=list)
    checksum_match: bool
    checksums: Dict[str, str] = Field(default_factory=dict)
    drift_details: List[Dict[str, Any]] = Field(default_factory=list)
    reconciled_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
