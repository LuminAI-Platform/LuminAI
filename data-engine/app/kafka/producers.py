"""
app/kafka/producers.py
----------------------
Kafka producer stubs for the LuminAI Data Engine.

Sprint 0: Logging-only stubs — no live Kafka connection required.
Sprint 1: Wire to confluent-kafka Producer with JSON serialization.

Topics produced:
  - ``ingest.valid``  — Published after the pipeline validates + cleans raw data.
                        Consumed by the Entity Resolution stage.
"""

import logging

from app.config import get_settings

logger = logging.getLogger(__name__)


class IngestValidProducer:
    """
    Publishes validated ingestion events to the ``ingest.valid`` Kafka topic.

    Message key format  : ``{tenant}:{entity_type}``
    Message value format: JSON payload with cleaned record batches and metadata.

    Sprint 0: Stub — logs that it *would* publish messages.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self.topic = settings.kafka_topic_ingest_valid
        self.bootstrap_servers = settings.kafka_bootstrap_servers
        logger.info(
            "IngestValidProducer initialised (stub). "
            "Would publish to topic='%s' on brokers='%s'",
            self.topic,
            self.bootstrap_servers,
        )

    def publish(self, tenant_id: str, entity_type: str, payload: dict) -> None:
        """
        Publish a validated batch event to ``ingest.valid``.

        Args:
            tenant_id:   Tenant context scoping the event.
            entity_type: Ontology entity type (e.g. ``"Person"``).
            payload:     Cleaned record batch with schema and row data.
        """
        key = f"{tenant_id}:{entity_type}"
        logger.info(
            "[STUB] Publishing to ingest.valid — key=%s payload_keys=%s",
            key,
            list(payload.keys()),
        )
        # Sprint 1: produce to Kafka with proper serialization + error handling.
