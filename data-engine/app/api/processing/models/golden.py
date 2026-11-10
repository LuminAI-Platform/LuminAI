"""Golden record versioning, history, and rollback Pydantic models."""

from __future__ import annotations

from typing import Any, Dict, List
from pydantic import BaseModel, Field


class GoldenRecordResponse(BaseModel):
    """Canonical Golden Record state."""

    golden_id: str
    tenant_id: str
    version: int
    cluster_size: int
    source_record_ids: List[str]
    created_at: str
    updated_at: str
    attributes: Dict[str, Any]


class GoldenRecordHistoryItem(BaseModel):
    """Historical audit trail entry for a Golden Record."""

    history_id: str
    golden_id: str
    tenant_id: str
    version: int
    cluster_size: int
    source_record_ids: List[str]
    action: str
    created_at: str
    attributes: Dict[str, Any]


class GoldenRecordHistoryResponse(BaseModel):
    """Response containing full audit history across versions."""

    golden_id: str
    total_versions: int
    history: List[GoldenRecordHistoryItem]


class RollbackRequest(BaseModel):
    """Request payload to restore a prior Golden Record version."""

    target_version: int = Field(
        ..., ge=1, description="Historical version number to restore."
    )


class RollbackResponse(BaseModel):
    """Response summarizing successful version rollback."""

    message: str
    golden_record: GoldenRecordResponse
