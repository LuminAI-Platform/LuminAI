"""Prometheus metrics endpoint for the LuminAI Data Engine.

Exposes standard `/metrics` endpoint for Prometheus / VictoriaMetrics scraping.
"""

from fastapi import APIRouter, Response
from prometheus_client import CONTENT_TYPE_LATEST, REGISTRY, generate_latest

router = APIRouter(tags=["Metrics"])


@router.get(
    "/metrics",
    summary="Prometheus Metrics",
    description="Returns Prometheus-formatted metrics for pipelines, ingestion, and entity resolution.",
    response_class=Response,
)
def get_metrics() -> Response:
    """Generate and return latest metrics snapshot."""
    return Response(content=generate_latest(REGISTRY), media_type=CONTENT_TYPE_LATEST)
