"""
app/kafka/consumers.py
----------------------
Kafka consumer stubs for the LuminAI Data Engine.

Sprint 0: Logging-only stubs — no live Kafka connection required.
Sprint 1: Wire to confluent-kafka Consumer with real message deserialization.

Topics consumed:
  - ``ingest.raw``  — Raw data events published by the Core Java Backend
                      ConnectionProducer after a user uploads / syncs a source.
"""

import logging

from app.config import get_settings

logger = logging.getLogger(__name__)


class IngestRawConsumer:
    """
    Consumes raw ingestion events from the ``ingest.raw`` Kafka topic.

    Message key format  : ``{tenant}:{source_id}``
    Message value format: JSON payload describing the raw data location
                          (e.g. MinIO path, connector ID, row count).

    Sprint 0: Stub — logs that it *would* consume messages.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self.topic = settings.kafka_topic_ingest_raw
        self.bootstrap_servers = settings.kafka_bootstrap_servers
        self.group_id = settings.kafka_group_id
        logger.info(
            "IngestRawConsumer initialised (stub). "
            "Would subscribe to topic='%s' on brokers='%s'",
            self.topic,
            self.bootstrap_servers,
        )

    def handle(self, key: str, value: dict) -> None:
        """
        Process a single ingest.raw message.

        Args:
            key:   Kafka message key (``{tenant}:{source_id}``).
            value: Deserialized JSON payload from the Core Backend.
        """
        logger.info(
            "[STUB] Received ingest.raw message — key=%s payload=%s", key, value
        )
        # Sprint 1: trigger Dagster pipeline run for the given source.

    def start(self) -> None:
        """Start the consumer poll loop (stub)."""
        logger.info(
            "[STUB] IngestRawConsumer.start() called — "
            "would begin polling topic '%s'.",
            self.topic,
        )
