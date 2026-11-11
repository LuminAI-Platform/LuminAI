"""Pydantic request and response schemas for processing endpoints."""

from __future__ import annotations

from app.api.processing.models.golden import (
    GoldenRecordHistoryItem,
    GoldenRecordHistoryResponse,
    GoldenRecordResponse,
    RollbackRequest,
    RollbackResponse,
)
from app.api.processing.models.pipeline import (
    ErTriggerRequest,
    RetryResponse,
    StatusResponse,
    TriggerRequest,
    TriggerResponse,
)
from app.api.processing.models.quarantine import (
    QuarantineActionResponse,
    QuarantineDiscardRequest,
    QuarantineListRequest,
    QuarantineListResponse,
    QuarantineReplayRequest,
    QuarantinedMessageSchema,
)
from app.api.processing.models.reconciliation import (
    ReconciliationRequest,
    RelationalEdgeTriggerRequest,
    RelationalEdgeTriggerResponse,
)
from app.api.processing.models.schema import (
    ColumnValidationResponse,
    SchemaValidationRequest,
    SchemaValidationResponse,
)

__all__ = [
    # Pipeline models
    "TriggerRequest",
    "ErTriggerRequest",
    "TriggerResponse",
    "StatusResponse",
    "RetryResponse",
    # Reconciliation models
    "ReconciliationRequest",
    "RelationalEdgeTriggerRequest",
    "RelationalEdgeTriggerResponse",
    # Quarantine models
    "QuarantineListRequest",
    "QuarantinedMessageSchema",
    "QuarantineListResponse",
    "QuarantineReplayRequest",
    "QuarantineDiscardRequest",
    "QuarantineActionResponse",
    # Golden record models
    "GoldenRecordResponse",
    "GoldenRecordHistoryItem",
    "GoldenRecordHistoryResponse",
    "RollbackRequest",
    "RollbackResponse",
    # Schema detection models
    "SchemaValidationRequest",
    "ColumnValidationResponse",
    "SchemaValidationResponse",
]
