"""Quarantine and DLQ management Pydantic models."""

from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class QuarantineListRequest(BaseModel):
    """Filter parameters for querying quarantined messages."""

    tenant_id: Optional[str] = Field(default=None, description="Filter by tenant ID.")
    status: Optional[str] = Field(
        default="quarantined",
        description="Filter by message status: quarantined, replayed, discarded, all.",
    )
    limit: int = Field(default=50, ge=1, le=500, description="Max messages to return.")
    offset: int = Field(default=0, ge=0, description="Pagination offset.")


class QuarantinedMessageSchema(BaseModel):
    """Quarantined message record representation."""

    message_id: str
    tenant_id: str
    source_id: str
    topic: str
    message_key: Optional[str] = None
    raw_payload: str
    error_reason: str
    quarantined_at: str
    retry_count: int
    status: str
    last_replayed_at: Optional[str] = None


class QuarantineListResponse(BaseModel):
    """Response schema for listing quarantined messages."""

    total: int
    limit: int
    offset: int
    items: List[QuarantinedMessageSchema]


class QuarantineReplayRequest(BaseModel):
    """Request payload to replay selected quarantined messages."""

    message_ids: List[str] = Field(
        ...,
        min_length=1,
        description="List of quarantined message UUIDs to replay back to ingest.raw.",
    )


class QuarantineDiscardRequest(BaseModel):
    """Request payload to discard selected quarantined messages."""

    message_ids: List[str] = Field(
        ...,
        min_length=1,
        description="List of quarantined message UUIDs to discard.",
    )


class QuarantineActionResponse(BaseModel):
    """Response schema summarizing quarantine actions."""

    action: str
    processed_count: int
    message_ids: List[str]
    message: str
