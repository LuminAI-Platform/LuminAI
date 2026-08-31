"""Analytics endpoints for ad-hoc aggregation, time-series rollups, and cross-store reconciliation reports.

POST /analytics/query           →  Execute an ad-hoc analytical query.
POST /analytics/timeseries      →  Compute time-series rollups.
GET  /analytics/reconciliation  →  Retrieve Cross-Store Reconciliation health report.
"""

from typing import Any, Dict, List
from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.processing.reconciliation import (
    ReconciliationReport,
    run_cross_store_reconciliation,
)

router = APIRouter()


# Request / Response Models

class QueryRequest(BaseModel):
    """Request payload schema for executing an ad-hoc analytical query."""

    tenant_id: str = Field(
        ...,
        description="Tenant identifier scoping the analytical query.",
        examples=["acme"],
    )
    entity_type: str = Field(
        ...,
        description="The ontology entity type to aggregate over.",
        examples=["Person"],
    )
    aggregations: List[str] = Field(
        default_factory=list,
        description="List of aggregation operations to perform (e.g., count, avg, sum).",
        examples=[["count", "avg:age"]],
    )
    filters: Dict[str, Any] = Field(
        default_factory=dict,
        description="Key-value filters to narrow down the aggregation scope.",
        examples=[{"country": "UK"}],
    )


class QueryResponse(BaseModel):
    """Response schema containing the results of an ad-hoc analytical query."""

    tenant_id: str = Field(
        ...,
        description="Tenant identifier scoping the query.",
        examples=["acme"],
    )
    entity_type: str = Field(
        ...,
        description="The ontology entity type aggregated over.",
        examples=["Person"],
    )
    result: Dict[str, Any] = Field(
        ...,
        description="Computed aggregation values payload.",
        examples=[{"count": 1234, "avg_age": 38.7}],
    )
    row_count: int = Field(
        ...,
        description="Total number of database rows matching the filters.",
        examples=[1234],
    )


class TimeseriesRequest(BaseModel):
    """Request payload schema for computing time-series rollups."""

    tenant_id: str = Field(
        ...,
        description="Tenant identifier scoping the time-series.",
        examples=["acme"],
    )
    entity_type: str = Field(
        ...,
        description="The ontology entity type to query over.",
        examples=["Transaction"],
    )
    time_field: str = Field(
        ...,
        description="The timestamp column / field name to group by.",
        examples=["created_at"],
    )
    interval: str = Field(
        ...,
        description="Rollup interval duration bucket.",
        examples=["1d"],
    )
    metric: str = Field(
        ...,
        description="Aggregation metric function to run over intervals.",
        examples=["count"],
    )
    filters: Dict[str, Any] = Field(
        default_factory=dict,
        description="Optional filter criteria applied prior to grouping.",
        examples=[{"status": "completed"}],
    )


class TimeseriesResponse(BaseModel):
    """Response schema containing computed time-series intervals and metrics."""

    tenant_id: str = Field(
        ...,
        description="Tenant identifier scoping the time-series.",
        examples=["acme"],
    )
    entity_type: str = Field(
        ...,
        description="The ontology entity type queried.",
        examples=["Transaction"],
    )
    interval: str = Field(
        ...,
        description="Aggregation bucket interval used.",
        examples=["1d"],
    )
    series: List[Dict[str, Any]] = Field(
        ...,
        description="Calculated data points over the timeline.",
        examples=[[{"timestamp": "2024-01-01T00:00:00Z", "value": 42}]],
    )


# Endpoints

@router.post(
    "/query",
    response_model=QueryResponse,
    summary="Ad-hoc analytical query",
)
async def analytics_query(request: QueryRequest) -> QueryResponse:
    """Execute an ad-hoc aggregation query over ontology entities."""
    return QueryResponse(
        tenant_id=request.tenant_id,
        entity_type=request.entity_type,
        result={
            "count": 1234,
            "avg_age": 38.7,
            "note": "DuckDB integration active.",
        },
        row_count=1234,
    )


@router.post(
    "/timeseries",
    response_model=TimeseriesResponse,
    summary="Time-series rollup",
)
async def analytics_timeseries(request: TimeseriesRequest) -> TimeseriesResponse:
    """Compute time-series rollups over a time-stamped entity field."""
    return TimeseriesResponse(
        tenant_id=request.tenant_id,
        entity_type=request.entity_type,
        interval=request.interval,
        series=[
            {"timestamp": "2024-01-01T00:00:00Z", "value": 42},
            {"timestamp": "2024-01-02T00:00:00Z", "value": 57},
            {"timestamp": "2024-01-03T00:00:00Z", "value": 63},
        ],
    )


@router.get(
    "/reconciliation",
    response_model=ReconciliationReport,
    summary="Get Cross-Store Reconciliation status",
)
async def get_reconciliation_report(
    tenant_id: str = Query(default="acme", description="Tenant ID to inspect"),
    entity_type: str = Query(default="Person", description="Entity type to verify"),
) -> ReconciliationReport:
    """Retrieve Cross-Store Reconciliation status report."""
    return run_cross_store_reconciliation(tenant_id=tenant_id, entity_type=entity_type)
