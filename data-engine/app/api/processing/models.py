"""Pydantic request and response schemas for processing endpoints.

Defines schemas for:
  - Pipeline triggering, execution status, and retry orchestration.
  - Cross-store data reconciliation and relational edge generation.
  - Dead-Letter Queue (DLQ) quarantine inspection and replay/discard actions.
  - Canonical Golden Record versioning, audit history, and point-in-time rollback.
  - Pre-flight schema auto-detection and data quality validation.
"""

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


# ==============================================================================
# Pipeline Triggering, Status & Retry Models
# ==============================================================================

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


# ==============================================================================
# Cross-Store Reconciliation & Graph Relational Edges Models
# ==============================================================================

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


class RelationalEdgeTriggerRequest(BaseModel):
    """Request payload for triggering relational edge generation."""

    tenant_id: str = Field(
        ...,
        description="Tenant identifier scoping the pipeline run.",
        examples=["acme"],
    )
    source_id: str = Field(
        default="default-source",
        description="ID of the data source.",
    )
    records: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Optional explicit records list. If omitted, uses staged records.",
    )
    foreign_keys: Optional[Any] = Field(
        default=None,
        description="Foreign key definitions mapping column names to target entities.",
    )
    source_entity_type: Optional[str] = Field(
        default=None,
        description="Entity type for the source records.",
    )
    publish_to_kafka: bool = Field(
        default=True,
        description="Whether to publish generated graph relationships to Kafka.",
    )
    persist_to_db: bool = Field(
        default=True,
        description="Whether to persist generated edges to the database.",
    )


class RelationalEdgeTriggerResponse(BaseModel):
    """Response payload for generated relational edges."""

    tenant_id: str
    edges_count: int
    edges: List[Dict[str, Any]]


# ==============================================================================
# Dead-Letter Queue (DLQ) & Quarantine Models
# ==============================================================================

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


# ==============================================================================
# Golden Record Versioning & Rollback Models
# ==============================================================================

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


# ==============================================================================
# Ingest Schema Auto-Detection and Pre-Flight Validation Models
# ==============================================================================

class SchemaValidationRequest(BaseModel):
    """Request payload schema for pre-flight validation and schema auto-detection."""

    file_path: Optional[str] = Field(
        default=None, description="Local or absolute file path to inspect."
    )
    object_key: Optional[str] = Field(
        default=None, description="MinIO/S3 object key to inspect."
    )
    bucket: Optional[str] = Field(default=None, description="MinIO/S3 bucket name.")
    content: Optional[str] = Field(
        default=None, description="Raw text content of the CSV or JSON file."
    )
    file_name: Optional[str] = Field(
        default="upload.csv", description="File name indicating format extension."
    )
    tenant_id: Optional[str] = Field(
        default="acme", description="Tenant scoping identifier."
    )
    reject_on_violation: bool = Field(
        default=True,
        description="Whether to reject with HTTP 422 if null percentage exceeds 50%.",
    )
    max_null_pct: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="Optional override for maximum null percentage threshold (0.0 - 100.0).",
    )


class ColumnValidationResponse(BaseModel):
    """Detailed validation and schema detection report for a single column."""

    column_name: str
    detected_type: str
    total_count: int
    null_count: int
    null_percentage: float
    unique_count: int
    unique_percentage: float
    type_distribution: Dict[str, float]
    sample_values: List[Any]
    is_rejected: bool = False
    rejection_reason: Optional[str] = None
    suggested_property: Optional[str] = None
    suggested_entity_type: Optional[str] = None
    mapping_confidence: float = 0.0


class SchemaValidationResponse(BaseModel):
    """Comprehensive pre-flight schema and data quality report."""

    is_valid: bool
    total_rows: int
    total_columns: int
    columns: List[ColumnValidationResponse]
    rejected_columns: List[str] = Field(default_factory=list)
    error_message: Optional[str] = None
    suggested_entity_type: Optional[str] = None
    entity_confidence: float = 0.0
