"""Tests for pipeline-stats dashboard analytics API endpoints.

Covers:
  GET /analytics/dashboard/pipeline-stats
  Cross-cutting schema validations
"""

import json
from datetime import datetime, timezone, timedelta
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.processing.dashboard_service import DashboardAnalyticsService

client = TestClient(app)


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
        response = client.get(
            "/analytics/dashboard/pipeline-stats?tenant_id=test-tenant"
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["totalRuns"], int)
        assert isinstance(data["successRate"], (int, float))
        assert isinstance(data["avgDuration"], (int, float))
        assert isinstance(data["recordsProcessed"], int)

    def test_pipeline_stats_with_mocked_data(self, mock_pipeline_rows):
        """Pipeline stats return correct calculated values from mocked run data."""
        with (
            patch.object(
                DashboardAnalyticsService, "_query_sqlite_scalar"
            ) as mock_scalar,
            patch.object(DashboardAnalyticsService, "_query_sqlite_runs") as mock_runs,
            patch.object(
                DashboardAnalyticsService, "_count_processed_records", return_value=500
            ),
        ):
            def scalar_side_effect(sql, params):
                if "COUNT(*)" in sql and "status" not in sql:
                    return 3
                elif "status = ?" in sql:
                    return 2
                elif "MAX(" in sql:
                    return "2026-09-24T18:00:00+00:00"
                return None

            mock_scalar.side_effect = scalar_side_effect

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
            assert data["avgDuration"] > 0
            assert data["recordsProcessed"] == 500
            assert data["lastRunAt"] is not None

    def test_pipeline_stats_no_runs(self):
        """Returns zero values when no pipeline runs exist for tenant."""
        with (
            patch.object(
                DashboardAnalyticsService, "_query_sqlite_scalar", return_value=None
            ),
            patch.object(
                DashboardAnalyticsService, "_query_sqlite_runs", return_value=[]
            ),
            patch.object(
                DashboardAnalyticsService, "_count_processed_records", return_value=0
            ),
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
        with (
            patch.object(
                DashboardAnalyticsService, "_query_sqlite_scalar"
            ) as mock_scalar,
            patch.object(
                DashboardAnalyticsService, "_query_sqlite_runs", return_value=[]
            ),
            patch.object(
                DashboardAnalyticsService, "_count_processed_records", return_value=0
            ),
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


class TestDashboardResponseSchemas:
    """Cross-cutting schema validation for all dashboard endpoints."""

    @pytest.mark.parametrize(
        "endpoint",
        [
            "/analytics/dashboard/pipeline-stats",
            "/analytics/dashboard/data-quality",
            "/analytics/dashboard/entity-stats",
        ],
    )
    def test_endpoints_return_json_content_type(self, endpoint):
        """All dashboard endpoints return application/json."""
        response = client.get(endpoint)
        assert response.status_code == 200
        assert "application/json" in response.headers.get("content-type", "")

    @pytest.mark.parametrize(
        "endpoint",
        [
            "/analytics/dashboard/pipeline-stats",
            "/analytics/dashboard/data-quality",
            "/analytics/dashboard/entity-stats",
        ],
    )
    def test_endpoints_accept_tenant_id_parameter(self, endpoint):
        """All endpoints accept the tenant_id query parameter."""
        response = client.get(f"{endpoint}?tenant_id=test-corp")
        assert response.status_code == 200
