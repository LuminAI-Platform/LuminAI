"""Transformation Pipeline Builder API endpoints for LuminAI Data Engine."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
import polars as pl
from pydantic import BaseModel, Field

from app.processing.engine.pipeline_builder import (
    PipelineBuilderEngine,
    TransformationStep,
)

router = APIRouter(prefix="/analytics/pipelines", tags=["pipeline-builder"])


class TransformationStepModel(BaseModel):
    step_id: Optional[str] = None
    step_type: str = Field(..., description="Step type (FILTER, SELECT, DROP, RENAME, DERIVE, JOIN, GROUP_BY, SORT, DEDUPLICATE).")
    parameters: Dict[str, Any] = Field(default_factory=dict)
    description: Optional[str] = None


class PipelineExecuteRequest(BaseModel):
    pipeline_id: Optional[str] = None
    tenant_id: str = Field(default="acme")
    dataset_name: str = Field(default="curated_dataset")
    records: List[Dict[str, Any]] = Field(..., description="Primary input dataset records.")
    steps: List[TransformationStepModel] = Field(..., description="Ordered transformation steps.")
    secondary_datasets: Optional[Dict[str, List[Dict[str, Any]]]] = Field(
        default=None,
        description="Optional additional datasets for Joins.",
    )


@router.post("/execute", summary="Execute multi-step transformation pipeline and produce curated dataset")
async def execute_pipeline(request: PipelineExecuteRequest) -> Dict[str, Any]:
    """Applies transformation DAG pipeline and returns curated output dataset with execution report."""
    if not request.records:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot execute pipeline on empty dataset.",
        )

    try:
        input_df = pl.DataFrame(request.records)
        sec_dfs: Dict[str, pl.DataFrame] = {}
        if request.secondary_datasets:
            for k, rows in request.secondary_datasets.items():
                sec_dfs[k] = pl.DataFrame(rows)

        steps = [
            TransformationStep(
                step_id=s.step_id or f"step-{i+1}",
                step_type=s.step_type,
                parameters=s.parameters,
                description=s.description,
            )
            for i, s in enumerate(request.steps)
        ]

        out_df, report = PipelineBuilderEngine.execute_pipeline(
            input_df=input_df,
            steps=steps,
            secondary_datasets=sec_dfs,
            pipeline_id=request.pipeline_id,
        )

        return {
            "pipeline_id": report.pipeline_id,
            "run_id": report.run_id,
            "tenant_id": request.tenant_id,
            "curated_dataset_name": request.dataset_name,
            "total_input_rows": report.total_input_rows,
            "total_output_rows": report.total_output_rows,
            "step_metrics": report.step_metrics,
            "execution_time_ms": report.execution_time_ms,
            "columns": [{"name": c, "type": str(out_df.schema[c])} for c in out_df.columns],
            "rows": out_df.to_dicts(),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Pipeline execution failed: {str(exc)}",
        )
