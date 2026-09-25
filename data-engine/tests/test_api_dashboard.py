"""Tests for the dashboard analytics API endpoints.

Covers:
  GET /analytics/dashboard/pipeline-stats
  GET /analytics/dashboard/data-quality
  GET /analytics/dashboard/entity-stats

Each endpoint is tested with mocked data for deterministic assertions,
empty-tenant edge cases, and default tenant_id fallback behavior.
"""

import json
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

import polars as pl
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.processing.dashboard_service import DashboardAnalyticsService

client = TestClient(app)


# ─── Fixtures ──────────────────────────────────────────────────────────────


@pytest.fixture
def mock_golden_df():
    """Sample golden records Polars DataFrame with valid JSON attributes."""
    now = datetime.now(timezone.utc)
    return pl.DataFrame([
        {
            "golden_id": "gr-001",
            "tenant_id": "acme",
            "version": 1,
            "cluster_size": 2,
            "source_record_ids": json.dumps(["s1", "s2"]),
            "attributes": json.dumps({
                "entity_type": "Person",
                "name": "Alice Johnson",
                "age": 32,
            }),
            "created_at": now - timedelta(days=5),
            "updated_at": now - timedelta(days=1),
        },
        {
            "golden_id": "gr-002",
            "tenant_id": "acme",
            "version": 1,
            "cluster_size": 1,
            "source_record_ids": json.dumps(["s3"]),
            "attributes": json.dumps({
                "entity_type": "Person",
                "name": "Bob Smith",
                "age": 45,
            }),
            "created_at": now - timedelta(days=10),
            "updated_at": now - timedelta(days=2),
        },
        {
            "golden_id": "gr-003",
            "tenant_id": "acme",
            "version": 1,
            "cluster_size": 3,
            "source_record_ids": json.dumps(["s4", "s5", "s6"]),
            "attributes": json.dumps({
                "entity_type": "Organization",
                "name": "Acme Corp",
                "industry": "Technology",
            }),
            "created_at": now - timedelta(days=3),
            "updated_at": now - timedelta(hours=12),
        },
    ])


@pytest.fixture
def mock_stale_golden_df():
    """Golden records with timestamps older than 30 days for timeliness testing."""
    old_date = datetime(2024, 1, 1, tzinfo=timezone.utc)
    return pl.DataFrame([
        {
            "golden_id": "gr-old-1",
            "tenant_id": "acme",
            "version": 1,
            "cluster_size": 1,
            "source_record_ids": json.dumps(["old-s1"]),
            "attributes": json.dumps({"entity_type": "Person", "name": "Old Record"}),
            "created_at": old_date,
            "updated_at": old_date,
        },
    ])


@pytest.fixture
def mock_pipeline_rows():
    """Sample SQLite pipeline_runs rows as sqlite3.Row-like dicts."""
    now = datetime.now(timezone.utc)
    return [
        {
            "run_id": "run-001",
            "pipeline_name": "cleaning_pipeline",
            "tenant_id": "acme",
            "source_id": "csv-upload-1",
            "status": "completed",
            "progress_pct": 100,
            "current_step": "final",
            "steps_completed": json.dumps(["step1", "step2", "step3"]),
            "total_steps": 3,
            "message": "Completed",
            "error": None,
            "started_at": (now - timedelta(minutes=5)).isoformat(),
            "completed_at": (now - timedelta(minutes=2)).isoformat(),
            "dagster_run_id": None,
            "logs": json.dumps([]),
        },
        {
            "run_id": "run-002",
            "pipeline_name": "er_pipeline",
            "tenant_id": "acme",
            "source_id": "db-connector-1",
            "status": "completed",
            "progress_pct": 100,
            "current_step": "golden_records",
            "steps_completed": json.dumps(["blocking", "comparison", "classification"]),
            "total_steps": 5,
            "message": "Completed",
            "error": None,
            "started_at": (now - timedelta(minutes=10)).isoformat(),
            "completed_at": (now - timedelta(minutes=4)).isoformat(),
            "dagster_run_id": None,
            "logs": json.dumps([]),
        },
        {
            "run_id": "run-003",
            "pipeline_name": "cleaning_pipeline",
            "tenant_id": "acme",
            "source_id": "csv-upload-2",
            "status": "failed",
            "progress_pct": 40,
            "current_step": "step2",
            "steps_completed": json.dumps(["step1"]),
            "total_steps": 5,
            "message": "Failed at step2",
            "error": "Column 'email' has 95% nulls",
            "started_at": (now - timedelta(minutes=15)).isoformat(),
            "completed_at": (now - timedelta(minutes=14)).isoformat(),
            "dagster_run_id": None,
            "logs": json.dumps([]),
        },
    ]


