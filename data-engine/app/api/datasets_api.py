"""Dataset profiling and analytical inspection API endpoints."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.dataset_input import load_dataframe_from_records_or_storage, resolve_tenant_context
from app.processing.engine.profiler import DataProfiler
from app.processing.engine.quality_framework import DataQualityFramework
from app.security import AuthIdentity, get_current_identity

router = APIRouter(prefix="/analytics/datasets", tags=["datasets-profiling"])


class ProfileDatasetRequest(BaseModel):
    tenant_id: Optional[str] = Field(default=None, description="Tenant ID.")
    dataset_name: str = Field(default="dataset", description="Name of the dataset.")
    storage_location: Optional[str] = Field(
        default=None, description="Optional tenant-scoped MinIO key when records are omitted."
    )
    records: List[Dict[str, Any]] = Field(
        default_factory=list, description="Dataset records to profile."
    )


class PreviewDatasetRequest(BaseModel):
    tenant_id: Optional[str] = Field(default=None, description="Tenant ID.")
    storage_location: Optional[str] = Field(
        default=None, description="Optional tenant-scoped MinIO key when records are omitted."
    )
    records: List[Dict[str, Any]] = Field(
        default_factory=list, description="Dataset records to preview."
    )
    limit: int = Field(default=50, ge=1, le=500, description="Max rows to return.")


@router.post("/profile", summary="Profile dataset and compute quality assessment")
def profile_dataset_endpoint(
    request: ProfileDatasetRequest,
    identity: AuthIdentity = Depends(get_current_identity),
) -> Dict[str, Any]:
    """Generates comprehensive column statistics, anomalies, and quality scores."""
    effective_tenant = resolve_tenant_context(
        identity,
        request.tenant_id,
        require_tenant=bool(request.storage_location and not request.records),
    )
    df = load_dataframe_from_records_or_storage(
        request.records,
        request.storage_location,
        effective_tenant,
        empty_detail="Cannot profile an empty dataset. Please provide at least one record.",
    )

    try:
        profiler = DataProfiler()
        profile_report = profiler.profile_dataset(df)

        sample_records = request.records[:2000] if request.records else df.head(2000).to_dicts()
        quality_framework = DataQualityFramework()
        quality_assessment = quality_framework.assess_dataset(sample_records)

        return {
            "dataset_name": request.dataset_name,
            "tenant_id": effective_tenant,
            "profile": profile_report.to_dict(),
            "quality": quality_assessment.to_dict(),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to profile dataset: {str(exc)}",
        )


@router.post("/preview", summary="Generate dataset schema and sample rows preview")
def preview_dataset_endpoint(
    request: PreviewDatasetRequest,
    identity: AuthIdentity = Depends(get_current_identity),
) -> Dict[str, Any]:
    """Inspects dataset structure, inferred types, and returns sample rows."""
    if not request.records and not (request.storage_location and request.storage_location.strip()):
        return {"columns": [], "rows": [], "total_rows": 0}

    effective_tenant = resolve_tenant_context(
        identity,
        request.tenant_id,
        require_tenant=bool(request.storage_location and not request.records),
    )
    df = load_dataframe_from_records_or_storage(
        request.records,
        request.storage_location,
        effective_tenant,
        empty_detail="Dataset contains no rows.",
    )

    try:
        preview_df = df.head(request.limit)

        columns = [{"name": col, "type": str(df.schema[col])} for col in df.columns]

        return {
            "columns": columns,
            "rows": preview_df.to_dicts(),
            "total_rows": df.height,
            "preview_limit": request.limit,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to preview dataset: {str(exc)}",
        )
