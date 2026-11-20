"""Tests for data-quality and entity-stats dashboard analytics API endpoints.

Covers:
  GET /analytics/dashboard/data-quality
  GET /analytics/dashboard/entity-stats
"""

import json
from datetime import datetime, timezone, timedelta
from unittest.mock import patch

import polars as pl
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.processing.dashboard_service import DashboardAnalyticsService

client = TestClient(app)


@pytest.fixture
def mock_golden_df():
    """Sample golden records Polars DataFrame with valid JSON attributes."""
    now = datetime.now(timezone.utc)
    return pl.DataFrame(
        [
            {
                "golden_id": "gr-001",
                "tenant_id": "acme",
                "version": 1,
                "cluster_size": 2,
                "source_record_ids": json.dumps(["s1", "s2"]),
                "attributes": json.dumps(
                    {
                        "entity_type": "Person",
                        "name": "Alice Johnson",
                        "age": 32,
                    }
                ),
                "created_at": now - timedelta(days=5),
                "updated_at": now - timedelta(days=1),
            },
            {
                "golden_id": "gr-002",
                "tenant_id": "acme",
                "version": 1,
                "cluster_size": 1,
                "source_record_ids": json.dumps(["s3"]),
                "attributes": json.dumps(
                    {
                        "entity_type": "Person",
                        "name": "Bob Smith",
                        "age": 45,
                    }
                ),
                "created_at": now - timedelta(days=10),
                "updated_at": now - timedelta(days=2),
            },
            {
                "golden_id": "gr-003",
                "tenant_id": "acme",
                "version": 1,
                "cluster_size": 3,
                "source_record_ids": json.dumps(["s4", "s5", "s6"]),
                "attributes": json.dumps(
                    {
                        "entity_type": "Organization",
                        "name": "Acme Corp",
                        "industry": "Technology",
                    }
                ),
                "created_at": now - timedelta(days=3),
                "updated_at": now - timedelta(hours=12),
            },
        ]
    )


@pytest.fixture
def mock_stale_golden_df():
    """Golden records with timestamps older than 30 days for timeliness testing."""
    old_date = datetime(2024, 1, 1, tzinfo=timezone.utc)
    return pl.DataFrame(
        [
            {
                "golden_id": "gr-old-1",
                "tenant_id": "acme",
                "version": 1,
                "cluster_size": 1,
                "source_record_ids": json.dumps(["old-s1"]),
                "attributes": json.dumps(
                    {"entity_type": "Person", "name": "Old Record"}
                ),
                "created_at": old_date,
                "updated_at": old_date,
            },
        ]
    )


class TestDataQualityEndpoint:
    """GET /analytics/dashboard/data-quality endpoint tests."""

    def test_returns_200_with_defaults(self):
        """Endpoint returns 200 with valid response shape."""
        response = client.get("/analytics/dashboard/data-quality")
        assert response.status_code == 200
        data = response.json()
        assert "overallScore" in data
        assert "completeness" in data
        assert "uniqueness" in data
        assert "consistency" in data
        assert "timeliness" in data

    def test_data_quality_with_mocked_records(self, mock_golden_df):
        """Data quality returns correct scores from mocked golden records."""
        with patch.object(
            DashboardAnalyticsService,
            "_load_golden_records_df",
            return_value=mock_golden_df,
        ):
            response = client.get("/analytics/dashboard/data-quality?tenant_id=acme")
            assert response.status_code == 200
            data = response.json()

            assert data["completeness"] == 100.0
            assert data["uniqueness"] == 100.0
            assert data["consistency"] == 100.0
            assert data["timeliness"] == 100.0
            assert data["overallScore"] == 100.0

    def test_data_quality_empty_tenant(self):
        """Returns zero scores when tenant has no golden records."""
        with patch.object(
            DashboardAnalyticsService,
            "_load_golden_records_df",
            return_value=pl.DataFrame(
                schema={
                    "golden_id": pl.Utf8,
                    "tenant_id": pl.Utf8,
                    "cluster_size": pl.Int64,
                    "source_record_ids": pl.Utf8,
                    "attributes": pl.Utf8,
                    "created_at": pl.Datetime,
                }
            ),
        ):
            response = client.get(
                "/analytics/dashboard/data-quality?tenant_id=nonexistent"
            )
            assert response.status_code == 200
            data = response.json()
            assert data["overallScore"] == 0.0
            assert data["completeness"] == 0.0
            assert data["uniqueness"] == 0.0
            assert data["consistency"] == 0.0
            assert data["timeliness"] == 0.0

    def test_data_quality_stale_records(self, mock_stale_golden_df):
        """Timeliness drops when records are older than 30 days."""
        with patch.object(
            DashboardAnalyticsService,
            "_load_golden_records_df",
            return_value=mock_stale_golden_df,
        ):
            response = client.get("/analytics/dashboard/data-quality?tenant_id=acme")
            assert response.status_code == 200
            data = response.json()

            assert data["completeness"] == 100.0
            assert data["uniqueness"] == 100.0
            assert data["consistency"] == 100.0
            assert data["timeliness"] == 0.0
            # Overall: 100*0.25 + 100*0.30 + 100*0.20 + 100*0.15 + 0*0.10 = 90.0
            assert data["overallScore"] == 90.0

    def test_data_quality_scores_bounded(self, mock_golden_df):
        """All scores must be between 0 and 100."""
        with patch.object(
            DashboardAnalyticsService,
            "_load_golden_records_df",
            return_value=mock_golden_df,
        ):
            response = client.get("/analytics/dashboard/data-quality?tenant_id=acme")
            data = response.json()
            for key in (
                "overallScore",
                "completeness",
                "uniqueness",
                "consistency",
                "timeliness",
            ):
                assert 0 <= data[key] <= 100, f"{key} out of bounds: {data[key]}"


