"""Tests for the FastAPI health endpoint and application startup."""

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_returns_ok():
    """GET /health returns 200 with status 'ok'."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "service" in data
    assert "version" in data


def test_health_contains_service_name():
    """Health endpoint includes the correct service name."""
    response = client.get("/health")
    data = response.json()
    assert data["service"] == "LuminAI Data Engine"
