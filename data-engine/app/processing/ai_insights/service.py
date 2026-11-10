"""Orchestration service for dataset profiling and AI insight generation."""

from __future__ import annotations

import logging
from typing import Optional
import polars as pl

from app.processing.ai_insights.analyzer import DatasetProfiler
from app.processing.ai_insights.generator import InsightGenerator
from app.processing.ai_insights.models import (
    InsightsRequest,
    InsightsResponse,
)
from app.processing.analytics_engine import DuckDBAnalyticsEngine

logger = logging.getLogger(__name__)


class AIInsightsService:
    """Service that orchestrates data extraction, statistical profiling, and AI insight generation."""

    def __init__(
        self,
        profiler: Optional[DatasetProfiler] = None,
        generator: Optional[InsightGenerator] = None,
        engine: Optional[DuckDBAnalyticsEngine] = None,
    ) -> None:
        self.profiler = profiler or DatasetProfiler()
        self.generator = generator or InsightGenerator()
        self.engine = engine or DuckDBAnalyticsEngine()

    async def generate_insights(
        self,
        request: InsightsRequest,
        override_df: Optional[pl.DataFrame] = None,
    ) -> InsightsResponse:
        """Generate AI-powered analytical insights for the requested tenant and entity.

        :param request: InsightsRequest with tenant_id, entity_type, table, filters.
        :param override_df: Optional DataFrame for in-memory testing.
        :return: InsightsResponse containing metrics, anomalies, and insights.
        """
        table_name = request.table
        tenant_id = request.tenant_id
        entity_type = request.entity_type

        # 1. Load data
        if override_df is not None:
            df = override_df
        else:
            df = self.engine.load_table_dataframe(table_name, tenant_id)

        # 2. Filter by entity_type if column exists
        if "entity_type" in df.columns:
            df = df.filter(pl.col("entity_type") == entity_type)

        # 3. Apply custom request filters if any
        if request.filters:
            for k, v in request.filters.items():
                if k in df.columns:
                    df = df.filter(pl.col(k) == v)

        # 4. Profile dataset
        profile = self.profiler.profile_dataframe(
            df=df,
            entity_type=entity_type,
            time_field=request.time_field,
        )

        # 5. Generate AI or heuristic insights
        return await self.generator.generate(
            profile=profile,
            tenant_id=tenant_id,
            entity_type=entity_type,
            table=table_name,
            focus_question=request.focus_question,
        )


_default_service: Optional[AIInsightsService] = None


def get_ai_insights_service() -> AIInsightsService:
    """Return singleton instance of AIInsightsService."""
    global _default_service
    if _default_service is None:
        _default_service = AIInsightsService()
    return _default_service