class TestEntityStatsEndpoint:
    """GET /analytics/dashboard/entity-stats endpoint tests."""

    def test_returns_200_with_defaults(self):
        """Endpoint returns 200 with valid response shape."""
        response = client.get("/analytics/dashboard/entity-stats")
        assert response.status_code == 200
        data = response.json()
        assert "totalGoldenRecords" in data
        assert "totalStagingRecords" in data
        assert "pendingERCandidates" in data
        assert "entityTypeBreakdown" in data

    def test_entity_stats_with_mocked_data(self, mock_golden_df):
        """Entity stats return correct counts and type breakdown."""
        with (
            patch.object(DashboardAnalyticsService, "_query_pg_scalar") as mock_scalar,
            patch.object(
                DashboardAnalyticsService,
                "_load_golden_records_df",
                return_value=mock_golden_df,
            ),
        ):
            def scalar_side_effect(sql, params):
                if "golden_records" in sql:
                    return 3
                elif "staging_records" in sql:
                    return 10
                elif "er_candidates" in sql:
                    return 5
                return 0

            mock_scalar.side_effect = scalar_side_effect

            response = client.get("/analytics/dashboard/entity-stats?tenant_id=acme")
            assert response.status_code == 200
            data = response.json()

            assert data["totalGoldenRecords"] == 3
            assert data["totalStagingRecords"] == 10
            assert data["pendingERCandidates"] == 5

            breakdown = data["entityTypeBreakdown"]
            assert isinstance(breakdown, dict)
            assert breakdown.get("Person") == 2
            assert breakdown.get("Organization") == 1

    def test_entity_stats_empty_tenant(self):
        """Returns zeros when tenant has no data."""
        with (
            patch.object(
                DashboardAnalyticsService, "_query_pg_scalar", return_value=None
            ),
            patch.object(
                DashboardAnalyticsService,
                "_load_golden_records_df",
                return_value=pl.DataFrame(
                    schema={
                        "golden_id": pl.Utf8,
                        "tenant_id": pl.Utf8,
                        "cluster_size": pl.Int64,
                        "source_record_ids": pl.Utf8,
                        "attributes": pl.Utf8,
                        "created_at": pl.Datetime,
                    }
                ),
            ),
        ):
            response = client.get(
                "/analytics/dashboard/entity-stats?tenant_id=nonexistent"
            )
            assert response.status_code == 200
            data = response.json()
            assert data["totalGoldenRecords"] == 0
            assert data["totalStagingRecords"] == 0
            assert data["pendingERCandidates"] == 0
            assert data["entityTypeBreakdown"] == {}

    def test_entity_type_breakdown_types(self):
        """entityTypeBreakdown values must be integers."""
        response = client.get("/analytics/dashboard/entity-stats?tenant_id=acme")
        assert response.status_code == 200
        data = response.json()
        for key, val in data["entityTypeBreakdown"].items():
            assert isinstance(key, str), f"Key must be string, got {type(key)}"
            assert isinstance(val, int), f"Value for {key} must be int, got {type(val)}"
