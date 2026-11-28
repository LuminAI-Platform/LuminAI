"""Exploratory Data Analysis (EDA) API endpoints for LuminAI Data Engine."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.dataset_input import load_dataframe_from_records_or_storage, resolve_tenant_context
from app.processing.engine.eda_engine import EdaEngine
from app.processing.engine.profiler import DataProfiler
from app.processing.engine.quality_framework import DataQualityFramework
from app.security import AuthIdentity, get_current_identity

router = APIRouter(prefix="/analytics/eda", tags=["eda-analytics"])


class EdaRequest(BaseModel):
    tenant_id: Optional[str] = Field(default=None, description="Tenant ID.")
    dataset_name: Optional[str] = Field(default="dataset")
    storage_location: Optional[str] = Field(
        default=None, description="Optional tenant-scoped MinIO key when records are omitted."
    )
    records: List[Dict[str, Any]] = Field(
        default_factory=list, description="Dataset records to analyze."
    )


def _compute_column_health(col_prof: Dict[str, Any], total_rows: int) -> float:
    null_pct = float(col_prof.get("null_percentage", 0.0) or 0.0)
    if total_rows > 0:
        invalid_pct = (float(col_prof.get("invalid_count", 0) or 0) / total_rows) * 100.0
    else:
        invalid_pct = 0.0
    return round(max(0.0, min(100.0, 100.0 - null_pct - invalid_pct)), 1)


@router.post("/report", summary="Generate comprehensive Exploratory Data Analysis report")
def generate_eda_report_endpoint(
    request: EdaRequest,
    identity: AuthIdentity = Depends(get_current_identity),
) -> Dict[str, Any]:
    """Generates overview, statistics, histograms, per-column profiles, and DAMA quality dimensions."""
    effective_tenant = resolve_tenant_context(
        identity,
        request.tenant_id,
        require_tenant=bool(request.storage_location and not request.records),
    )
    df = load_dataframe_from_records_or_storage(
        request.records,
        request.storage_location,
        effective_tenant,
        empty_detail="Cannot compute EDA report on empty dataset records.",
    )

    try:
        report = EdaEngine.generate_eda_report(df)
        profile = DataProfiler().profile_dataset(df).to_dict()
        sample_records = request.records[:2000] if request.records else df.head(2000).to_dicts()
        quality_assessment = DataQualityFramework.evaluate_dataset(sample_records)
        quality_dict = quality_assessment.to_dict()
        dim_scores = quality_dict.get("dimension_scores", {})

        unified_columns: Dict[str, Dict[str, Any]] = {}
        num_stats = report.get("numeric_statistics", {})
        cat_stats = report.get("categorical_statistics", {})
        for col_name, col_prof in (profile.get("columns") or {}).items():
            enriched = dict(col_prof)
            enriched.setdefault("distinct_count", enriched.get("unique_count", 0))
            if not enriched.get("histogram") and col_name in num_stats:
                enriched["histogram"] = num_stats[col_name].get("histogram", [])
            if col_name in cat_stats and not enriched.get("most_frequent_values"):
                enriched["most_frequent_values"] = cat_stats[col_name].get("top_categories", [])
            enriched["health"] = _compute_column_health(enriched, df.height)
            unified_columns[col_name] = enriched

        overall_score = dim_scores.get("overall_score")
        report.update(
            {
                "tenant_id": effective_tenant,
                "dataset_name": request.dataset_name,
                "row_count": df.height,
                "column_count": df.width,
                "schema": profile.get("schema_info", {}),
                "columns": unified_columns,
                "quality_issues": profile.get("quality_issues", []),
                "anomalies": profile.get("anomalies", []),
                "quality": quality_dict,
                "quality_dimensions": dim_scores,
                "overallScore": overall_score,
                "quality_score": overall_score,
                "completeness": dim_scores.get("completeness"),
                "validity": dim_scores.get("validity"),
                "consistency": dim_scores.get("consistency"),
                "uniqueness": dim_scores.get("uniqueness"),
                "accuracy": dim_scores.get("accuracy"),
                "referential_integrity": dim_scores.get("referential_integrity"),
            }
        )
        return report
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to generate EDA report: {str(exc)}",
        )
