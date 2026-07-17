"""Kafka producer for the LuminAI Data Engine.

Produces validated ingestion events to the ``ingest.valid`` Kafka topic
after a batch of raw records has been cleaned, normalised, and staged.
"""

import json
import logging
from typing import Any

from confluent_kafka import Producer

from app.config import get_settings

logger = logging.getLogger(__name__)


class IngestValidProducer:
    """
    Publishes validated ingestion events to the ``ingest.valid`` Kafka topic.

    Message key format  : ``{tenant_id}:{entity_type}``
    Message value format: JSON payload with cleaned record batches and metadata.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self.topic = settings.kafka_topic_ingest_valid
        self.bootstrap_servers = settings.kafka_bootstrap_servers
        self.enabled = settings.kafka_enabled
        self._producer: Producer | None = None

        if self.enabled:
            try:
                conf = {
                    "bootstrap.servers": self.bootstrap_servers,
                    "client.id": "data-engine-producer",
                }
                self._producer = Producer(conf)
                logger.info(
                    "IngestValidProducer started — topic='%s', brokers='%s'",
                    self.topic,
                    self.bootstrap_servers,
                )
            except Exception as e:
                logger.error("❌ Failed to create Kafka producer: %s", e)
                self._producer = None
        else:
            logger.info(
                "IngestValidProducer initialised in dry-run mode (Kafka disabled). "
                "Would publish to topic='%s'",
                self.topic,
            )

    def _delivery_report(self, err: Any, msg: Any) -> None:
        """Callback received on message delivery success or failure."""
        if err is not None:
            logger.error("❌ Message delivery failed: %s", err)
        else:
            logger.info(
                "📡 Message delivered to %s [%d] at offset %d",
                msg.topic(),
                msg.partition(),
                msg.offset(),
            )

    def publish(self, tenant_id: str, entity_type: str, payload: dict[str, Any]) -> None:
        """
        Publish a validated batch event to ``ingest.valid``.

        Args:
            tenant_id:   Tenant context scoping the event.
            entity_type: Ontology entity type (e.g. ``"Person"``).
            payload:     Cleaned record batch with schema and row data.
        """
        key = f"{tenant_id}:{entity_type}"
        value_bytes = json.dumps(payload).encode("utf-8")

        if self._producer is not None:
            try:
                self._producer.produce(
                    topic=self.topic,
                    key=key.encode("utf-8"),
                    value=value_bytes,
                    callback=self._delivery_report,
                )
                # Serve delivery callback queue
                self._producer.poll(0)
                logger.info("📡 Published message to topic '%s' with key '%s'", self.topic, key)
            except Exception as e:
                logger.error("❌ Error producing message to topic '%s': %s", self.topic, e)
        else:
            logger.info(
                "[DRY-RUN] Would publish to %s — key=%s payload_keys=%s",
                self.topic,
                key,
                list(payload.keys()),
            )

    def flush(self, timeout: float = 1.0) -> None:
        """Flush any pending messages in the producer queue."""
        if self._producer is not None:
            self._producer.flush(timeout)
