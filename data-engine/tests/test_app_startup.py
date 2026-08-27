"""Tests for FastAPI application startup, middleware, and router registration."""

from fastapi.testclient import TestClient

from app.main import app, create_app


client = TestClient(app)


class TestAppCreation:
    """Tests for the FastAPI app factory function."""

    def test_create_app_returns_fastapi_instance(self):
        """create_app() returns a valid FastAPI instance."""
        from fastapi import FastAPI

        test_app = create_app()
        assert isinstance(test_app, FastAPI)

    def test_app_title(self):
        """Application title matches configured app name."""
        assert app.title == "LuminAI Data Engine"

    def test_app_version(self):
        """Application version matches configured version."""
        assert app.version == "0.1.0"

    def test_app_description(self):
        """Application has a non-empty description."""
        assert app.description is not None
        assert len(app.description) > 0


class TestRouterRegistration:
    """Tests that all expected API routers are mounted."""

    def test_health_route_exists(self):
        """Health endpoint is registered and reachable."""
        response = client.get("/health")
        assert response.status_code == 200

    def test_processing_trigger_route_exists(self):
        """Processing trigger endpoint is registered at /process/trigger."""
        response = client.post(
            "/process/trigger",
            json={"source_id": "test", "tenant_id": "test"},
        )
        assert response.status_code == 202

    def test_processing_er_trigger_route_exists(self):
        """ER trigger endpoint is registered at /process/er/trigger."""
        response = client.post(
            "/process/er/trigger",
            json={"source_id": "test", "tenant_id": "test"},
        )
        assert response.status_code == 202

    def test_processing_status_route_exists(self):
        """Processing status endpoint is registered at /process/status/{run_id}."""
        response = client.get("/process/status/test-id")
        assert response.status_code == 200

    def test_analytics_query_route_exists(self):
        """Analytics query endpoint is registered at /analytics/query."""
        response = client.post(
            "/analytics/query",
            json={"tenant_id": "test", "entity_type": "Person"},
        )
        assert response.status_code == 200

    def test_analytics_timeseries_route_exists(self):
        """Analytics timeseries endpoint is registered at /analytics/timeseries."""
        response = client.post(
            "/analytics/timeseries",
            json={
                "tenant_id": "test",
                "entity_type": "Transaction",
                "time_field": "created_at",
                "interval": "1d",
                "metric": "count",
            },
        )
        assert response.status_code == 200

    def test_reconciliation_route_exists(self):
        """Reconciliation endpoint is registered at /process/reconciliation."""
        response = client.post(
            "/process/reconciliation",
            json={"tenant_id": "test", "entity_type": "Person"},
        )
        assert response.status_code == 200


class TestSwaggerDocs:
    """Tests for auto-generated OpenAPI documentation."""

    def test_openapi_json_accessible(self):
        """OpenAPI JSON schema is accessible at /openapi.json."""
        response = client.get("/openapi.json")
        assert response.status_code == 200
        schema = response.json()
        assert "openapi" in schema
        assert "paths" in schema

    def test_swagger_ui_accessible(self):
        """Swagger UI is accessible at /docs."""
        response = client.get("/docs")
        assert response.status_code == 200

    def test_redoc_accessible(self):
        """ReDoc is accessible at /redoc."""
        response = client.get("/redoc")
        assert response.status_code == 200

    def test_openapi_paths_include_health(self):
        """OpenAPI schema includes the /health path."""
        response = client.get("/openapi.json")
        paths = response.json()["paths"]
        assert "/health" in paths

    def test_openapi_paths_include_processing(self):
        """OpenAPI schema includes processing endpoints."""
        response = client.get("/openapi.json")
        paths = response.json()["paths"]
        assert "/process/trigger" in paths
        assert "/process/er/trigger" in paths
        assert "/process/reconciliation" in paths
        assert "/process/status/{run_id}" in paths

    def test_openapi_paths_include_analytics(self):
        """OpenAPI schema includes analytics endpoints."""
        response = client.get("/openapi.json")
        paths = response.json()["paths"]
        assert "/analytics/query" in paths
        assert "/analytics/timeseries" in paths
        assert "/analytics/reconciliation" in paths


class TestCorsMiddleware:
    """Tests for CORS middleware configuration."""

    def test_cors_preflight_returns_200(self):
        """CORS preflight OPTIONS request returns 200."""
        response = client.options(
            "/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert response.status_code == 200

    def test_cors_allows_configured_origin(self):
        """CORS headers are present for configured origins."""
        response = client.get(
            "/health",
            headers={"Origin": "http://localhost:5173"},
        )
        assert response.status_code == 200
        assert "access-control-allow-origin" in response.headers


class TestNonExistentRoutes:
    """Tests for undefined route behavior."""

    def test_unknown_route_returns_404(self):
        """Requests to undefined paths return 404."""
        response = client.get("/nonexistent")
        assert response.status_code == 404

    def test_wrong_method_returns_405(self):
        """Using wrong HTTP method returns 405 Method Not Allowed."""
        response = client.delete("/health")
        assert response.status_code == 405
