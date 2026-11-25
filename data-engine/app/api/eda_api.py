"""Exploratory Data Analysis (EDA) API endpoints for LuminAI Data Engine."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.processing.engine.dataframe_utils import records_to_polars_df
from app.processing.engine.eda_engine import EdaEngine

router = APIRouter(prefix="/analytics/eda", tags=["eda-analytics"])


class EdaRequest(BaseModel):
    tenant_id: str = Field(default="acme")
    dataset_name: Optional[str] = Field(default="dataset")
    records: List[Dict[str, Any]] = Field(..., description="Dataset records to analyze.")


@router.post("/report", summary="Generate comprehensive Exploratory Data Analysis report")
async def generate_eda_report_endpoint(request: EdaRequest) -> Dict[str, Any]:
    """Generates overview, numerical stats, categorical distributions, correlation matrix, and outliers."""
    if not request.records:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot compute EDA report on empty dataset records.",
        )

    try:
        df = records_to_polars_df(request.records)
        report = EdaEngine.generate_eda_report(df)
        report["tenant_id"] = request.tenant_id
        report["dataset_name"] = request.dataset_name
        return report
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to generate EDA report: {str(exc)}",
        )
