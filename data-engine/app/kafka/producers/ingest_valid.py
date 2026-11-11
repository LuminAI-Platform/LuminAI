"""IngestValidProducer for validated ingestion batches."""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Callable

from confluent_kafka import Producer

import app.kafka.producers as producers_pkg
from app.kafka.producers.base import (
    _extract_retry_settings,
    _produce_with_exponential_backoff,
)

logger = logging.getLogger(__name__)


class IngestValidProducer:
    """Publishes validated ingestion events to the ``ingest.valid`` Kafka topic.

    Message key format  : ``{tenant_id}:{entity_type}``
    Message value format: JSON payload with cleaned record batches and metadata.
    """

    def __init__(
        self,
        dead_letter_producer: Any | None = None,
        max_retries: int | None = None,
        initial_backoff: float | None = None,
        backoff_multiplier: float | None = None,
        sleep_fn: Callable[[float], None] = time.sleep,
    ) -> None:
        settings = producers_pkg.get_settings()
        self.topic = settings.kafka_topic_ingest_valid
        self.bootstrap_servers = settings.kafka_bootstrap_servers
        self.enabled = settings.kafka_enabled
        self.max_retries, self.initial_backoff, self.backoff_multiplier = (
            _extract_retry_settings(
                settings, max_retries, initial_backoff, backoff_multiplier
            )
        )
        self._sleep_fn = sleep_fn
        self._dlq_producer = dead_letter_producer
        self._producer: Producer | None = None

        if self.enabled:
            try:
                conf = {
                    "bootstrap.servers": self.bootstrap_servers,
                    "client.id": "data-engine-valid-producer",
                }
                conf.update(settings.kafka_security_conf)
                prod_cls = getattr(producers_pkg, "Producer", Producer)
                self._producer = prod_cls(conf)
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

    def _get_dlq_producer(self) -> Any:
        if self._dlq_producer is None:
            self._dlq_producer = producers_pkg.DeadLetterProducer(
                max_retries=self.max_retries,
                initial_backoff=self.initial_backoff,
                backoff_multiplier=self.backoff_multiplier,
                sleep_fn=self._sleep_fn,
            )
        return self._dlq_producer

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

    def publish(
        self,
        tenant_id: str,
        entity_type: str,
        payload: dict[str, Any],
        source_id: str = "unknown",
    ) -> bool:
        """Publish a validated batch event to ``ingest.valid`` with exponential backoff and DLQ fallback."""
        key = f"{tenant_id}:{entity_type}"
        value_bytes = json.dumps(payload).encode("utf-8")

        if self._producer is not None:
            success, last_exc = _produce_with_exponential_backoff(
                producer=self._producer,
                topic=self.topic,
                key=key.encode("utf-8"),
                value=value_bytes,
                callback=self._delivery_report,
                max_retries=self.max_retries,
                initial_backoff=self.initial_backoff,
                backoff_multiplier=self.backoff_multiplier,
                sleep_fn=self._sleep_fn,
            )
            if not success:
                logger.error(
                    "🚨 CRITICAL ALERT: Kafka produce to '%s' failed after %d attempts: %s. Routing to dead-letter queue.",
                    self.topic,
                    self.max_retries,
                    last_exc,
                )
                self._get_dlq_producer().publish_dead_letter(
                    tenant_id=tenant_id,
                    source_id=source_id,
                    original_topic=self.topic,
                    original_key=key,
                    original_payload=json.dumps(payload),
                    error=f"ProduceError after {self.max_retries} attempts: {last_exc}",
                )
                return False
            logger.info(
                "📡 Published message to topic '%s' with key '%s'", self.topic, key
            )
            return True
        else:
            logger.info(
                "[DRY-RUN] Would publish to %s — key=%s payload_keys=%s",
                self.topic,
                key,
                list(payload.keys()),
            )
            return True

    def flush(self, timeout: float = 1.0) -> None:
        """Flush any pending messages in the producer queue."""
        if self._producer is not None:
            self._producer.flush(timeout)
