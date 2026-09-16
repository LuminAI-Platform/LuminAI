"""Tests for the analytics API endpoints (query, timeseries, and reconciliation)."""

import json
from datetime import datetime
from unittest.mock import patch
from fastapi.testclient import TestClient
import polars as pl
import pytest

from app.main import app
from app.processing.analytics_engine import DuckDBAnalyticsEngine

client = TestClient(app)


@pytest.fixture
def mock_golden_records():
    """Sample records for testing API endpoints with real calculated values."""
    return pl.DataFrame([
        {
            "golden_id": "gr-1",
            "tenant_id": "acme",
            "cluster_size": 2,
            "source_record_ids": json.dumps(["s1"]),
            "attributes": json.dumps({
                "entity_type": "Person",
                "name": "Alice",
                "age": 30,
                "country": "UK",
            }),
            "created_at": datetime(2024, 1, 1, 10, 0),
        },
        {
            "golden_id": "gr-2",
            "tenant_id": "acme",
            "cluster_size": 1,
            "source_record_ids": json.dumps(["s2"]),
            "attributes": json.dumps({
                "entity_type": "Person",
                "name": "Bob",
                "age": 40,
                "country": "UK",
            }),
            "created_at": datetime(2024, 1, 2, 10, 0),
        },
    ])


@pytest.fixture
def mock_transaction_records():
    """Sample transaction records for timeseries API tests."""
    return pl.DataFrame([
        {
            "id": "tx-1",
            "tenant_id": "acme",
            "source_id": "crm",
            "raw_id": "r1",
            "data": json.dumps({
                "entity_type": "Transaction",
                "amount": 100.0,
                "status": "completed",
            }),
            "staged_at": datetime(2024, 1, 1, 12, 0),
        },
        {
            "id": "tx-2",
            "tenant_id": "acme",
            "source_id": "crm",
            "raw_id": "r2",
            "data": json.dumps({
                "entity_type": "Transaction",
                "amount": 200.0,
                "status": "completed",
            }),
            "staged_at": datetime(2024, 1, 2, 12, 0),
        },
    ])


class TestAnalyticsQueryEndpoint:
    """POST /analytics/query endpoint tests."""

    def test_query_returns_200(self):
        """Ad-hoc analytical query returns 200 with aggregation results."""
        response = client.post(
            "/analytics/query",
            json={
                "tenant_id": "acme",
                "entity_type": "Person",
                "aggregations": ["count"],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["tenant_id"] == "acme"
        assert data["entity_type"] == "Person"
        assert "result" in data
        assert "row_count" in data

    def test_query_with_filters_and_aggregations(self, mock_golden_records):
        """Query with mocked records verifies actual calculated results."""
        with patch.object(DuckDBAnalyticsEngine, "load_table_dataframe", return_value=mock_golden_records):
            response = client.post(
                "/analytics/query",
                json={
                    "tenant_id": "acme",
                    "entity_type": "Person",
                    "aggregations": ["count", "avg:age"],
                    "filters": {"country": "UK"},
                },
            )
            assert response.status_code == 200
            data = response.json()
            assert data["row_count"] == 2
            assert data["result"]["count"] == 2
            assert data["result"]["avg_age"] == 35.0

    def test_query_invalid_field_raises_400(self):
        """Invalid filter field name raises 400 Bad Request."""
        response = client.post(
            "/analytics/query",
            json={
                "tenant_id": "acme",
                "entity_type": "Person",
                "aggregations": ["count"],
                "filters": {"invalid field; drop table": 1},
            },
        )
        assert response.status_code == 400
        assert "Invalid filter field name" in response.json()["detail"]

    def test_query_invalid_aggregation_raises_400(self):
        """Invalid aggregation function raises 400 Bad Request."""
        response = client.post(
            "/analytics/query",
            json={
                "tenant_id": "acme",
                "entity_type": "Person",
                "aggregations": ["unknown_op:age"],
            },
        )
        assert response.status_code == 400
        assert "Unsupported aggregation operation" in response.json()["detail"]

    def test_query_missing_tenant_id_returns_422(self):
        """Missing required tenant_id returns 422."""
        response = client.post(
            "/analytics/query",
            json={"entity_type": "Person"},
        )
        assert response.status_code == 422

    def test_query_missing_entity_type_returns_422(self):
        """Missing required entity_type returns 422."""
        response = client.post(
            "/analytics/query",
            json={"tenant_id": "acme"},
        )
        assert response.status_code == 422


class TestTimeseriesEndpoint:
    """POST /analytics/timeseries endpoint tests."""

    def test_timeseries_returns_200(self):
        """Time-series rollup returns 200 with series list."""
        response = client.post(
            "/analytics/timeseries",
            json={
                "tenant_id": "acme",
                "entity_type": "Transaction",
                "time_field": "created_at",
                "interval": "1d",
                "metric": "count",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["tenant_id"] == "acme"
        assert data["entity_type"] == "Transaction"
        assert data["interval"] == "1d"
        assert isinstance(data["series"], list)

    def test_timeseries_with_data(self, mock_transaction_records):
        """Time-series rollup returns populated series when records exist."""
        with patch.object(DuckDBAnalyticsEngine, "load_table_dataframe", return_value=mock_transaction_records):
            response = client.post(
                "/analytics/timeseries",
                json={
                    "tenant_id": "acme",
                    "entity_type": "Transaction",
                    "table": "staging_records",
                    "time_field": "staged_at",
                    "interval": "1d",
                    "metric": "sum:amount",
                },
            )
            assert response.status_code == 200
            data = response.json()
            assert len(data["series"]) == 2
            assert data["series"][0]["value"] == 100.0
            assert data["series"][1]["value"] == 200.0

    def test_timeseries_invalid_interval_raises_400(self):
        """Unsupported interval raises 400 Bad Request."""
        response = client.post(
            "/analytics/timeseries",
            json={
                "tenant_id": "acme",
                "entity_type": "Transaction",
                "time_field": "created_at",
                "interval": "invalid_bucket",
                "metric": "count",
            },
        )
        assert response.status_code == 400
        assert "Unsupported interval" in response.json()["detail"]


class TestAnalyticsReconciliationEndpoint:
    """GET /analytics/reconciliation endpoint tests."""

    def test_get_reconciliation_returns_200(self):
        response = client.get("/analytics/reconciliation?tenant_id=acme&entity_type=Person")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["tenant_id"] == "acme"
        assert data["entity_type"] == "Person"
        assert "pg_count" in data
        assert "checksums" in data
