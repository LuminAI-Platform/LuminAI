"""OpenTelemetry distributed tracing configuration and helpers for LuminAI Data Engine.

Provides:
  - Standardised TracerProvider initialisation with service metadata resource.
  - Configurable exporters (OTLP, Console, InMemory for unit tests).
  - Context manager `trace_span()` for tracing pipeline stages, Kafka consume/produce, and ER operations.
"""

from __future__ import annotations

from contextlib import contextmanager
import logging
from typing import Any, Generator

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import (
    BatchSpanProcessor,
    SimpleSpanProcessor,
)
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import Span, SpanKind, Status, StatusCode

from app.config import get_settings

logger = logging.getLogger(__name__)

_in_memory_exporter: InMemorySpanExporter | None = None
_tracer_initialized: bool = False
_current_tracer_provider: TracerProvider | None = None


class _NoOpSpan:
    """Fallback no-op span when OpenTelemetry is disabled."""

    def set_attribute(self, key: str, value: Any) -> None:
        pass

    def set_attributes(self, attributes: dict[str, Any]) -> None:
        pass

    def record_exception(self, exception: BaseException) -> None:
        pass

    def set_status(self, status: Any, description: str | None = None) -> None:
        pass


def init_telemetry(force_in_memory: bool = False) -> None:
    """Initialise OpenTelemetry TracerProvider and configure exporters."""
    global _tracer_initialized, _in_memory_exporter, _current_tracer_provider
    settings = get_settings()

    if not settings.otel_enabled and not force_in_memory:
        logger.info("OpenTelemetry tracing is disabled (set OTEL_ENABLED=true to enable)")
        return

    resource = Resource.create(
        {
            "service.name": settings.otel_service_name,
            "service.version": settings.app_version,
            "deployment.environment": "development" if settings.debug else "production",
        }
    )

    provider = TracerProvider(resource=resource)

    if force_in_memory:
        _in_memory_exporter = InMemorySpanExporter()
        provider.add_span_processor(SimpleSpanProcessor(_in_memory_exporter))
        logger.info("OpenTelemetry configured with InMemorySpanExporter for testing")
    elif settings.otel_exporter_otlp_endpoint:
        try:
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
            otlp_exporter = OTLPSpanExporter(endpoint=settings.otel_exporter_otlp_endpoint)
            provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
            logger.info("OpenTelemetry OTLP exporter configured for %s", settings.otel_exporter_otlp_endpoint)
        except ImportError:
            logger.warning("OTLPSpanExporter dependencies not installed. Falling back to default.")

    _current_tracer_provider = provider
    try:
        if hasattr(trace, "_TRACER_PROVIDER_SET_ONCE"):
            trace._TRACER_PROVIDER_SET_ONCE._done = False
        trace.set_tracer_provider(provider)
    except Exception:
        pass

    _tracer_initialized = True
    logger.info("OpenTelemetry TracerProvider initialised successfully")


def shutdown_telemetry() -> None:
    """Shutdown current TracerProvider."""
    global _tracer_initialized, _in_memory_exporter, _current_tracer_provider
    if _current_tracer_provider is not None:
        _current_tracer_provider.shutdown()
        _current_tracer_provider = None
    elif isinstance(trace.get_tracer_provider(), TracerProvider):
        trace.get_tracer_provider().shutdown()
    _tracer_initialized = False
    _in_memory_exporter = None


def get_in_memory_exporter() -> InMemorySpanExporter | None:
    """Get reference to in-memory span exporter if active during tests."""
    return _in_memory_exporter


def get_tracer(name: str = "data-engine") -> trace.Tracer:
    """Obtain a tracer instance."""
    if _current_tracer_provider is not None:
        return _current_tracer_provider.get_tracer(name)
    return trace.get_tracer(name)



@contextmanager
def trace_span(
    name: str,
    attributes: dict[str, Any] | None = None,
    kind: SpanKind = SpanKind.INTERNAL,
) -> Generator[Span | _NoOpSpan, None, None]:
    """
    Context manager for creating an OpenTelemetry trace span.
    
    Records exceptions and updates span status automatically.
    Falls back gracefully to a no-op span if tracing is disabled.
    """
    settings = get_settings()
    if not settings.otel_enabled and _in_memory_exporter is None:
        noop = _NoOpSpan()
        yield noop
        return

    tracer = get_tracer("data-engine")
    with tracer.start_as_current_span(name, kind=kind) as span:
        if attributes:
            for k, v in attributes.items():
                if v is not None:
                    span.set_attribute(k, str(v) if not isinstance(v, (bool, int, float, str)) else v)
        try:
            yield span
        except Exception as exc:
            span.record_exception(exc)
            span.set_status(Status(StatusCode.ERROR, str(exc)))
            raise
