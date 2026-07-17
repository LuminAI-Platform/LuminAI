"""Kafka consumer for the LuminAI Data Engine.

Listens to the ``ingest.raw`` Kafka topic for raw data events published
by the Core Java Backend ConnectionProducer after a user uploads or syncs
a data source.

Sprint 1: Real confluent-kafka Consumer with JSON deserialization,
          graceful shutdown, error handling, and batch-complete callbacks.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Callable
from typing import Any

from confluent_kafka import Consumer, KafkaError, KafkaException

from app.config import get_settings

logger = logging.getLogger(__name__)


class IngestRawConsumer:
    """
    Consumes raw ingestion events from the ``ingest.raw`` Kafka topic.

    Message key format  : ``{tenant_id}:{source_id}``
    Message value format: JSON envelope containing ingestion metadata,
                          column payloads, and batch control signals.

    Lifecycle:
        1. Call :meth:`start` to begin polling in a background asyncio task.
        2. Messages are dispatched to :meth:`handle` for processing.
        3. When a message contains ``"batch_complete": true``, the
           :attr:`on_batch_complete` callback is invoked (used by S2-01
           Pipeline Trigger Integration).
        4. Call :meth:`stop` to gracefully shut down the consumer.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self.topic = settings.kafka_topic_ingest_raw
        self.bootstrap_servers = settings.kafka_bootstrap_servers
        self.group_id = settings.kafka_group_id
        self._running = False
        self._consumer: Consumer | None = None

        # Callback hook for pipeline trigger integration (S2-01)
        self.on_batch_complete: Callable[[str, str, dict[str, Any]], None] | None = None

        logger.info(
            "IngestRawConsumer initialised — topic='%s', brokers='%s', group='%s'",
            self.topic,
            self.bootstrap_servers,
            self.group_id,
        )

    def _create_consumer(self) -> Consumer:
        """Create and configure the confluent-kafka Consumer instance."""
        conf = {
            "bootstrap.servers": self.bootstrap_servers,
            "group.id": self.group_id,
            "auto.offset.reset": "earliest",
            "enable.auto.commit": True,
            "auto.commit.interval.ms": 5000,
            "session.timeout.ms": 30000,
            "max.poll.interval.ms": 300000,
        }
        return Consumer(conf)

    def handle(self, key: str | None, value: dict[str, Any]) -> None:
        """
        Process a single ``ingest.raw`` message.

        Args:
            key:   Kafka message key (``{tenant_id}:{source_id}``).
            value: Deserialized JSON payload from the Core Backend.
        """
        tenant_id = value.get("tenant_id", "unknown")
        source_id = value.get("source_id", "unknown")
        row_count = value.get("row_count", 0)

        logger.info(
            "Received ingest.raw — tenant=%s, source=%s, rows=%d",
            tenant_id,
            source_id,
            row_count,
        )

        # Check for batch-complete signal
        if value.get("batch_complete", False):
            logger.info(
                "Batch complete signal received — tenant=%s, source=%s",
                tenant_id,
                source_id,
            )
            if self.on_batch_complete is not None:
                try:
                    self.on_batch_complete(tenant_id, source_id, value)
                except Exception:
                    logger.exception(
                        "Error in on_batch_complete callback — "
                        "tenant=%s, source=%s",
                        tenant_id,
                        source_id,
                    )

    def _poll_loop(self) -> None:
        """
        Blocking poll loop that runs in a thread.

        Continuously polls the Kafka broker for new messages, deserializes
        them, and dispatches to :meth:`handle`. Errors are logged and
        the loop continues (at-least-once semantics).
        """
        self._consumer = self._create_consumer()
        self._consumer.subscribe([self.topic])
        logger.info("Consumer subscribed to topic '%s' — polling started.", self.topic)

        try:
            while self._running:
                msg = self._consumer.poll(timeout=1.0)
                if msg is None:
                    continue

                error = msg.error()
                if error:
                    if error.code() == KafkaError._PARTITION_EOF:
                        logger.debug(
                            "End of partition — topic=%s [%d] offset=%d",
                            msg.topic(),
                            msg.partition(),
                            msg.offset(),
                        )
                    else:
                        logger.error("Consumer error: %s", error)
                        raise KafkaException(error)
                    continue

                # Deserialize message
                try:
                    key = msg.key().decode("utf-8") if msg.key() else None
                    raw_value = msg.value().decode("utf-8") if msg.value() else "{}"
                    value = json.loads(raw_value)
                except (json.JSONDecodeError, UnicodeDecodeError) as exc:
                    logger.warning(
                        "Failed to deserialize message at offset %d: %s",
                        msg.offset(),
                        exc,
                    )
                    continue

                # Dispatch to handler
                try:
                    self.handle(key, value)
                except Exception:
                    logger.exception(
                        "Unhandled error processing message at offset %d",
                        msg.offset(),
                    )
        finally:
            logger.info("Consumer shutting down — closing connection…")
            self._consumer.close()

    async def start(self) -> None:
        """
        Start the consumer poll loop as a background asyncio task.

        The blocking ``_poll_loop`` runs in a thread executor so it
        doesn't block the FastAPI event loop.
        """
        if self._running:
            logger.warning("Consumer already running — skipping start.")
            return

        self._running = True
        loop = asyncio.get_running_loop()
        logger.info("Starting IngestRawConsumer background task…")
        loop.run_in_executor(None, self._poll_loop)

    async def stop(self) -> None:
        """Signal the consumer to stop polling and clean up."""
        if not self._running:
            return
        logger.info("Stopping IngestRawConsumer…")
        self._running = False
