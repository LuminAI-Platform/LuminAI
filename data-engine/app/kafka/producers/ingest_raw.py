"""IngestRawProducer for publishing or replaying raw messages into ingest.raw."""

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


class IngestRawProducer:
    """Publishes or replays ingestion payloads back into the ``ingest.raw`` topic."""

    def __init__(
        self,
        dead_letter_producer: Any | None = None,
        max_retries: int | None = None,
        initial_backoff: float | None = None,
        backoff_multiplier: float | None = None,
        sleep_fn: Callable[[float], None] = time.sleep,
    ) -> None:
        settings = producers_pkg.get_settings()
        self.topic = settings.kafka_topic_ingest_raw
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
                    "client.id": "data-engine-raw-replay-producer",
                }
                conf.update(settings.kafka_security_conf)
                prod_cls = getattr(producers_pkg, "Producer", Producer)
                self._producer = prod_cls(conf)
                logger.info("IngestRawProducer started — topic='%s'", self.topic)
            except Exception as e:
                logger.error("❌ Failed to create IngestRawProducer: %s", e)
                self._producer = None
        else:
            logger.info(
                "IngestRawProducer initialised in dry-run mode. Would publish to '%s'",
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
        if err is not None:
            logger.error("❌ IngestRaw replay delivery failed: %s", err)
        else:
            logger.info(
                "🔁 IngestRaw replayed to %s [%d] at offset %d",
                msg.topic(),
                msg.partition(),
                msg.offset(),
            )

    def publish_raw(
        self,
        key: str | None,
        payload: dict[str, Any] | str,
        tenant_id: str = "unknown",
        source_id: str = "unknown",
    ) -> bool:
        """Publish a message payload to ``ingest.raw`` with retry and DLQ fallback."""
        if isinstance(payload, dict):
            value_bytes = json.dumps(payload).encode("utf-8")
            raw_str = json.dumps(payload)
        else:
            value_bytes = payload.encode("utf-8")
            raw_str = payload

        key_bytes = key.encode("utf-8") if key else None

        if self._producer is not None:
            success, last_exc = _produce_with_exponential_backoff(
                producer=self._producer,
                topic=self.topic,
                key=key_bytes,
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
                    original_payload=raw_str,
                    error=f"ProduceError after {self.max_retries} attempts: {last_exc}",
                )
                return False
            logger.info(
                "🔁 Published raw message to '%s' with key '%s'", self.topic, key
            )
            return True
        else:
            logger.info(
                "[DRY-RUN] Would replay raw message to %s — key=%s", self.topic, key
            )
            return True

    def flush(self, timeout: float = 1.0) -> None:
        if self._producer is not None:
            self._producer.flush(timeout)
