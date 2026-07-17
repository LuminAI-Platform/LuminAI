"""Processing pipeline trigger and status endpoints.

POST /process/trigger          →  Queue a Dagster pipeline run.
GET  /process/status/{run_id}  →  Poll the status of a queued run.

Sprint 0: Stub implementations that return mock tracking data.
These will be wired to the Dagster REST API in Sprint 1.
"""

import uuid
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()


# Request / Response Models

class TriggerRequest(BaseModel):
    """Request body for triggering a data pipeline run."""

    source_id: str = Field(
        ...,
        description="ID of the data source / connector to process.",
        example="connector-abc123",
    )
    tenant_id: str = Field(
        ...,
        description="Tenant identifier scoping the pipeline run.",
        example="acme",
    )
    options: dict = Field(
        default_factory=dict,
        description="Optional pipeline configuration overrides.",
    )


class TriggerResponse(BaseModel):
    """Response after successfully queuing a pipeline run."""

    run_id: str
    status: Literal["queued", "running", "completed", "failed"]
    message: str


class StatusResponse(BaseModel):
    """Pipeline run status payload."""

    run_id: str
    status: Literal["queued", "running", "completed", "failed"]
    progress_pct: int = Field(ge=0, le=100)
    message: str


# Endpoints

@router.post(
    "/trigger",
    response_model=TriggerResponse,
    summary="Trigger a Dagster pipeline run",
    status_code=202,
)
async def trigger_pipeline(request: TriggerRequest) -> TriggerResponse:
    """
    Queue a data processing pipeline for a given source.

    - Accepts a **source_id** and **tenant_id** to scope the run.
    - Returns a **run_id** for polling the run status.

    > **Sprint 0 stub**: The run is not actually dispatched to Dagster yet.
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
    """
    Retrieve the current execution status of a pipeline run.

    > **Sprint 0 stub**: Always returns a mock "running" status.
    """
    return StatusResponse(
        run_id=run_id,
        status="running",
        progress_pct=42,
        message="Pipeline is running (stub response — Dagster integration coming in Sprint 1).",
    )
