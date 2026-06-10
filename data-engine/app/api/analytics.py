"""
app/api/analytics.py
--------------------
Analytics endpoints for ad-hoc aggregation and time-series rollups.

POST /analytics/query       →  Execute an ad-hoc analytical query.
POST /analytics/timeseries  →  Compute time-series rollups.

Sprint 0: Stub implementations. DuckDB integration coming in Sprint 1.
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()


# ── Request / Response Models ────────────────────────────────────────────────

class QueryRequest(BaseModel):
    """Request body for an ad-hoc analytical query."""

    tenant_id: str = Field(..., example="acme")
    entity_type: str = Field(
        ...,
        description="The ontology entity type to aggregate over.",
        example="Person",
    )
    aggregations: list[str] = Field(
        default_factory=list,
        description="List of aggregation operations (e.g. count, avg, sum).",
        example=["count", "avg:age"],
    )
    filters: dict = Field(default_factory=dict, example={"country": "UK"})


class QueryResponse(BaseModel):
    """Result of an ad-hoc analytical query."""

    tenant_id: str
    entity_type: str
    result: dict
    row_count: int


class TimeseriesRequest(BaseModel):
    """Request body for a time-series rollup."""

    tenant_id: str = Field(..., example="acme")
    entity_type: str = Field(..., example="Transaction")
    time_field: str = Field(..., example="created_at")
    interval: str = Field(..., description="Rollup interval.", example="1d")
    metric: str = Field(..., example="count")
    filters: dict = Field(default_factory=dict)


class TimeseriesResponse(BaseModel):
    """Result of a time-series rollup."""

    tenant_id: str
    entity_type: str
    interval: str
    series: list[dict]


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post(
    "/query",
    response_model=QueryResponse,
    summary="Ad-hoc analytical query",
)
async def analytics_query(request: QueryRequest) -> QueryResponse:
    """
    Execute an ad-hoc aggregation query over ontology entities.

    Uses DuckDB under the hood for in-process OLAP queries.

    > **Sprint 0 stub**: Returns a mock aggregation result.
    """
    return QueryResponse(
        tenant_id=request.tenant_id,
        entity_type=request.entity_type,
        result={
            "count": 1234,
            "avg_age": 38.7,
            "_note": "Sprint 0 stub — DuckDB integration coming in Sprint 1.",
        },
        row_count=1234,
    )


@router.post(
    "/timeseries",
    response_model=TimeseriesResponse,
    summary="Time-series rollup",
)
async def analytics_timeseries(request: TimeseriesRequest) -> TimeseriesResponse:
    """
    Compute time-series rollups over a time-stamped entity field.

    > **Sprint 0 stub**: Returns mock series data.
    """
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
