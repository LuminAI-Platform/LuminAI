"""Tests for the analytics API endpoints (query + timeseries)."""

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

    def test_query_empty_aggregations_defaults(self):
        """Empty aggregations list is accepted (defaults to empty)."""
        response = client.post(
            "/analytics/query",
            json={
                "tenant_id": "acme",
                "entity_type": "Person",
            },
        )
        assert response.status_code == 200

    def test_query_empty_filters_defaults(self):
        """Omitted filters defaults to empty dict."""
        response = client.post(
            "/analytics/query",
            json={
                "tenant_id": "acme",
                "entity_type": "Person",
                "aggregations": ["count"],
            },
        )
        assert response.status_code == 200


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

    def test_timeseries_series_format(self):
        """Each series data point has timestamp and value keys."""
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
        data = response.json()
        for point in data["series"]:
            assert "timestamp" in point
            assert "value" in point

    def test_timeseries_with_filters(self):
        """Time-series accepts optional filter criteria."""
        response = client.post(
            "/analytics/timeseries",
            json={
                "tenant_id": "acme",
                "entity_type": "Transaction",
                "time_field": "created_at",
                "interval": "1h",
                "metric": "sum",
                "filters": {"status": "completed"},
            },
        )
        assert response.status_code == 200

    def test_timeseries_missing_required_fields_returns_422(self):
        """Missing required fields returns 422."""
        response = client.post(
            "/analytics/timeseries",
            json={"tenant_id": "acme"},
        )
        assert response.status_code == 422

    def test_timeseries_missing_interval_returns_422(self):
        """Missing interval field returns 422."""
        response = client.post(
            "/analytics/timeseries",
            json={
                "tenant_id": "acme",
                "entity_type": "Transaction",
                "time_field": "created_at",
                "metric": "count",
            },
        )
        assert response.status_code == 422

    def test_timeseries_missing_metric_returns_422(self):
        """Missing metric field returns 422."""
        response = client.post(
            "/analytics/timeseries",
            json={
                "tenant_id": "acme",
                "entity_type": "Transaction",
                "time_field": "created_at",
                "interval": "1d",
            },
        )
        assert response.status_code == 422
