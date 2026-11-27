"""Dataset profiling and analytical inspection API endpoints."""

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.processing.engine.dataframe_utils import records_to_polars_df
from app.processing.engine.profiler import DataProfiler
from app.processing.engine.quality_framework import DataQualityFramework
from app.security import AuthIdentity, get_current_identity, resolve_effective_tenant

router = APIRouter(prefix="/analytics/datasets", tags=["datasets-profiling"])


class ProfileDatasetRequest(BaseModel):
    tenant_id: str = Field(default="acme", description="Tenant ID.")
    dataset_name: str = Field(default="dataset", description="Name of the dataset.")
    records: List[Dict[str, Any]] = Field(..., description="Dataset records to profile.")


class PreviewDatasetRequest(BaseModel):
    records: List[Dict[str, Any]] = Field(..., description="Dataset records to preview.")
    limit: int = Field(default=50, ge=1, le=500, description="Max rows to return.")


@router.post("/profile", summary="Profile dataset and compute quality assessment")
def profile_dataset_endpoint(
    request: ProfileDatasetRequest,
    identity: AuthIdentity = Depends(get_current_identity),
) -> Dict[str, Any]:
    """Generates comprehensive column statistics, anomalies, and quality scores."""
    effective_tenant = resolve_effective_tenant(identity, request.tenant_id) or request.tenant_id
    if not request.records:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot profile an empty dataset. Please provide at least one record.",
        )

    try:
        df = records_to_polars_df(request.records)
        profiler = DataProfiler()
        profile_report = profiler.profile_dataset(df)

        quality_framework = DataQualityFramework()
        quality_assessment = quality_framework.assess_dataset(request.records)

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
def preview_dataset_endpoint(request: PreviewDatasetRequest) -> Dict[str, Any]:
    """Inspects dataset structure, inferred types, and returns sample rows."""
    if not request.records:
        return {"columns": [], "rows": [], "total_rows": 0}

    try:
        df = records_to_polars_df(request.records)
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
