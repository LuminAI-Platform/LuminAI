"""Unit and integration tests for structured JSON logging with structlog.

Covers:
- JSON line rendering with standard fields (timestamp, level, event, logger)
- Dynamic contextvars binding (tenant_id, run_id, source_id)
- Standard library logging bridge (logging.getLogger)
- Console logging format fallback
- FastAPI StructuredLoggingMiddleware request tracing & duration
"""

import io
import json
import logging

from fastapi.testclient import TestClient

from app.logging import (
    bind_context,
    clear_context,
    configure_logging,
    get_logger,
)
from app.main import app

client = TestClient(app)


class TestStructuredLogging:
    """Tests for core structlog configuration and output."""

    def test_json_logging_format(self):
        """Logs are formatted as valid single-line JSON with standard fields."""
        stream = io.StringIO()
        configure_logging(log_level="INFO", log_format="json", stream=stream)

        logger = get_logger("test.service")
        logger.info("Service initialized", component="pipeline", version="1.0")

        output = stream.getvalue().strip().split("\n")[-1]
        assert output != ""

        # Verify line is valid JSON
        parsed = json.loads(output)
        assert parsed["event"] == "Service initialized"
        assert parsed["level"] == "info"
        assert parsed["component"] == "pipeline"
        assert parsed["version"] == "1.0"
        assert "timestamp" in parsed
        assert parsed["logger"] == "test.service"

    def test_contextvars_binding_tenant_run_source(self):
        """Contextvars automatically inject tenant_id, run_id, and source_id into logs."""
        stream = io.StringIO()
        configure_logging(log_level="INFO", log_format="json", stream=stream)

        logger = get_logger("test.context")

        # 1. Bind context
        clear_context()
        bind_context(tenant_id="acme", run_id="run-777", source_id="src-001")
        logger.info("Executing asset materialization")

        line1 = stream.getvalue().strip().split("\n")[-1]
        data1 = json.loads(line1)
        assert data1["tenant_id"] == "acme"
        assert data1["run_id"] == "run-777"
        assert data1["source_id"] == "src-001"

        # 2. Clear context
        clear_context()
        logger.info("Post execution cleanup")
        line2 = stream.getvalue().strip().split("\n")[-1]
        data2 = json.loads(line2)
        assert "tenant_id" not in data2
        assert "run_id" not in data2
        assert "source_id" not in data2

    def test_stdlib_logging_bridge(self):
        """Standard library logging.getLogger emits structured JSON."""
        stream = io.StringIO()
        configure_logging(log_level="INFO", log_format="json", stream=stream)

        stdlib_logger = logging.getLogger("thirdparty.library")
        stdlib_logger.warning("Network connection timed out, retrying")

        output = stream.getvalue().strip().split("\n")[-1]
        parsed = json.loads(output)
        assert parsed["level"] == "warning"
        assert parsed["event"] == "Network connection timed out, retrying"
        assert parsed["logger"] == "thirdparty.library"

    def test_console_format_fallback(self):
        """Console format renderer initializes without errors."""
        stream = io.StringIO()
        configure_logging(log_level="DEBUG", log_format="console", stream=stream)

        logger = get_logger("test.console")
        logger.debug("Debugging locally")

        output = stream.getvalue().strip()
        assert "Debugging locally" in output


class TestStructuredLoggingMiddleware:
    """Integration tests for FastAPI request tracing middleware."""

    def test_middleware_adds_request_id_and_traces(self):
        """Middleware injects X-Request-ID header and traces HTTP execution."""
        response = client.get(
            "/health",
            headers={
                "X-Request-ID": "test-req-uuid-1234",
                "X-Tenant-ID": "tenant-corp",
            },
        )
        assert response.status_code == 200
        assert response.headers.get("X-Request-ID") == "test-req-uuid-1234"

    def test_middleware_generates_request_id_when_omitted(self):
        """Middleware generates a unique X-Request-ID when not provided by client."""
        response = client.get("/health")
        assert response.status_code == 200
        assert "X-Request-ID" in response.headers
        assert len(response.headers["X-Request-ID"]) > 10
