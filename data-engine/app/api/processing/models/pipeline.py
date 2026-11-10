"""Pipeline trigger, status, and retry Pydantic models."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


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
    retry_count: int = Field(
        default=0,
        description="Number of retry attempts executed for this run.",
    )
    failed_step: Optional[str] = Field(
        default=None,
        description="The step that triggered the pipeline failure.",
    )
    error_history: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Historical log of step errors and retry attempts.",
    )


class RetryResponse(BaseModel):
    """Response schema returned when retrying a failed pipeline run."""

    run_id: str = Field(
        ...,
        description="The unique identifier of the retried pipeline run.",
        examples=["d3b07384-d113-4ec2-a5f6-2a6c2bb47509"],
    )
    status: Literal["queued", "running", "completed", "failed"] = Field(
        ...,
        description="The updated execution stage of the job.",
        examples=["running"],
    )
    retry_count: int = Field(
        ...,
        description="The current retry attempt number.",
        examples=[1],
    )
    resumed_step: Optional[str] = Field(
        default=None,
        description="The step/asset from which execution resumes.",
        examples=["deduplicated_ingestion_data"],
    )
    message: str = Field(
        ...,
        description="Information message detailing the retry outcome.",
        examples=["Pipeline run scheduled for retry."],
    )
