"""Pipeline execution, polling, and retry management endpoints.

Endpoints:
  POST /trigger       → Queue a data cleaning Dagster pipeline run.
  POST /clean         → Alias for /trigger (legacy).
  POST /er/trigger    → Queue an Entity Resolution (ER) Dagster pipeline run.
  POST /resolve       → Alias for /er/trigger (legacy).
  GET  /status/{id}   → Poll the progress and execution state of a run.
  GET  /jobs/{id}     → Alias for /status/{id} (legacy).
  POST /retry/{id}    → Resume a failed run from intermediate step checkpoints.
"""

import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from pydantic import BaseModel, Field
import polars as pl

from app.api.processing.models import (
    ErTriggerRequest,
    RetryResponse,
    StatusResponse,
    TriggerRequest,
    TriggerResponse,
)
from app.processing.engine import DatasetCleaner
from app.processing.run_tracker import get_run_tracker
from app.processing.trigger import DagsterTrigger

router = APIRouter()


class DatasetCleanRequest(BaseModel):
    """Payload for on-demand synchronous dataset cleaning and evaluation."""
    tenant_id: str = "acme"
    source_id: str = "dataset"
    entity_type: Optional[str] = None
    rows: List[Dict[str, Any]] = Field(default_factory=list)
    options: Dict[str, Any] = Field(default_factory=dict)


@router.post(
    "/dataset/clean",
    summary="Synchronously clean, standardize, and evaluate dataset",
    response_model=Dict[str, Any],
)
async def clean_dataset_sync(request: DatasetCleanRequest) -> Dict[str, Any]:
    """Execute full data cleaning, profiling, ER, and DAMA quality assessment synchronously."""
    cleaner = DatasetCleaner(tenant_id=request.tenant_id, source_id=request.source_id)
    if not request.rows:
        return {
            "connectionId": request.source_id,
            "totalRawRecords": 0,
            "totalCleanRecords": 0,
            "duplicatesMerged": 0,
            "dataQualityScore": 100.0,
            "status": "COMPLETED",
            "columns": [],
            "rows": [],
            "goldenRecords": [],
        }

    try:
        from app.processing.engine.dataframe_utils import records_to_polars_df

        df = records_to_polars_df(request.rows)
    except Exception:
        import pandas as pd

        df = pl.from_pandas(pd.DataFrame(request.rows))

    result = cleaner.process_dataframe(df, entity_type_hint=request.entity_type)
    return result.to_api_response()


@router.post(
    "/trigger",
    response_model=TriggerResponse,
    summary="Trigger a data cleaning pipeline run",
    status_code=202,
)
@router.post(
    "/clean",
    response_model=TriggerResponse,
    status_code=202,
    include_in_schema=False,
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
        metadata={
            "options": request.options,
            "tenant_id": request.tenant_id,
            "source_id": request.source_id,
        },
    )

    trigger = DagsterTrigger()
    background_tasks.add_task(
        trigger.trigger_cleaning_pipeline,
        request.tenant_id,
        request.source_id,
        {"run_id": run_id, "auto_er": True, **request.options},
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
@router.post(
    "/resolve",
    response_model=TriggerResponse,
    status_code=202,
    include_in_schema=False,
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
        metadata={"tenant_id": request.tenant_id, "source_id": request.source_id},
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


@router.get(
    "/status/{run_id}",
    response_model=StatusResponse,
    summary="Get pipeline run status",
)
@router.get(
    "/jobs/{run_id}",
    response_model=StatusResponse,
    include_in_schema=False,
)
async def get_pipeline_status(run_id: str) -> StatusResponse:
    """Retrieve the current progress and status of an active pipeline run."""
    tracker = get_run_tracker()
    rec = tracker.get_status(run_id)

    # Synthesize timeline logs
    logs: List[str] = []
    if rec.started_at:
        logs.append(f"[{rec.started_at}] Pipeline execution started.")
    for step in rec.steps_completed:
        logs.append(f"Step '{step}' completed.")
    if rec.current_step and rec.current_step not in rec.steps_completed:
        logs.append(f"Executing step '{rec.current_step}'...")
    if rec.message and rec.message not in logs:
        logs.append(rec.message)
    for err in rec.error_history:
        step_name = err.get("step", "unknown") if isinstance(err, dict) else "unknown"
        err_msg = err.get("error", "") if isinstance(err, dict) else str(err)
        logs.append(f"Error in step '{step_name}': {err_msg}")
    if rec.error and rec.error not in logs:
        logs.append(f"Error: {rec.error}")
    if rec.completed_at:
        logs.append(f"[{rec.completed_at}] Pipeline completed with status '{rec.status}'.")

    # Return actual recorded DAMA dimension quality scores when present (never fabricate fake scores)
    meta = getattr(rec, "metadata", {}) or {}
    raw_scores = meta.get("quality_scores")
    quality_scores: Dict[str, float] = raw_scores if isinstance(raw_scores, dict) else {}

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
        retry_count=rec.retry_count,
        failed_step=rec.failed_step,
        error_history=rec.error_history,
        logs=logs,
        quality_scores=quality_scores,
    )


@router.post(
    "/retry/{run_id}",
    response_model=RetryResponse,
    summary="Retry a failed pipeline run from failed step",
    status_code=200,
)
async def retry_pipeline_run(
    run_id: str,
    background_tasks: BackgroundTasks,
) -> RetryResponse:
    """Retry a failed pipeline run, resuming execution from intermediate checkpoints.

    Validates that:
      1. The run exists in tracking storage.
      2. The run's current status is 'failed'.
      3. The run has not exceeded the maximum retry limit (max 3 retries).
    """
    tracker = get_run_tracker()
    rec = tracker.get_status(run_id)

    # Check existence
    if rec.pipeline_name == "unknown" and rec.message.startswith("Pipeline run '"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pipeline run '{run_id}' not found.",
        )

    # Check status
    if rec.status != "failed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot retry run '{run_id}' with status '{rec.status}'. Only failed runs can be retried.",
        )

    # Check retry limit
    if rec.retry_count >= 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum retry limit of 3 exceeded for run '{run_id}' (attempted {rec.retry_count} times).",
        )

    resumed_step = rec.failed_step or "checkpoint"
    updated_rec = tracker.retry_run(
        run_id,
        message=f"Pipeline run '{run_id}' retrying from step '{resumed_step}' (attempt {rec.retry_count + 1}/3).",
    )

    trigger = DagsterTrigger()
    background_tasks.add_task(trigger.retry_pipeline, run_id)

    return RetryResponse(
        run_id=run_id,
        status="running",
        retry_count=updated_rec.retry_count,
        resumed_step=resumed_step,
        message=f"Pipeline run '{run_id}' scheduled for retry from step '{resumed_step}' (attempt {updated_rec.retry_count}/3).",
    )
