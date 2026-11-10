"""Processing module aggregator and router bundle.

Modular sub-routers:
  - pipelines.py: Execution, status polling, and retry (/trigger, /clean, /er/trigger, /status, /retry).
  - reconciliation.py: Cross-store reconciliation & foreign-key relational graph edges.
  - quarantine.py: Dead-Letter Queue inspection, replay, and discard.
  - golden_records.py: Canonical golden record lookup, version audit history, and rollback.
  - schemas.py: Pre-flight schema auto-detection and data quality validation.
"""

from fastapi import APIRouter

# Import subrouters
from app.api.processing.golden_records import router as golden_records_router
from app.api.processing.pipelines import router as pipelines_router
from app.api.processing.quarantine import router as quarantine_router
from app.api.processing.reconciliation import router as reconciliation_router
from app.api.processing.schemas import router as schemas_router

# Re-export models for 100% backward compatibility
from app.api.processing.models import (
    ColumnValidationResponse,
    ErTriggerRequest,
    GoldenRecordHistoryItem,
    GoldenRecordHistoryResponse,
    GoldenRecordResponse,
    QuarantineActionResponse,
    QuarantineDiscardRequest,
    QuarantineListRequest,
    QuarantineListResponse,
    QuarantineReplayRequest,
    QuarantinedMessageSchema,
    ReconciliationRequest,
    RelationalEdgeTriggerRequest,
    RelationalEdgeTriggerResponse,
    RetryResponse,
    RollbackRequest,
    RollbackResponse,
    SchemaValidationRequest,
    SchemaValidationResponse,
    StatusResponse,
    TriggerRequest,
    TriggerResponse,
)

# Re-export dependencies commonly accessed or patched in unit tests
from app.kafka.quarantine import get_quarantine_manager
from app.processing.reconciliation import (
    ReconciliationReport,
    run_cross_store_reconciliation,
)
from app.processing.run_tracker import get_run_tracker
from app.processing.trigger import DagsterTrigger

# Aggregate master router
router = APIRouter()
router.include_router(pipelines_router)
router.include_router(reconciliation_router)
router.include_router(quarantine_router)
router.include_router(golden_records_router)
router.include_router(schemas_router)

__all__ = [
    "router",
    "TriggerRequest",
    "ErTriggerRequest",
    "ReconciliationRequest",
    "ReconciliationReport",
    "SchemaValidationRequest",
    "ColumnValidationResponse",
    "SchemaValidationResponse",
    "TriggerResponse",
    "RetryResponse",
    "StatusResponse",
    "QuarantineListRequest",
    "QuarantinedMessageSchema",
    "QuarantineListResponse",
    "QuarantineReplayRequest",
    "QuarantineDiscardRequest",
    "QuarantineActionResponse",
    "GoldenRecordResponse",
    "GoldenRecordHistoryItem",
    "GoldenRecordHistoryResponse",
    "RollbackRequest",
    "RollbackResponse",
    "RelationalEdgeTriggerRequest",
    "RelationalEdgeTriggerResponse",
    "get_quarantine_manager",
    "run_cross_store_reconciliation",
    "get_run_tracker",
    "DagsterTrigger",
]
