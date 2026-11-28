"""Cleaning and preview API endpoints for LuminAI Data Engine."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.dataset_input import load_dataframe_from_records_or_storage, resolve_tenant_context
from app.processing.engine.cleaning_engine import CleaningEngine, CleaningStepConfig
from app.security import AuthIdentity, get_current_identity

router = APIRouter(prefix="/analytics/cleaning", tags=["cleaning-engine"])


class StepConfigModel(BaseModel):
    step_id: Optional[str] = None
    operation: str = Field(..., description="Cleaning operation name.")
    column: Optional[str] = None
    columns: Optional[List[str]] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    description: Optional[str] = None


class PreviewStepRequest(BaseModel):
    tenant_id: Optional[str] = Field(default=None)
    storage_location: Optional[str] = Field(
        default=None, description="Optional tenant-scoped MinIO key when records are omitted."
    )
    records: List[Dict[str, Any]] = Field(
        default_factory=list, description="Dataset records to clean."
    )
    step: StepConfigModel
    preview_limit: int = Field(default=50, ge=1, le=500)


class ExecuteRecipeRequest(BaseModel):
    tenant_id: Optional[str] = Field(default=None)
    dataset_name: str = Field(default="cleaned_dataset")
    storage_location: Optional[str] = Field(
        default=None, description="Optional tenant-scoped MinIO key when records are omitted."
    )
    records: List[Dict[str, Any]] = Field(default_factory=list)
    steps: List[StepConfigModel] = Field(...)


def _expand_cleaning_step(s: StepConfigModel, index: int) -> List[CleaningStepConfig]:
    """Normalize single-column or multi-column step definitions into CleaningStepConfig entries."""
    base_id = s.step_id or f"step-{index + 1}"
    cols = [c for c in (s.columns or s.parameters.get("columns") or []) if isinstance(c, str) and c]
    if s.column or not cols:
        return [
            CleaningStepConfig(
                step_id=base_id,
                operation=s.operation,
                column=s.column,
                parameters=s.parameters,
                description=s.description,
            )
        ]

    if s.operation in ("remove_missing", "deduplicate"):
        params = dict(s.parameters)
        if s.operation == "remove_missing":
            params.setdefault("columns", cols)
        else:
            params.setdefault("subset", cols)
        return [
            CleaningStepConfig(
                step_id=base_id,
                operation=s.operation,
                column=cols[0],
                parameters=params,
                description=s.description,
            )
        ]

    return [
        CleaningStepConfig(
            step_id=f"{base_id}-{col_idx + 1}" if len(cols) > 1 else base_id,
            operation=s.operation,
            column=col,
            parameters=s.parameters,
            description=s.description,
        )
        for col_idx, col in enumerate(cols)
    ]


@router.post("/preview", summary="Interactive non-destructive preview of a cleaning operation")
def preview_cleaning_operation(
    request: PreviewStepRequest,
    identity: AuthIdentity = Depends(get_current_identity),
) -> Dict[str, Any]:
    """Generates before vs after diffs, affected records count, and quality delta."""
    effective_tenant = resolve_tenant_context(
        identity,
        request.tenant_id,
        require_tenant=bool(request.storage_location and not request.records),
    )
    df = load_dataframe_from_records_or_storage(
        request.records,
        request.storage_location,
        effective_tenant,
        empty_detail="Cannot preview cleaning on empty dataset.",
    )

    try:
        engine = CleaningEngine(tenant_id=effective_tenant or "tenant")
        expanded = _expand_cleaning_step(request.step, 0)
        res = engine.preview_step(df, expanded[0], preview_limit=request.preview_limit)
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
    effective_tenant = resolve_tenant_context(
        identity,
        request.tenant_id,
        require_tenant=bool(request.storage_location and not request.records),
    )
    df = load_dataframe_from_records_or_storage(
        request.records,
        request.storage_location,
        effective_tenant,
        empty_detail="Cannot execute cleaning recipe on empty dataset.",
    )

    try:
        engine = CleaningEngine(tenant_id=effective_tenant or "tenant")
        steps: List[CleaningStepConfig] = []
        for idx, step_model in enumerate(request.steps):
            steps.extend(_expand_cleaning_step(step_model, idx))
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
