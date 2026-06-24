"""
app/main.py
-----------
FastAPI application entry point for the LuminAI Data Engine.

Responsibilities:
  - Configure CORS to allow requests from the Core Java Backend and React SPA.
  - Register all API routers (health, processing, analytics).
  - Start/stop the Kafka consumer in the application lifespan.
  - Expose FastAPI metadata for Swagger /docs auto-generation.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import analytics, health, processing
from app.config import get_settings
from app.kafka.consumers import IngestRawConsumer
from app.processing.trigger import DagsterTrigger


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup / shutdown hooks."""
    settings = get_settings()
    print(f"[*] {settings.app_name} v{settings.app_version} starting up...")

    # ── Kafka consumer ────────────────────────────────────────────────────
    consumer = None
    if settings.kafka_enabled:
        consumer = IngestRawConsumer()

        # S2-01: Wire pipeline trigger to batch-complete signals
        trigger = DagsterTrigger()
        consumer.on_batch_complete = trigger.trigger_cleaning_pipeline

        await consumer.start()
        print(f"[Kafka] Kafka consumer started on topic '{settings.kafka_topic_ingest_raw}'")
    else:
        print("[Kafka] Kafka disabled (set KAFKA_ENABLED=true to enable)")

    yield

    # ── Shutdown ──────────────────────────────────────────────────────────
    if consumer is not None:
        await consumer.stop()
        print("[Kafka] Kafka consumer stopped")
    print("[*] Data Engine shutting down...")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "LuminAI Data & AI Engine — pipeline orchestration, "
            "entity resolution, analytics, and AI/ML endpoints."
        ),
        contact={
            "name": "LuminAI Engineering",
            "url": "https://luminai.io",
        },
        license_info={
            "name": "Proprietary",
        },
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ───────────────────────────────────────────────────────────
    app.include_router(health.router)
    app.include_router(processing.router, prefix="/process", tags=["Processing"])
    app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])

    return app


app = create_app()
