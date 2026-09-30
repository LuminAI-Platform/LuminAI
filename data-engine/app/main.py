"""
FastAPI application entry point for the LuminAI Data Engine.

Responsibilities:
  - Configure CORS to allow requests from the Core Java Backend and React SPA.
  - Register all API routers (health, processing, analytics).
  - Start/stop the Kafka consumer in the application lifespan.
  - Expose FastAPI metadata for Swagger /docs auto-generation.
"""

import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import analytics, dashboard, health, metrics, processing
from app.config import get_settings
from app.kafka.consumers import IngestRawConsumer
from app.logging import (
    StructuredLoggingMiddleware,
    configure_logging,
    get_logger,
)
from app.processing.trigger import DagsterTrigger
from app.rate_limit import RateLimitMiddleware
from app.security import get_current_identity
from app.telemetry import init_telemetry, shutdown_telemetry

logger = get_logger("data-engine.app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup / shutdown hooks."""
    settings = get_settings()
    init_telemetry()
    logger.info(
        "Application starting up",
        app_name=settings.app_name,
        version=settings.app_version,
        host=settings.app_host,
        port=settings.app_port,
    )


    # Run database schema migration/table verification if enabled
    if settings.auto_migrate:
        try:
            from app.db import ensure_tables_exist
            ensure_tables_exist()
            logger.info("Database schema verified")
        except Exception as exc:
            logger.warning("Database migration check encountered error (DB may be offline): %s", exc)

    # Start Kafka consumer if enabled
    consumer = None
    if settings.kafka_enabled:
        is_cloud = bool(os.environ.get("RENDER") or os.environ.get("PORT") or settings.is_production)
        is_localhost = "localhost" in settings.kafka_bootstrap_servers or "127.0.0.1" in settings.kafka_bootstrap_servers
        if is_cloud and is_localhost:
            logger.warning(
                "KAFKA_ENABLED is true, but KAFKA_BOOTSTRAP_SERVERS is pointing to '%s' in a cloud/Render environment. "
                "Skipping Kafka consumer startup to avoid connection loop. Set a valid remote broker or KAFKA_ENABLED=false.",
                settings.kafka_bootstrap_servers,
            )
        else:
            # Check if broker host is resolvable before starting consumer (prevents rdkafka stderr flood)
            resolvable = True
            unresolved_err = ""
            brokers = [b.strip() for b in settings.kafka_bootstrap_servers.split(",") if b.strip()]
            for broker in brokers:
                b_clean = broker.split("://")[-1]
                host = b_clean.split(":")[0]
                port = int(b_clean.split(":")[1]) if ":" in b_clean else 9092
                try:
                    import socket
                    socket.getaddrinfo(host, port)
                    resolvable = True
                    break
                except Exception as dns_exc:
                    resolvable = False
                    unresolved_err = f"{host}: {dns_exc}"

            if not resolvable:
                logger.warning(
                    "Kafka broker DNS resolution failed (%s). "
                    "Skipping Kafka consumer background task to prevent connection spam. "
                    "Verify your Aiven/Kafka broker hostname in Render or set KAFKA_ENABLED=false.",
                    unresolved_err,
                )
            else:
                try:
                    consumer = IngestRawConsumer()
                    trigger = DagsterTrigger()
                    consumer.on_batch_complete = trigger.trigger_cleaning_pipeline
                    await consumer.start()
                    logger.info(
                        "Kafka consumer started",
                        topic=settings.kafka_topic_ingest_raw,
                        bootstrap_servers=settings.kafka_bootstrap_servers,
                    )
                except Exception as exc:
                    logger.error("Failed to start Kafka consumer: %s", exc)
    else:
        logger.info("Kafka consumer disabled (set KAFKA_ENABLED=true to enable)")

    yield

    # Clean up and shutdown resources
    if consumer is not None:
        await consumer.stop()
        logger.info("Kafka consumer stopped")

    from app.db import get_db_manager
    get_db_manager().dispose_all()
    logger.info("Database connection pools disposed")
    shutdown_telemetry()
    logger.info("OpenTelemetry TracerProvider shut down")
    logger.info("Data Engine shutting down")


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(log_level=settings.log_level, log_format=settings.log_format)

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "LuminAI Data & AI Engine — pipeline orchestration, "
            "entity resolution, analytics, and AI/ML endpoints."
        ),
        contact={
            "name": "LuminAI Engineering",
            "url": settings.app_frontend_url,
        },
        license_info={
            "name": "Proprietary",
        },
        lifespan=lifespan,
    )

    # Configure Rate Limiting middleware
    app.add_middleware(RateLimitMiddleware)

    # Configure Structured Logging middleware
    app.add_middleware(StructuredLoggingMiddleware)

    # Configure CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register API routers
    # Public endpoints (no auth required)
    app.include_router(health.router)
    app.include_router(metrics.router)


    # Protected endpoints (require API key or Keycloak JWT)
    app.include_router(
        processing.router,
        prefix="/process",
        tags=["Processing"],
        dependencies=[Depends(get_current_identity)],
    )
    app.include_router(
        analytics.router,
        prefix="/analytics",
        tags=["Analytics"],
        dependencies=[Depends(get_current_identity)],
    )
    app.include_router(
        dashboard.router,
        prefix="/analytics/dashboard",
        tags=["Dashboard Analytics"],
        dependencies=[Depends(get_current_identity)],
    )

    return app


app = create_app()

