"""Dataset profiling and analytical inspection API endpoints."""

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, status
import polars as pl
from pydantic import BaseModel, Field

from app.processing.engine.profiler import DataProfiler
from app.processing.engine.quality_framework import DataQualityFramework

router = APIRouter(prefix="/analytics/datasets", tags=["datasets-profiling"])


class ProfileDatasetRequest(BaseModel):
    tenant_id: str = Field(default="acme", description="Tenant ID.")
    dataset_name: str = Field(default="dataset", description="Name of the dataset.")
    records: List[Dict[str, Any]] = Field(..., description="Dataset records to profile.")


class PreviewDatasetRequest(BaseModel):
    records: List[Dict[str, Any]] = Field(..., description="Dataset records to preview.")
    limit: int = Field(default=50, ge=1, le=500, description="Max rows to return.")


@router.post("/profile", summary="Profile dataset and compute quality assessment")
async def profile_dataset_endpoint(request: ProfileDatasetRequest) -> Dict[str, Any]:
    """Generates comprehensive column statistics, anomalies, and quality scores."""
    if not request.records:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot profile an empty dataset. Please provide at least one record.",
        )

    try:
        df = pl.DataFrame(request.records)
        profiler = DataProfiler()
        profile_report = profiler.profile_dataset(df)

        quality_framework = DataQualityFramework()
        quality_assessment = quality_framework.assess_dataset(request.records)

        return {
            "dataset_name": request.dataset_name,
            "tenant_id": request.tenant_id,
            "profile": profile_report.to_dict(),
            "quality": quality_assessment.to_dict(),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to profile dataset: {str(exc)}",
        )


@router.post("/preview", summary="Generate dataset schema and sample rows preview")
async def preview_dataset_endpoint(request: PreviewDatasetRequest) -> Dict[str, Any]:
    """Inspects dataset structure, inferred types, and returns sample rows."""
    if not request.records:
        return {"columns": [], "rows": [], "total_rows": 0}

    try:
        df = pl.DataFrame(request.records)
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
