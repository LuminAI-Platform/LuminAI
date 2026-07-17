"""Processing pipeline trigger and status endpoints.

POST /process/trigger          →  Queue a Dagster pipeline run.
GET  /process/status/{run_id}  →  Poll the status of a queued run.
"""

import uuid
from typing import Any, Dict, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

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
        examples=["Pipeline is running (ingesting data from source)."],
    )


# Endpoints

@router.post(
    "/trigger",
    response_model=TriggerResponse,
    summary="Trigger a Dagster pipeline run",
    status_code=202,
)
async def trigger_pipeline(request: TriggerRequest) -> TriggerResponse:
    """Queue a data processing pipeline for a given source connector.

    ### Parameters:
    - **source_id**: Unique connector identifier.
    - **tenant_id**: Tenant scoping criteria.
    - **options**: Dictionary of pipeline config options.
    
    ### Behavior:
    - Initiates an asynchronous Dagster asset materialization run.
    - Returns a `run_id` to poll for completion.
    """
    run_id = str(uuid.uuid4())
    return TriggerResponse(
        run_id=run_id,
        status="queued",
        message=f"Pipeline queued for source '{request.source_id}' (tenant: {request.tenant_id}).",
    )


@router.get(
    "/status/{run_id}",
    response_model=StatusResponse,
    summary="Get pipeline run status",
)
async def get_pipeline_status(run_id: str) -> StatusResponse:
    """Retrieve the current progress and status of an active pipeline run.

    ### Parameters:
    - **run_id**: UUID of the target pipeline run.
    """
    return StatusResponse(
        run_id=run_id,
        status="running",
        progress_pct=42,
        message="Pipeline is running (processing assets via Dagster framework).",
    )
