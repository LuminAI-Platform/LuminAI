"""AI Insights and automated statistical anomaly detection module."""

from app.processing.ai_insights.analyzer import DatasetProfiler
from app.processing.ai_insights.generator import InsightGenerator
from app.processing.ai_insights.models import (
    InsightItem,
    InsightsRequest,
    InsightsResponse,
    MetricSummary,
)
from app.processing.ai_insights.service import (
    AIInsightsService,
    get_ai_insights_service,
)

__all__ = [
    "AIInsightsService",
    "DatasetProfiler",
    "InsightGenerator",
    "InsightItem",
    "InsightsRequest",
    "InsightsResponse",
    "MetricSummary",
    "get_ai_insights_service",
]

