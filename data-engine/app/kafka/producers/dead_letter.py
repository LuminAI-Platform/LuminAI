"""Dead-letter queue producer for poison-pill or failed ingestion events."""

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


class DeadLetterProducer:
    """Publishes poison-pill or failed ingestion events to ``ingest.dead_letter``."""

    def __init__(
        self,
        max_retries: int | None = None,
        initial_backoff: float | None = None,
        backoff_multiplier: float | None = None,
        sleep_fn: Callable[[float], None] = time.sleep,
    ) -> None:
        settings = producers_pkg.get_settings()
        self.topic = settings.kafka_topic_ingest_dead_letter
        self.bootstrap_servers = settings.kafka_bootstrap_servers
        self.enabled = settings.kafka_enabled
        self.max_retries, self.initial_backoff, self.backoff_multiplier = (
            _extract_retry_settings(
                settings, max_retries, initial_backoff, backoff_multiplier
            )
        )
        self._sleep_fn = sleep_fn
        self._producer: Producer | None = None

        if self.enabled:
            try:
                conf = {
                    "bootstrap.servers": self.bootstrap_servers,
                    "client.id": "data-engine-dlq-producer",
                }
                conf.update(settings.kafka_security_conf)
                prod_cls = getattr(producers_pkg, "Producer", Producer)
                self._producer = prod_cls(conf)
                logger.info("DeadLetterProducer started — topic='%s'", self.topic)
            except Exception as e:
                logger.error("❌ Failed to create DeadLetterProducer: %s", e)
                self._producer = None
        else:
            logger.info(
                "DeadLetterProducer initialised in dry-run mode. Would publish to '%s'",
                self.topic,
            )

    def _delivery_report(self, err: Any, msg: Any) -> None:
        if err is not None:
            logger.error("❌ Dead-letter delivery failed: %s", err)
        else:
            logger.info(
                "💀 Dead-letter delivered to %s [%d] at offset %d",
                msg.topic(),
                msg.partition(),
                msg.offset(),
            )

    def publish_dead_letter(
        self,
        tenant_id: str,
        error: str,
        original_topic: str,
        original_key: str | None,
        original_payload: str,
        source_id: str = "unknown",
    ) -> bool:
        """Publish a failed message envelope to the DLQ topic with retry."""
        key = f"{tenant_id}:{source_id}" if original_key is None else original_key
        event_body = {
            "tenant_id": tenant_id,
            "source_id": source_id,
            "error": error,
            "original_topic": original_topic,
            "original_key": original_key,
            "payload": original_payload,
        }
        value_bytes = json.dumps(event_body).encode("utf-8")

        if self._producer is not None:
            success, last_exc = _produce_with_exponential_backoff(
                producer=self._producer,
                topic=self.topic,
                key=key.encode("utf-8") if key else None,
                value=value_bytes,
                callback=self._delivery_report,
                max_retries=self.max_retries,
                initial_backoff=self.initial_backoff,
                backoff_multiplier=self.backoff_multiplier,
                sleep_fn=self._sleep_fn,
            )
            if not success:
                logger.critical(
                    "🚨 CRITICAL: Dead-letter queue produce to '%s' failed after %d attempts: %s. "
                    "Dropping message envelope to avoid infinite loops.",
                    self.topic,
                    self.max_retries,
                    last_exc,
                )
                return False
            logger.info(
                "💀 Published dead-letter event to '%s' with key '%s'", self.topic, key
            )
            return True
        else:
            logger.info(
                "[DRY-RUN] Would publish dead letter to %s — key=%s error=%s",
                self.topic,
                key,
                error,
            )
            return True

    def flush(self, timeout: float = 1.0) -> None:
        if self._producer is not None:
            self._producer.flush(timeout)
