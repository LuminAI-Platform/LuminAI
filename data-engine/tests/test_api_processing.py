"""Tests for the processing pipeline trigger, ER trigger, reconciliation, and status endpoints."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class TestTriggerEndpoint:
    """POST /process/trigger endpoint tests."""

    def test_trigger_returns_202(self):
        """Triggering a pipeline returns 202 Accepted with a run_id."""
        response = client.post(
            "/process/trigger",
            json={
                "source_id": "connector-abc123",
                "tenant_id": "acme",
            },
        )
        assert response.status_code == 202
        data = response.json()
        assert "run_id" in data
        assert data["status"] == "queued"
        assert "acme" in data["message"]

    def test_trigger_with_options(self):
        """Trigger accepts optional pipeline configuration overrides."""
        response = client.post(
            "/process/trigger",
            json={
                "source_id": "src-001",
                "tenant_id": "tenant-x",
                "options": {"max_rows": 1000},
            },
        )
        assert response.status_code == 202
        data = response.json()
        assert data["status"] == "queued"

    def test_trigger_returns_unique_run_ids(self):
        """Each trigger call returns a distinct run_id."""
        ids = set()
        for _ in range(5):
            response = client.post(
                "/process/trigger",
                json={"source_id": "src-001", "tenant_id": "acme"},
            )
            ids.add(response.json()["run_id"])
        assert len(ids) == 5, "Expected 5 unique run IDs"

    def test_trigger_missing_source_id_returns_422(self):
        """Missing required field source_id returns 422 Unprocessable Entity."""
        response = client.post(
            "/process/trigger",
            json={"tenant_id": "acme"},
        )
        assert response.status_code == 422

    def test_trigger_missing_tenant_id_returns_422(self):
        """Missing required field tenant_id returns 422 Unprocessable Entity."""
        response = client.post(
            "/process/trigger",
            json={"source_id": "src-001"},
        )
        assert response.status_code == 422


class TestErTriggerEndpoint:
    """POST /process/er/trigger endpoint tests."""

    def test_er_trigger_returns_202(self):
        """Triggering an Entity Resolution pipeline returns 202 Accepted."""
        response = client.post(
            "/process/er/trigger",
            json={"tenant_id": "acme", "source_id": "crm-system"},
        )
        assert response.status_code == 202
        data = response.json()
        assert "run_id" in data
        assert data["status"] == "queued"
        assert "acme" in data["message"]

    def test_er_trigger_defaults(self):
        """ER trigger uses default tenant and source if omitted."""
        response = client.post("/process/er/trigger", json={})
        assert response.status_code == 202
        data = response.json()
        assert "run_id" in data


class TestReconciliationEndpoint:
    """POST /process/reconciliation endpoint tests."""

    def test_reconciliation_healthy_report(self):
        """Reconciliation execution returns structured report."""
        records = [
            {"golden_id": "gr-1", "name": "Alice Smith", "email": "alice@example.com"},
        ]
        response = client.post(
            "/process/reconciliation",
            json={
                "tenant_id": "acme",
                "entity_type": "Person",
                "pg_records": records,
                "neo4j_records": records,
                "opensearch_records": records,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "HEALTHY"
        assert data["pg_count"] == 1
        assert data["neo4j_count"] == 1
        assert data["opensearch_count"] == 1
        assert data["checksum_match"] is True


class TestStatusEndpoint:
    """GET /process/status/{run_id} endpoint tests."""

    def test_status_returns_200(self):
        """Polling a run_id returns 200 with status details."""
        response = client.get("/process/status/test-run-id-123")
        assert response.status_code == 200
        data = response.json()
        assert data["run_id"] == "test-run-id-123"
        assert data["status"] in ("queued", "running", "completed", "failed")
        assert 0 <= data["progress_pct"] <= 100
        assert "message" in data
