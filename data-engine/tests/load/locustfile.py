"""Locust load test suite for LuminAI Data Engine.

Run headless with:
    uv run locust -f tests/load/locustfile.py --headless -u 10 -r 2 --run-time 30s --host http://localhost:8001
Run interactive UI with:
    uv run locust -f tests/load/locustfile.py --host http://localhost:8001
"""

import os
from locust import HttpUser, between, task


class DataEngineUser(HttpUser):
    """Simulates realistic API client traffic across Data Engine endpoints."""

    wait_time = between(0.1, 0.5)

    def on_start(self):
        """Configure authentication headers for the load test session."""
        self.api_key = os.getenv("API_KEY", "test-api-key-12345")
        self.tenant_id = os.getenv("TENANT_ID", "test-tenant")
        self.headers = {
            "X-API-Key": self.api_key,
            "X-Tenant-ID": self.tenant_id,
            "Content-Type": "application/json",
        }

    @task(6)
    def test_health_check(self):
        """Liveness / Readiness probe check (frequent monitoring polling)."""
        self.client.get("/health", headers=self.headers, name="/health")

    @task(4)
    def test_dashboard_pipeline_stats(self):
        """Dashboard pipeline run stats query."""
        self.client.get(
            "/analytics/dashboard/pipeline-stats",
            headers=self.headers,
            name="/analytics/dashboard/pipeline-stats",
        )

    @task(3)
    def test_dashboard_data_quality(self):
        """Dashboard data quality dimensions query (single-pass DuckDB)."""
        self.client.get(
            "/analytics/dashboard/data-quality",
            headers=self.headers,
            name="/analytics/dashboard/data-quality",
        )

    @task(3)
    def test_dashboard_entity_stats(self):
        """Dashboard entity resolution stats query."""
        self.client.get(
            "/analytics/dashboard/entity-stats",
            headers=self.headers,
            name="/analytics/dashboard/entity-stats",
        )

    @task(2)
    def test_analytics_query(self):
        """OLAP analytics query via DuckDB."""
        payload = {
            "tenant_id": self.tenant_id,
            "entity_type": "Person",
            "aggregations": ["count"],
        }
        self.client.post(
            "/analytics/query",
            json=payload,
            headers=self.headers,
            name="/analytics/query",
        )

    @task(1)
    def test_analytics_reconciliation(self):
        """Cross-store reconciliation report check."""
        self.client.get(
            "/analytics/reconciliation",
            headers=self.headers,
            name="/analytics/reconciliation",
        )
