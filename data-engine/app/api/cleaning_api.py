"""Cleaning and preview API endpoints for LuminAI Data Engine."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.processing.engine.cleaning_engine import CleaningEngine, CleaningStepConfig
from app.processing.engine.dataframe_utils import records_to_polars_df
from app.security import AuthIdentity, get_current_identity, resolve_effective_tenant

router = APIRouter(prefix="/analytics/cleaning", tags=["cleaning-engine"])


class StepConfigModel(BaseModel):
    step_id: Optional[str] = None
    operation: str = Field(..., description="Cleaning operation name.")
    column: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    description: Optional[str] = None


class PreviewStepRequest(BaseModel):
    records: List[Dict[str, Any]] = Field(..., description="Dataset records to clean.")
    step: StepConfigModel
    preview_limit: int = Field(default=50, ge=1, le=500)


class ExecuteRecipeRequest(BaseModel):
    tenant_id: str = Field(default="acme")
    dataset_name: str = Field(default="cleaned_dataset")
    records: List[Dict[str, Any]] = Field(...)
    steps: List[StepConfigModel] = Field(...)


@router.post("/preview", summary="Interactive non-destructive preview of a cleaning operation")
def preview_cleaning_operation(request: PreviewStepRequest) -> Dict[str, Any]:
    """Generates before vs after diffs, affected records count, and quality delta."""
    if not request.records:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot preview cleaning on empty dataset.",
        )

    try:
        df = records_to_polars_df(request.records)
        engine = CleaningEngine()
        step_config = CleaningStepConfig(
            step_id=request.step.step_id or "preview-step",
            operation=request.step.operation,
            column=request.step.column,
            parameters=request.step.parameters,
            description=request.step.description,
        )
        res = engine.preview_step(df, step_config, preview_limit=request.preview_limit)
        return res.to_dict()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Preview failed: {str(exc)}",
        )


@router.post("/execute", summary="Execute cleaning recipe and produce cleaned dataset with audit log")
def execute_cleaning_recipe(
    request: ExecuteRecipeRequest,
    identity: AuthIdentity = Depends(get_current_identity),
) -> Dict[str, Any]:
    """Executes full cleaning recipe, generating reproducible audit logs and new clean records."""
    effective_tenant = resolve_effective_tenant(identity, request.tenant_id) or request.tenant_id
    if not request.records:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot execute cleaning recipe on empty dataset.",
        )

    try:
        df = records_to_polars_df(request.records)
        engine = CleaningEngine(tenant_id=effective_tenant)
        steps = [
            CleaningStepConfig(
                step_id=s.step_id or f"step-{i+1}",
                operation=s.operation,
                column=s.column,
                parameters=s.parameters,
                description=s.description,
            )
            for i, s in enumerate(request.steps)
        ]
        clean_df, audit_log = engine.execute_recipe(df, steps)

        return {
            "dataset_name": request.dataset_name,
            "tenant_id": effective_tenant,
            "total_input_rows": df.height,
            "total_output_rows": clean_df.height,
            "audit_log": audit_log,
            "columns": [{"name": c, "type": str(clean_df.schema[c])} for c in clean_df.columns],
            "rows": clean_df.to_dicts(),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cleaning execution failed: {str(exc)}",
        )
