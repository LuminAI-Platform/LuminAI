"""Analytics endpoints for ad-hoc aggregation, time-series rollups, and cross-store reconciliation reports.

POST /analytics/query           →  Execute an ad-hoc analytical query.
POST /analytics/timeseries      →  Compute time-series rollups.
GET  /analytics/reconciliation  →  Retrieve Cross-Store Reconciliation health report.
"""

import asyncio
import io
import re
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import get_settings
from app.security import AuthIdentity, get_current_identity, resolve_effective_tenant
from app.processing.ai_insights import (
    InsightsRequest,
    InsightsResponse,
    get_ai_insights_service,
)
from app.processing.analytics_engine import DuckDBAnalyticsEngine
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
    table: str = Field(
        default="golden_records",
        description="Target database table to aggregate ('golden_records' or 'staging_records').",
        examples=["golden_records"],
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
    table: str = Field(
        default="golden_records",
        description="Target database table to rollup ('golden_records' or 'staging_records').",
        examples=["golden_records"],
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
async def analytics_query(
    request: QueryRequest,
    identity: AuthIdentity = Depends(get_current_identity),
) -> QueryResponse:
    """Execute an ad-hoc aggregation query over ontology entities using DuckDB.

    Enforces request-level timeout (default 30s) to prevent runaway OLAP queries.
    """
    effective_tenant = resolve_effective_tenant(identity, request.tenant_id) or request.tenant_id
    settings = get_settings()
    engine = DuckDBAnalyticsEngine()
    try:
        result, row_count = await asyncio.wait_for(
            asyncio.to_thread(
                engine.execute_query,
                tenant_id=effective_tenant,
                entity_type=request.entity_type,
                aggregations=request.aggregations,
                filters=request.filters,
                table_name=request.table,
            ),
            timeout=settings.analytics_query_timeout_seconds,
        )
        return QueryResponse(
            tenant_id=effective_tenant,
            entity_type=request.entity_type,
            result=result,
            row_count=row_count,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail=f"Analytics query timed out after {settings.analytics_query_timeout_seconds}s limit",
        )
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))


@router.post(
    "/timeseries",
    response_model=TimeseriesResponse,
    summary="Time-series rollup",
)
async def analytics_timeseries(
    request: TimeseriesRequest,
    identity: AuthIdentity = Depends(get_current_identity),
) -> TimeseriesResponse:
    """Compute time-series rollups over a time-stamped entity field using DuckDB.

    Enforces request-level timeout (default 30s) to prevent runaway OLAP queries.
    """
    effective_tenant = resolve_effective_tenant(identity, request.tenant_id) or request.tenant_id
    settings = get_settings()
    engine = DuckDBAnalyticsEngine()
    try:
        series = await asyncio.wait_for(
            asyncio.to_thread(
                engine.execute_timeseries,
                tenant_id=effective_tenant,
                entity_type=request.entity_type,
                time_field=request.time_field,
                interval=request.interval,
                metric=request.metric,
                filters=request.filters,
                table_name=request.table,
            ),
            timeout=settings.analytics_query_timeout_seconds,
        )
        return TimeseriesResponse(
            tenant_id=effective_tenant,
            entity_type=request.entity_type,
            interval=request.interval,
            series=series,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail=f"Analytics timeseries query timed out after {settings.analytics_query_timeout_seconds}s limit",
        )
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))


@router.get(
    "/reconciliation",
    response_model=ReconciliationReport,
    summary="Get Cross-Store Reconciliation status",
)
def get_reconciliation_report(
    tenant_id: Optional[str] = Query(default=None, description="Tenant ID to inspect"),
    entity_type: str = Query(default="Person", description="Entity type to verify"),
    identity: AuthIdentity = Depends(get_current_identity),
) -> ReconciliationReport:
    """Retrieve Cross-Store Reconciliation status report."""
    effective_tenant = resolve_effective_tenant(identity, tenant_id) or "acme"
    return run_cross_store_reconciliation(tenant_id=effective_tenant, entity_type=entity_type)


