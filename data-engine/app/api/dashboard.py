"""Dashboard analytics endpoints for the LuminAI frontend.

GET /analytics/dashboard/pipeline-stats   →  Pipeline execution metrics.
GET /analytics/dashboard/data-quality     →  Data quality dimension scores.
GET /analytics/dashboard/entity-stats     →  Entity counts and type breakdown.
"""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.processing.dashboard_service import DashboardAnalyticsService

router = APIRouter()

# ─── Default tenant used when callers omit the query parameter ─────────────
_DEFAULT_TENANT = "acme"


# ─── Response Schemas ──────────────────────────────────────────────────────


class PipelineStatsResponse(BaseModel):
    """Aggregated pipeline execution metrics for the dashboard."""

    totalRuns: int = Field(
        ...,
        description="Total number of pipeline executions for the tenant.",
        examples=[42],
    )
    successRate: float = Field(
        ...,
        ge=0,
        le=100,
        description="Percentage of pipeline runs that completed successfully (0–100).",
        examples=[87.5],
    )
    avgDuration: float = Field(
        ...,
        ge=0,
        description="Average pipeline run duration in seconds.",
        examples=[123.45],
    )
    recordsProcessed: int = Field(
        ...,
        ge=0,
        description="Total records processed across golden and staging tables.",
        examples=[15000],
    )
    lastRunAt: Optional[str] = Field(
        default=None,
        description="ISO-8601 timestamp of the most recent pipeline execution.",
        examples=["2026-09-24T18:30:00+00:00"],
    )


class DataQualityResponse(BaseModel):
    """Data quality dimension scores for the dashboard."""

    overallScore: float = Field(
        ...,
        ge=0,
        le=100,
        description="Weighted composite data quality score (0–100).",
        examples=[92.3],
    )
    completeness: float = Field(
        ...,
        ge=0,
        le=100,
        description="Percentage of golden records with non-empty attributes.",
        examples=[98.0],
    )
    uniqueness: float = Field(
        ...,
        ge=0,
        le=100,
        description="Percentage of distinct golden record identifiers (no duplicates).",
        examples=[100.0],
    )
    consistency: float = Field(
        ...,
        ge=0,
        le=100,
        description="Percentage of records with valid, parseable JSON attributes.",
        examples=[95.5],
    )
    timeliness: float = Field(
        ...,
        ge=0,
        le=100,
        description="Percentage of records updated within the last 30 days.",
        examples=[88.0],
    )


class EntityStatsResponse(BaseModel):
    """Entity counts and type breakdown for the dashboard."""

    totalGoldenRecords: int = Field(
        ...,
        ge=0,
        description="Total canonical golden records for the tenant.",
        examples=[1200],
    )
    totalStagingRecords: int = Field(
        ...,
        ge=0,
        description="Total staging records awaiting entity resolution.",
        examples=[3400],
    )
    pendingERCandidates: int = Field(
        ...,
        ge=0,
        description="Number of ER candidate pairs pending human review.",
        examples=[56],
    )
    entityTypeBreakdown: Dict[str, int] = Field(
        default_factory=dict,
        description="Golden record counts grouped by ontology entity type.",
        examples=[{"Person": 800, "Organization": 300, "Dataset": 100}],
    )


# ─── Endpoints ─────────────────────────────────────────────────────────────


@router.get(
    "/pipeline-stats",
    response_model=PipelineStatsResponse,
    summary="Pipeline execution statistics",
)
async def get_pipeline_stats(
    tenant_id: str = Query(
        default=_DEFAULT_TENANT,
        description="Tenant identifier scoping the pipeline stats.",
    ),
) -> PipelineStatsResponse:
    """Retrieve aggregated pipeline execution metrics for the specified tenant.

    Queries the pipeline run tracker (SQLite-backed) and PostgreSQL record
    counts to compute total runs, success rate, average duration, and total
    records processed.
    """
    service = DashboardAnalyticsService()
    stats = service.get_pipeline_stats(tenant_id)
    return PipelineStatsResponse(**stats)


@router.get(
    "/data-quality",
    response_model=DataQualityResponse,
    summary="Data quality dimension scores",
)
async def get_data_quality(
    tenant_id: str = Query(
        default=_DEFAULT_TENANT,
        description="Tenant identifier scoping the quality analysis.",
    ),
) -> DataQualityResponse:
    """Compute data quality dimension scores for the specified tenant.

    Analyses golden records via DuckDB to calculate completeness,
    uniqueness, consistency, and timeliness. The overall score is a
    weighted composite (30% completeness, 30% uniqueness, 20% consistency,
    20% timeliness).
    """
    service = DashboardAnalyticsService()
    quality = service.get_data_quality(tenant_id)
    return DataQualityResponse(**quality)


@router.get(
    "/entity-stats",
    response_model=EntityStatsResponse,
    summary="Entity counts and type breakdown",
)
async def get_entity_stats(
    tenant_id: str = Query(
        default=_DEFAULT_TENANT,
        description="Tenant identifier scoping the entity statistics.",
    ),
) -> EntityStatsResponse:
    """Retrieve entity counts and type distribution for the specified tenant.

    Returns total golden records, staging records, pending ER candidates,
    and a breakdown of golden record counts grouped by ontology entity type
    (extracted from the JSON ``attributes`` column via DuckDB).
    """
    service = DashboardAnalyticsService()
    stats = service.get_entity_stats(tenant_id)
    return EntityStatsResponse(**stats)
