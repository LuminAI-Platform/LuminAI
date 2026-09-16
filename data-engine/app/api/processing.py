"""Processing pipeline trigger and status endpoints.

POST /process/trigger          →  Queue a data cleaning Dagster pipeline run.
POST /process/er/trigger       →  Queue an Entity Resolution (ER) Dagster pipeline run.
POST /process/reconciliation   →  Execute a Cross-Store Data Reconciliation drift verification.
GET  /process/status/{run_id}  →  Poll the status of a queued run.
"""

import uuid
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel, Field

from app.kafka.quarantine import get_quarantine_manager
from app.processing.reconciliation import (
    ReconciliationReport,
    run_cross_store_reconciliation,
)
from app.processing.run_tracker import get_run_tracker
from app.processing.trigger import DagsterTrigger

router = APIRouter()


# Request / Response Models

class TriggerRequest(BaseModel):
    """Request payload schema for triggering a data pipeline execution."""

    source_id: str = Field(
        ...,
        description="ID of the data source / connector to process.",
        examples=["connector-abc123"],
    )
    tenant_id: str = Field(
        ...,
        description="Tenant identifier scoping the pipeline run.",
        examples=["acme"],
    )
    options: Dict[str, Any] = Field(
        default_factory=dict,
        description="Optional pipeline configuration overrides.",
        examples=[{"max_rows": 1000}],
    )


class ErTriggerRequest(BaseModel):
    """Request payload schema for triggering Entity Resolution pipeline."""

    tenant_id: str = Field(
        default="acme",
        description="Tenant identifier scoping the ER run.",
        examples=["acme"],
    )
    source_id: str = Field(
        default="default-source",
        description="Source identifier for tracking.",
        examples=["crm-data"],
    )


class ReconciliationRequest(BaseModel):
    """Request payload schema for executing Cross-Store Data Reconciliation."""

    tenant_id: str = Field(
        default="acme",
        description="Tenant identifier to reconcile across stores.",
        examples=["acme"],
    )
    entity_type: str = Field(
        default="Person",
        description="Ontology entity type to verify.",
        examples=["Person"],
    )
    pg_records: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Optional explicit PostgreSQL records payload override.",
    )
    neo4j_records: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Optional explicit Neo4j records payload override.",
    )
    opensearch_records: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Optional explicit OpenSearch records payload override.",
    )


class TriggerResponse(BaseModel):
    """Response schema returned after queueing a pipeline run."""

    run_id: str = Field(
        ...,
        description="A unique UUID associated with the triggered pipeline run.",
        examples=["d3b07384-d113-4ec2-a5f6-2a6c2bb47509"],
    )
    status: Literal["queued", "running", "completed", "failed"] = Field(
        ...,
        description="The initial execution status of the pipeline job.",
        examples=["queued"],
    )
    message: str = Field(
        ...,
        description="Information message detailing the trigger result.",
        examples=["Pipeline queued for source 'connector-abc123' (tenant: acme)."],
    )


class StatusResponse(BaseModel):
    """Response schema containing pipeline execution progress details."""

    run_id: str = Field(
        ...,
        description="The UUID corresponding to the polled pipeline run.",
        examples=["d3b07384-d113-4ec2-a5f6-2a6c2bb47509"],
    )
    status: Literal["queued", "running", "completed", "failed"] = Field(
        ...,
        description="The current execution stage of the run.",
        examples=["running"],
    )
    progress_pct: int = Field(
        ...,
        ge=0,
        le=100,
        description="Completed task percentage from 0 to 100.",
        examples=[42],
    )
    message: str = Field(
        ...,
        description="Human-readable execution log or milestone summary.",
        examples=["Pipeline is running (processing assets via Dagster framework)."],
    )
    current_step: Optional[str] = Field(
        default=None,
        description="Name of the currently running or last completed asset/step.",
    )
    steps_completed: List[str] = Field(
        default_factory=list,
        description="List of step names successfully completed so far.",
    )
    total_steps: Optional[int] = Field(
        default=None,
        description="Total expected pipeline steps.",
    )
    error: Optional[str] = Field(
        default=None,
        description="Error details if the pipeline run failed.",
    )
    started_at: Optional[str] = Field(
        default=None,
        description="ISO-8601 timestamp when pipeline execution started.",
    )
    completed_at: Optional[str] = Field(
        default=None,
        description="ISO-8601 timestamp when pipeline execution ended.",
    )
    dagster_run_id: Optional[str] = Field(
        default=None,
        description="Underlying Dagster orchestrator run ID.",
    )


# Endpoints

@router.post(
    "/trigger",
    response_model=TriggerResponse,
    summary="Trigger a data cleaning pipeline run",
    status_code=202,
)
async def trigger_pipeline(
    request: TriggerRequest,
    background_tasks: BackgroundTasks,
) -> TriggerResponse:
    """Queue a data cleaning pipeline for a given source connector."""
    run_id = str(uuid.uuid4())
    tracker = get_run_tracker()
    tracker.init_run(
        run_id=run_id,
        pipeline_name="cleaning_pipeline",
        tenant_id=request.tenant_id,
        source_id=request.source_id,
        total_steps=5,
        message=f"Cleaning pipeline queued for source '{request.source_id}' (tenant: {request.tenant_id}).",
    )

    trigger = DagsterTrigger()
    background_tasks.add_task(
        trigger.trigger_cleaning_pipeline,
        request.tenant_id,
        request.source_id,
        {"run_id": run_id, **request.options},
        run_id=run_id,
    )

    return TriggerResponse(
        run_id=run_id,
        status="queued",
        message=f"Cleaning pipeline queued for source '{request.source_id}' (tenant: {request.tenant_id}).",
    )