# ─── Pipeline Stats Tests ─────────────────────────────────────────────────


class TestPipelineStatsEndpoint:
    """GET /analytics/dashboard/pipeline-stats endpoint tests."""

    def test_returns_200_with_defaults(self):
        """Endpoint returns 200 with valid response shape using default tenant."""
        response = client.get("/analytics/dashboard/pipeline-stats")
        assert response.status_code == 200
        data = response.json()
        assert "totalRuns" in data
        assert "successRate" in data
        assert "avgDuration" in data
        assert "recordsProcessed" in data
        assert "lastRunAt" in data

    def test_returns_200_with_explicit_tenant(self):
        """Endpoint accepts explicit tenant_id query parameter."""
        response = client.get("/analytics/dashboard/pipeline-stats?tenant_id=test-tenant")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["totalRuns"], int)
        assert isinstance(data["successRate"], (int, float))
        assert isinstance(data["avgDuration"], (int, float))
        assert isinstance(data["recordsProcessed"], int)

    def test_pipeline_stats_with_mocked_data(self, mock_pipeline_rows):
        """Pipeline stats return correct calculated values from mocked run data."""
        with patch.object(
            DashboardAnalyticsService, "_query_sqlite_scalar"
        ) as mock_scalar, patch.object(
            DashboardAnalyticsService, "_query_sqlite_runs"
        ) as mock_runs, patch.object(
            DashboardAnalyticsService, "_count_processed_records", return_value=500
        ):
            # Mock total runs = 3, completed = 2
            def scalar_side_effect(sql, params):
                if "COUNT(*)" in sql and "status" not in sql:
                    return 3
                elif "status = ?" in sql:
                    return 2
                elif "MAX(" in sql:
                    return "2026-09-24T18:00:00+00:00"
                return None

            mock_scalar.side_effect = scalar_side_effect

            # Mock completed runs for avg duration calculation
            now = datetime.now(timezone.utc)
            mock_runs.return_value = [
                {
                    "started_at": (now - timedelta(minutes=5)).isoformat(),
                    "completed_at": (now - timedelta(minutes=2)).isoformat(),
                },
                {
                    "started_at": (now - timedelta(minutes=10)).isoformat(),
                    "completed_at": (now - timedelta(minutes=4)).isoformat(),
                },
            ]

            response = client.get("/analytics/dashboard/pipeline-stats?tenant_id=acme")
            assert response.status_code == 200
            data = response.json()

            assert data["totalRuns"] == 3
            assert data["successRate"] == pytest.approx(66.7, abs=0.1)
            assert data["avgDuration"] > 0  # Should be ~270 seconds
            assert data["recordsProcessed"] == 500
            assert data["lastRunAt"] is not None

    def test_pipeline_stats_no_runs(self):
        """Returns zero values when no pipeline runs exist for tenant."""
        with patch.object(
            DashboardAnalyticsService, "_query_sqlite_scalar", return_value=None
        ), patch.object(
            DashboardAnalyticsService, "_query_sqlite_runs", return_value=[]
        ), patch.object(
            DashboardAnalyticsService, "_count_processed_records", return_value=0
        ):
            response = client.get(
                "/analytics/dashboard/pipeline-stats?tenant_id=nonexistent"
            )
            assert response.status_code == 200
            data = response.json()
            assert data["totalRuns"] == 0
            assert data["successRate"] == 0.0
            assert data["avgDuration"] == 0.0
            assert data["recordsProcessed"] == 0
            assert data["lastRunAt"] is None

    def test_success_rate_bounded(self):
        """Success rate never exceeds 100%."""
        with patch.object(
            DashboardAnalyticsService, "_query_sqlite_scalar"
        ) as mock_scalar, patch.object(
            DashboardAnalyticsService, "_query_sqlite_runs", return_value=[]
        ), patch.object(
            DashboardAnalyticsService, "_count_processed_records", return_value=0
        ):
            def scalar_side_effect(sql, params):
                if "COUNT(*)" in sql and "status" not in sql:
                    return 5
                elif "status = ?" in sql:
                    return 5
                return None

            mock_scalar.side_effect = scalar_side_effect
            response = client.get("/analytics/dashboard/pipeline-stats?tenant_id=acme")
            data = response.json()
            assert data["successRate"] == 100.0


