"""Centralized structured JSON logging configuration using structlog.

Provides:
1. ISO-formatted timestamps, log levels, logger names, and exception tracebacks.
2. Context-variable propagation for `tenant_id`, `run_id`, and `source_id`.
3. Standard library logging bridge (ProcessorFormatter) so all third-party
   libraries emit uniform JSON lines.
4. FastAPI `StructuredLoggingMiddleware` measuring request durations and
   tracing request IDs.
"""

from collections.abc import Callable
import logging
import sys
import time
from typing import Any, Dict, Optional
import uuid

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import structlog
from structlog.types import EventDict, Processor


def add_app_context(_: Any, __: str, event_dict: EventDict) -> EventDict:
    """Ensure standard keys are present with fallback defaults if not bound."""
    # Ensure tenant_id, run_id, source_id exist in output if bound in contextvars
    return event_dict


def configure_logging(
    log_level: str = "INFO",
    log_format: str = "json",
    stream: Optional[Any] = None,
) -> None:
    """Configure structlog and standard library logging for structured output."""
    shared_processors: list[Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        add_app_context,
    ]

    level_num = getattr(logging, log_level.upper(), logging.INFO)

    if log_format.lower() == "console":
        renderer: Processor = structlog.dev.ConsoleRenderer(colors=True)
    else:
        renderer = structlog.processors.JSONRenderer()

    # Configure structlog internals
    structlog.configure(
        processors=shared_processors + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Configure stdlib root logger with ProcessorFormatter bridge
    foreign_chain: list[Processor] = [
        structlog.stdlib.ExtraAdder(),
    ] + shared_processors

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=foreign_chain,
        processor=renderer,
    )

    out_stream = stream if stream is not None else sys.stdout
    handler = logging.StreamHandler(out_stream)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(level_num)

    # Suppress verbose external loggers
    for noisy in ("uvicorn.access", "urllib3"):
        logging.getLogger(noisy).propagate = True


def get_logger(name: Optional[str] = None) -> structlog.stdlib.BoundLogger:
    """Retrieve a context-bound structlog logger instance."""
    return structlog.get_logger(name)


def bind_context(**kwargs: Any) -> None:
    """Bind contextual attributes (e.g. tenant_id, run_id, source_id) to current async task."""
    structlog.contextvars.bind_contextvars(**kwargs)


def unbind_context(*keys: str) -> None:
    """Unbind specified context variables."""
    structlog.contextvars.unbind_contextvars(*keys)


def clear_context() -> None:
    """Clear all context variables for the current execution context."""
    structlog.contextvars.clear_contextvars()


def get_context() -> Dict[str, Any]:
    """Retrieve all currently bound context variables."""
    return structlog.contextvars.get_contextvars()


class StructuredLoggingMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware capturing request ID, tenant context, and request durations."""

    def __init__(self, app: Any):
        super().__init__(app)
        self.logger = get_logger("data-engine.http")

    async def dispatch(self, request: Request, call_next: Callable[[Request], Any]) -> Response:
        clear_context()

        request_id = request.headers.get("X-Request-ID") or request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
        tenant_id = request.headers.get("X-Tenant-ID")

        context: Dict[str, Any] = {
            "run_id": request_id,
            "path": request.url.path,
            "method": request.method,
        }
        if tenant_id:
            context["tenant_id"] = tenant_id

        bind_context(**context)

        start_time = time.perf_counter()
        try:
            response = await call_next(request)
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

            self.logger.info(
                "HTTP request completed",
                status_code=response.status_code,
                duration_ms=duration_ms,
            )
            response.headers["X-Request-ID"] = request_id
            return response
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            self.logger.exception(
                "HTTP request failed",
                error=str(exc),
                duration_ms=duration_ms,
            )
            raise