class ExportRequest(BaseModel):
    """Request payload schema for streaming export of analytical query results."""

    tenant_id: str = Field(
        ...,
        description="Tenant identifier scoping the export query.",
        examples=["acme"],
    )
    entity_type: str = Field(
        default="*",
        description="Ontology entity type to export (or '*' for all).",
        examples=["Person"],
    )
    table: str = Field(
        default="golden_records",
        description="Target database table ('golden_records' or 'staging_records').",
        examples=["golden_records"],
    )
    columns: Optional[List[str]] = Field(
        default=None,
        description="Optional list of column names to project.",
        examples=[["id", "name", "email"]],
    )
    filters: Dict[str, Any] = Field(
        default_factory=dict,
        description="Optional key-value filters.",
        examples=[{"country": "US"}],
    )
    format: str = Field(
        default="csv",
        description="Export format: 'csv', 'parquet', or 'json'.",
        examples=["csv"],
    )
    limit: Optional[int] = Field(
        default=10000,
        description="Maximum number of rows to export.",
        examples=[10000],
    )


@router.post(
    "/export",
    summary="Export query results as streaming CSV/Parquet file",
    responses={
        200: {
            "description": "Streamed file attachment (CSV, Parquet, or JSON)",
            "content": {
                "text/csv": {},
                "application/octet-stream": {},
                "application/json": {},
            },
        }
    },
)
def export_query_results(
    request: ExportRequest,
    identity: AuthIdentity = Depends(get_current_identity),
) -> StreamingResponse:
    """Execute analytical query and stream the clean results as a downloadable CSV/Parquet file."""
    effective_tenant = resolve_effective_tenant(identity, request.tenant_id) or request.tenant_id
    engine = DuckDBAnalyticsEngine()
    try:
        df = engine.export_data(
            tenant_id=effective_tenant,
            entity_type=request.entity_type,
            table_name=request.table,
            filters=request.filters,
            columns=request.columns,
            limit=request.limit,
        )
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))

    raw_name = (
        request.entity_type.lower()
        if request.entity_type and request.entity_type != "*"
        else request.table
    )
    clean_name = re.sub(r"[^a-zA-Z0-9._-]", "_", raw_name).strip("._-") or "export"
    fmt = request.format.lower().strip()

    if fmt == "parquet":
        buffer = io.BytesIO()
        df.write_parquet(buffer)
        buffer.seek(0)
        return StreamingResponse(
            buffer,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{clean_name}_export.parquet"',
                "X-Total-Rows": str(df.height),
            },
        )
    elif fmt == "json":
        json_str = df.write_json()
        return StreamingResponse(
            io.BytesIO(json_str.encode("utf-8")),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="{clean_name}_export.json"',
                "X-Total-Rows": str(df.height),
            },
        )
    else:
        # Default CSV format
        csv_str = df.write_csv()
        return StreamingResponse(
            io.BytesIO(csv_str.encode("utf-8")),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{clean_name}_export.csv"',
                "X-Total-Rows": str(df.height),
            },
        )


@router.post(
    "/insights",
    response_model=InsightsResponse,
    summary="Generate AI-powered statistical insights and anomaly summaries",
)
async def generate_insights(
    request: InsightsRequest,
    identity: AuthIdentity = Depends(get_current_identity),
) -> InsightsResponse:
    """Generate executive summary, operational metrics, and anomalies for an entity dataset.

    Uses cloud LLM APIs (Gemini / OpenAI) when configured, or deterministic statistical
    heuristics as instant fallback.
    """
    effective_tenant = resolve_effective_tenant(identity, request.tenant_id) or request.tenant_id
    if effective_tenant != request.tenant_id:
        request = request.model_copy(update={"tenant_id": effective_tenant})
    service = get_ai_insights_service()
    try:
        return await service.generate_insights(request)
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"AI insight generation failed: {exc}"
        )