@router.post(
    "/er/trigger",
    response_model=TriggerResponse,
    summary="Trigger an Entity Resolution pipeline run",
    status_code=202,
)
async def trigger_er_pipeline(
    request: ErTriggerRequest,
    background_tasks: BackgroundTasks,
) -> TriggerResponse:
    """Queue an Entity Resolution pipeline run (Blocking -> Scored -> Classified -> Golden Records)."""
    run_id = str(uuid.uuid4())
    tracker = get_run_tracker()
    tracker.init_run(
        run_id=run_id,
        pipeline_name="er_pipeline",
        tenant_id=request.tenant_id,
        source_id=request.source_id,
        total_steps=5,
        message=f"Entity Resolution pipeline queued for tenant '{request.tenant_id}'.",
    )

    trigger = DagsterTrigger()
    background_tasks.add_task(
        trigger.trigger_er_pipeline,
        request.tenant_id,
        request.source_id,
        run_id=run_id,
    )

    return TriggerResponse(
        run_id=run_id,
        status="queued",
        message=f"Entity Resolution pipeline queued for tenant '{request.tenant_id}'.",
    )


@router.post(
    "/reconciliation",
    response_model=ReconciliationReport,
    summary="Execute Cross-Store Data Reconciliation",
)
async def execute_reconciliation(
    request: ReconciliationRequest,
) -> ReconciliationReport:
    """Execute cross-store reconciliation comparing PostgreSQL, Neo4j, and OpenSearch."""
    report = run_cross_store_reconciliation(
        tenant_id=request.tenant_id,
        entity_type=request.entity_type,
        pg_records=request.pg_records,
        neo4j_records=request.neo4j_records,
        opensearch_records=request.opensearch_records,
    )
    return report


@router.get(
    "/status/{run_id}",
    response_model=StatusResponse,
    summary="Get pipeline run status",
)
async def get_pipeline_status(run_id: str) -> StatusResponse:
    """Retrieve the current progress and status of an active pipeline run."""
    tracker = get_run_tracker()
    rec = tracker.get_status(run_id)
    return StatusResponse(
        run_id=rec.run_id,
        status=rec.status,
        progress_pct=rec.progress_pct,
        message=rec.message,
        current_step=rec.current_step,
        steps_completed=rec.steps_completed,
        total_steps=rec.total_steps,
        error=rec.error,
        started_at=rec.started_at,
        completed_at=rec.completed_at,
        dagster_run_id=rec.dagster_run_id,
    )


# --- Dead-Letter Queue (DLQ) & Quarantine Models & Endpoints ---

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


@router.post(
    "/quarantine",
    response_model=QuarantineListResponse,
    summary="List quarantined messages with filters",
)
async def list_quarantine_post(
    request: QuarantineListRequest = QuarantineListRequest(),
) -> QuarantineListResponse:
    """Query and filter quarantined messages from the Dead-Letter Queue."""
    manager = get_quarantine_manager()
    items, total = manager.list_messages(
        tenant_id=request.tenant_id,
        status=request.status,
        limit=request.limit,
        offset=request.offset,
    )
    return QuarantineListResponse(
        total=total,
        limit=request.limit,
        offset=request.offset,
        items=[QuarantinedMessageSchema(**msg.model_dump()) for msg in items],
    )


@router.get(
    "/quarantine",
    response_model=QuarantineListResponse,
    summary="List quarantined messages (GET convenience)",
)
async def list_quarantine_get(
    tenant_id: Optional[str] = None,
    status: Optional[str] = "quarantined",
    limit: int = 50,
    offset: int = 0,
) -> QuarantineListResponse:
    """Retrieve quarantined messages via query parameters."""
    manager = get_quarantine_manager()
    items, total = manager.list_messages(
        tenant_id=tenant_id,
        status=status,
        limit=limit,
        offset=offset,
    )
    return QuarantineListResponse(
        total=total,
        limit=limit,
        offset=offset,
        items=[QuarantinedMessageSchema(**msg.model_dump()) for msg in items],
    )


@router.post(
    "/quarantine/replay",
    response_model=QuarantineActionResponse,
    summary="Replay quarantined messages back to ingest.raw",
)
async def replay_quarantined_messages(
    request: QuarantineReplayRequest,
) -> QuarantineActionResponse:
    """Re-publish quarantined messages back into the ingest.raw stream for reprocessing."""
    manager = get_quarantine_manager()
    replayed = manager.replay_messages(request.message_ids)
    return QuarantineActionResponse(
        action="replay",
        processed_count=len(replayed),
        message_ids=[m.message_id for m in replayed],
        message=f"Successfully replayed {len(replayed)} messages to ingest.raw.",
    )


@router.post(
    "/quarantine/discard",
    response_model=QuarantineActionResponse,
    summary="Discard quarantined messages",
)
async def discard_quarantined_messages(
    request: QuarantineDiscardRequest,
) -> QuarantineActionResponse:
    """Discard quarantined messages without reprocessing."""
    manager = get_quarantine_manager()
    discarded = manager.discard_messages(request.message_ids)
    return QuarantineActionResponse(
        action="discard",
        processed_count=len(discarded),
        message_ids=[m.message_id for m in discarded],
        message=f"Successfully discarded {len(discarded)} quarantined messages.",
    )