# ─── Data Quality Tests ────────────────────────────────────────────────────


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

            # All 3 records have valid non-empty attributes
            assert data["completeness"] == 100.0

            # All 3 golden_ids are unique
            assert data["uniqueness"] == 100.0

            # All 3 have valid parseable JSON attributes
            assert data["consistency"] == 100.0

            # All 3 are within 30 days (fixture uses recent dates)
            assert data["timeliness"] == 100.0

            # Overall: 100 * 0.30 + 100 * 0.30 + 100 * 0.20 + 100 * 0.20 = 100.0
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

            # Completeness/uniqueness/consistency should still be 100%
            assert data["completeness"] == 100.0
            assert data["uniqueness"] == 100.0
            assert data["consistency"] == 100.0

            # Timeliness should be 0% — record is from Jan 2024
            assert data["timeliness"] == 0.0

            # Overall affected by timeliness: 100*0.3 + 100*0.3 + 100*0.2 + 0*0.2 = 80.0
            assert data["overallScore"] == 80.0

    def test_data_quality_scores_bounded(self, mock_golden_df):
        """All scores must be between 0 and 100."""
        with patch.object(
            DashboardAnalyticsService,
            "_load_golden_records_df",
            return_value=mock_golden_df,
        ):
            response = client.get("/analytics/dashboard/data-quality?tenant_id=acme")
            data = response.json()
            for key in ("overallScore", "completeness", "uniqueness", "consistency", "timeliness"):
                assert 0 <= data[key] <= 100, f"{key} out of bounds: {data[key]}"


# ─── Entity Stats Tests ───────────────────────────────────────────────────


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
        with patch.object(
            DashboardAnalyticsService, "_query_pg_scalar"
        ) as mock_scalar, patch.object(
            DashboardAnalyticsService,
            "_load_golden_records_df",
            return_value=mock_golden_df,
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

            # Type breakdown from mock data: 2 Person, 1 Organization
            breakdown = data["entityTypeBreakdown"]
            assert isinstance(breakdown, dict)
            assert breakdown.get("Person") == 2
            assert breakdown.get("Organization") == 1

    def test_entity_stats_empty_tenant(self):
        """Returns zeros when tenant has no data."""
        with patch.object(
            DashboardAnalyticsService, "_query_pg_scalar", return_value=None
        ), patch.object(
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


# ─── Response Schema Validation Tests ──────────────────────────────────────


class TestDashboardResponseSchemas:
    """Cross-cutting schema validation for all dashboard endpoints."""

    @pytest.mark.parametrize("endpoint", [
        "/analytics/dashboard/pipeline-stats",
        "/analytics/dashboard/data-quality",
        "/analytics/dashboard/entity-stats",
    ])
    def test_endpoints_return_json_content_type(self, endpoint):
        """All dashboard endpoints return application/json."""
        response = client.get(endpoint)
        assert response.status_code == 200
        assert "application/json" in response.headers.get("content-type", "")

    @pytest.mark.parametrize("endpoint", [
        "/analytics/dashboard/pipeline-stats",
        "/analytics/dashboard/data-quality",
        "/analytics/dashboard/entity-stats",
    ])
    def test_endpoints_accept_tenant_id_parameter(self, endpoint):
        """All endpoints accept the tenant_id query parameter."""
        response = client.get(f"{endpoint}?tenant_id=test-corp")
        assert response.status_code == 200
