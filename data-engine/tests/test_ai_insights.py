"""Tests for AI Insights, statistical profiling, and anomaly detection."""

from __future__ import annotations

import polars as pl
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.processing.ai_insights.analyzer import DatasetProfiler
from app.processing.ai_insights.generator import InsightGenerator
from app.processing.ai_insights.models import (
    InsightsRequest,
)
from app.processing.ai_insights.service import AIInsightsService


@pytest.fixture
def sample_dataset() -> pl.DataFrame:
    """Sample dataframe with normal values, missing fields, and a clear outlier."""
    return pl.DataFrame(
        {
            "id": ["rec-1", "rec-2", "rec-3", "rec-4", "rec-5", "rec-6"],
            "entity_type": [
                "Customer",
                "Customer",
                "Customer",
                "Customer",
                "Customer",
                "Customer",
            ],
            "tenant_id": ["acme", "acme", "acme", "acme", "acme", "acme"],
            "country": ["Ghana", "Ghana", "Ghana", "Ghana", "Nigeria", "Kenya"],
            "status": ["Active", "Active", "Active", "Active", "Active", "Pending"],
            "spend": [
                100.0,
                120.0,
                110.0,
                105.0,
                115.0,
                5000.0,
            ],  # 5000.0 is a massive outlier
            "phone": [
                "+233200000000",
                "+233200000001",
                None,
                None,
                None,
                None,
            ],  # Low completeness
        }
    )


def test_profiler_computes_metrics_and_anomalies(sample_dataset):
    """Profiler must compute valid completeness, numeric statistics, and detect 5000.0 outlier."""
    profiler = DatasetProfiler()
    profile = profiler.profile_dataframe(sample_dataset, entity_type="Customer")

    assert profile["row_count"] == 6
    assert profile["entity_type"] == "Customer"

    # Completeness
    assert profile["completeness"]["country"] == 100.0
    assert profile["completeness"]["phone"] == 33.3  # 2 out of 6

    # Numerical metrics & anomaly
    assert "spend" in profile["numerical_metrics"]
    spend_stats = profile["numerical_metrics"]["spend"]
    assert spend_stats["min"] == 100.0
    assert spend_stats["max"] == 5000.0

    # Anomalies should detect the 5000.0 outlier
    assert len(profile["anomalies"]) > 0
    anom = profile["anomalies"][0]
    assert anom["column"] == "spend"
    assert anom["outlier_count"] >= 1


def test_heuristic_generator_produces_structured_insights(sample_dataset):
    """Heuristic generator must produce data quality and outlier warnings."""
    profiler = DatasetProfiler()
    profile = profiler.profile_dataframe(sample_dataset, entity_type="Customer")

    generator = InsightGenerator()
    res = generator._generate_heuristic(
        profile=profile,
        tenant_id="acme",
        entity_type="Customer",
        table="golden_records",
    )

    assert res.row_count == 6
    assert res.provider == "heuristic"
    assert len(res.key_metrics) >= 3

    categories = [i.category for i in res.insights]
    # Low completeness on phone should trigger data_quality
    assert "data_quality" in categories
    # Outlier on spend should trigger anomaly
    assert "anomaly" in categories


def test_insights_service_orchestration(sample_dataset):
    """AIInsightsService should orchestrate profiling and insight generation."""
    import asyncio

    service = AIInsightsService()
    req = InsightsRequest(tenant_id="acme", entity_type="Customer")
    res = asyncio.run(service.generate_insights(req, override_df=sample_dataset))

    assert res.entity_type == "Customer"
    assert res.row_count == 6
    assert len(res.insights) > 0


def test_api_insights_endpoint(sample_dataset, monkeypatch):
    """POST /analytics/insights must return 200 with complete insight schema."""
    app = create_app()

    # Mock DB load to return our sample dataset
    from app.processing.analytics_engine import DuckDBAnalyticsEngine

    monkeypatch.setattr(
        DuckDBAnalyticsEngine,
        "load_table_dataframe",
        lambda self, table_name, tenant_id: sample_dataset,
    )

    client = TestClient(app)
    response = client.post(
        "/analytics/insights",
        json={
            "tenant_id": "acme",
            "entity_type": "Customer",
            "table": "golden_records",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["tenant_id"] == "acme"
    assert data["entity_type"] == "Customer"
    assert data["row_count"] == 6
    assert "executive_summary" in data
    assert isinstance(data["insights"], list)
    assert len(data["insights"]) > 0


def test_api_insights_empty_table(monkeypatch):
    """POST /analytics/insights on empty dataset returns 200 with zero-record summary."""
    app = create_app()

    from app.processing.analytics_engine import DuckDBAnalyticsEngine

    empty_df = pl.DataFrame({"id": [], "entity_type": [], "tenant_id": []})
    monkeypatch.setattr(
        DuckDBAnalyticsEngine,
        "load_table_dataframe",
        lambda self, table_name, tenant_id: empty_df,
    )

    client = TestClient(app)
    response = client.post(
        "/analytics/insights",
        json={
            "tenant_id": "acme",
            "entity_type": "Transaction",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["row_count"] == 0
    assert "No Transaction records found" in data["executive_summary"]
