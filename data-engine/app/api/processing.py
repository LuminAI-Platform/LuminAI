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

