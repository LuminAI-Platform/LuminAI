"""Schema detection and pre-flight validation Pydantic models."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


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
