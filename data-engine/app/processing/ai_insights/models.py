"""Pydantic request and response schemas for AI Insights and statistical profiling."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field

InsightCategory = Literal[
    "trend", "anomaly", "data_quality", "distribution", "recommendation"
]
InsightSeverity = Literal["info", "warning", "critical"]


class InsightItem(BaseModel):
    """Structured actionable data insight."""

    title: str = Field(..., description="Short executive title of the insight.")
    category: InsightCategory = Field(
        ..., description="Insight category (trend, anomaly, data_quality, etc.)."
    )
    severity: InsightSeverity = Field(..., description="Severity level of the insight.")
    description: str = Field(
        ..., description="Detailed narrative explanation of the observed pattern."
    )
    impact: Optional[str] = Field(
        default=None, description="Operational or business impact."
    )
    recommendation: Optional[str] = Field(
        default=None, description="Recommended remediation or action item."
    )


class MetricSummary(BaseModel):
    """High-level summary metric with optional change indicator."""

    name: str = Field(..., description="Metric display name.")
    value: Any = Field(..., description="Metric value (number or string).")
    unit: Optional[str] = Field(default=None, description="Unit of measurement.")
    change_pct: Optional[float] = Field(
        default=None, description="Percentage change if time-series available."
    )


class InsightsRequest(BaseModel):
    """Request payload for generating AI-powered analytical insights."""

    tenant_id: str = Field(
        ..., description="Tenant identifier scoping the analytical query."
    )
    entity_type: str = Field(
        ..., description="Ontology entity type to inspect (e.g. Person, Transaction)."
    )
    table: str = Field(
        default="golden_records",
        description="Target table ('golden_records' or 'staging_records').",
    )
    time_field: Optional[str] = Field(
        default=None,
        description="Optional timestamp field to compute velocity and time trends.",
    )
    filters: Dict[str, Any] = Field(
        default_factory=dict,
        description="Optional key-value filters to restrict analysis scope.",
    )
    focus_question: Optional[str] = Field(
        default=None,
        description="Optional specific question to direct AI analysis.",
    )


class InsightsResponse(BaseModel):
    """Response containing AI-generated executive summary, metrics, and insights."""

    tenant_id: str = Field(..., description="Tenant identifier.")
    entity_type: str = Field(..., description="Entity type analyzed.")
    table: str = Field(..., description="Target database table analyzed.")
    row_count: int = Field(..., description="Total records matching criteria.")
    executive_summary: str = Field(
        ..., description="High-level narrative executive summary."
    )
    key_metrics: List[MetricSummary] = Field(
        default_factory=list, description="Key aggregated operational metrics."
    )
    insights: List[InsightItem] = Field(
        default_factory=list, description="List of structured findings."
    )
    provider: str = Field(
        ..., description="AI engine provider used ('gemini', 'openai', or 'heuristic')."
    )
    generated_at: str = Field(..., description="ISO 8601 UTC timestamp of generation.")
