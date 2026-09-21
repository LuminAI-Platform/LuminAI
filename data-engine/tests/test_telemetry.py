"""Unit and integration tests for Observability (Prometheus Metrics & OpenTelemetry Tracing)."""


from fastapi.testclient import TestClient
import pytest

from app.config import Settings, get_settings
from app.main import app
from app.telemetry import (
    get_in_memory_exporter,
    init_telemetry,
    luminai_er_match_rate,
    luminai_records_processed_total,
    record_er_metrics,
    record_pipeline_duration,
    record_records_processed,
    shutdown_telemetry,
    trace_span,
)


@pytest.fixture(autouse=True)
def setup_teardown_telemetry():
    """Initialise in-memory telemetry before each test and shutdown afterwards."""
    init_telemetry(force_in_memory=True)
    exporter = get_in_memory_exporter()
    if exporter:
        exporter.clear()
    yield
    shutdown_telemetry()


class TestPrometheusMetricsEndpoint:
    """Tests for the Prometheus /metrics endpoint."""

    def test_metrics_endpoint_returns_200_and_prometheus_format(self):
        client = TestClient(app)
        response = client.get("/metrics")

        assert response.status_code == 200
        assert "text/plain" in response.headers.get("content-type", "")
        content = response.text

        # Verify key metrics are registered and exposed
        assert "luminai_records_processed_total" in content
        assert "luminai_pipeline_duration_seconds" in content
        assert "luminai_er_match_rate" in content
        assert "luminai_kafka_messages_consumed_total" in content
        assert "luminai_kafka_messages_produced_total" in content

    def test_metrics_endpoint_accessible_without_auth_when_auth_enabled(self):
        """Ensure /metrics is exempted from auth so Prometheus scrapers can scrape it."""
        client = TestClient(app)
        test_settings = Settings(auth_enabled=True)
        app.dependency_overrides[get_settings] = lambda: test_settings
        try:
            # No X-API-Key or Authorization header
            response = client.get("/metrics")
            assert response.status_code == 200
            assert "luminai_records_processed" in response.text
        finally:
            app.dependency_overrides.pop(get_settings, None)



class TestPrometheusMetricsRecording:
    """Tests for metrics recording helpers."""

    def test_record_records_processed(self):
        initial_val = luminai_records_processed_total.labels(
            tenant_id="test-tenant",
            stage="clean",
            status="success",
            entity_type="Person",
        )._value.get()

        record_records_processed("test-tenant", stage="clean", count=42, status="success", entity_type="Person")

        new_val = luminai_records_processed_total.labels(
            tenant_id="test-tenant",
            stage="clean",
            status="success",
            entity_type="Person",
        )._value.get()

        assert new_val == initial_val + 42

    def test_record_pipeline_duration(self):
        record_pipeline_duration("cleaning_pipeline", duration_seconds=1.25, status="success")
        record_pipeline_duration("er_pipeline", duration_seconds=3.50, status="success")

        client = TestClient(app)
        response = client.get("/metrics")
        assert 'luminai_pipeline_duration_seconds_count{pipeline="cleaning_pipeline",status="success"}' in response.text

    def test_record_er_metrics(self):
        record_er_metrics(
            tenant_id="acme",
            candidate_pairs_count=100,
            matches_count=30,
            review_count=10,
            non_matches_count=60,
            clusters_count=25,
            golden_records_count=25,
            entity_type="Person",
        )

        match_rate = luminai_er_match_rate.labels(tenant_id="acme")._value.get()
        # 30 / (30 + 10 + 60) = 0.3
        assert match_rate == pytest.approx(0.3)

        client = TestClient(app)
        response = client.get("/metrics")
        assert 'luminai_er_match_rate{tenant_id="acme"} 0.3' in response.text


class TestOpenTelemetryTracing:
    """Tests for OpenTelemetry distributed tracing spans."""

    def test_trace_span_creates_finished_span(self):
        exporter = get_in_memory_exporter()
        assert exporter is not None
        exporter.clear()

        with trace_span("test.operation", attributes={"tenant.id": "acme", "records": 100}):
            pass

        spans = exporter.get_finished_spans()
        assert len(spans) == 1
        span = spans[0]
        assert span.name == "test.operation"
        assert span.attributes.get("tenant.id") == "acme"
        assert span.attributes.get("records") == 100

    def test_trace_span_records_exception_and_status(self):
        exporter = get_in_memory_exporter()
        assert exporter is not None
        exporter.clear()

        with pytest.raises(ValueError, match="Test error"):
            with trace_span("failing.operation", attributes={"attempt": 1}):
                raise ValueError("Test error")

        spans = exporter.get_finished_spans()
        assert len(spans) == 1
        span = spans[0]
        assert span.name == "failing.operation"
        assert span.status.status_code.name == "ERROR"
        assert "Test error" in span.status.description

    def test_trace_spans_across_pipeline_lifecycle(self):
        """Simulate spans across Kafka consume -> clean -> stage -> ER -> publish."""
        exporter = get_in_memory_exporter()
        assert exporter is not None
        exporter.clear()

        # 1. Kafka consume
        with trace_span("kafka.consume", attributes={"messaging.destination": "ingest.raw", "tenant.id": "acme"}):
            # 2. Pipeline clean
            with trace_span("pipeline.clean", attributes={"tenant.id": "acme", "input.rows": 50}):
                pass
            # 3. Pipeline stage
            with trace_span("pipeline.stage", attributes={"tenant.id": "acme", "records.staged_count": 48}):
                pass
            # 4. ER blocking & golden records
            with trace_span("er.blocking", attributes={"tenant.id": "acme"}):
                pass
            with trace_span("er.golden_records", attributes={"tenant.id": "acme", "golden_records.count": 20}):
                pass
            # 5. Kafka produce
            with trace_span("kafka.produce", attributes={"messaging.destination": "entity.resolved", "tenant.id": "acme"}):
                pass

        spans = exporter.get_finished_spans()
        span_names = [s.name for s in spans]

        # Verify all 6 spans exist
        assert "kafka.consume" in span_names
        assert "pipeline.clean" in span_names
        assert "pipeline.stage" in span_names
        assert "er.blocking" in span_names
        assert "er.golden_records" in span_names
        assert "kafka.produce" in span_names
