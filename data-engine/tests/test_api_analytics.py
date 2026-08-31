"""Tests for the analytics API endpoints (query, timeseries, and reconciliation)."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


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

    def test_query_with_filters(self):
        """Query accepts optional filter criteria."""
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
        assert isinstance(data["result"], dict)
        assert isinstance(data["row_count"], int)

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
        """Time-series rollup returns 200 with series data points."""
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
        assert len(data["series"]) > 0


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
