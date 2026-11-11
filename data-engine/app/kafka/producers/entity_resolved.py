"""EntityResolvedProducer for resolved Golden Records and batch completions."""

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


class EntityResolvedProducer:
    """Publishes resolved Golden Records to the ``entity.resolved`` Kafka topic.

    Message key format  : ``{tenant_id}:{golden_id}``
    Message value format: JSON payload containing Golden Record attributes and metadata.
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
        self.topic = settings.kafka_topic_entity_resolved
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
                    "client.id": "data-engine-resolved-producer",
                }
                conf.update(settings.kafka_security_conf)
                prod_cls = getattr(producers_pkg, "Producer", Producer)
                self._producer = prod_cls(conf)
                logger.info(
                    "EntityResolvedProducer started — topic='%s', brokers='%s'",
                    self.topic,
                    self.bootstrap_servers,
                )
            except Exception as e:
                logger.error("❌ Failed to create EntityResolvedProducer: %s", e)
                self._producer = None
        else:
            logger.info(
                "EntityResolvedProducer initialised in dry-run mode (Kafka disabled). "
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
        if err is not None:
            logger.error("❌ EntityResolved delivery failed: %s", err)
        else:
            logger.info(
                "📡 EntityResolved delivered to %s [%d] at offset %d",
                msg.topic(),
                msg.partition(),
                msg.offset(),
            )

    def publish_resolved_entity(
        self,
        tenant_id: str,
        golden_id: str,
        entity_type: str,
        payload: dict[str, Any],
        source_id: str = "er-engine",
    ) -> bool:
        """Publish a resolved Golden Record event to ``entity.resolved`` with retry and DLQ fallback."""
        key = f"{tenant_id}:{golden_id}"
        event_body = {
            "tenant_id": tenant_id,
            "golden_id": golden_id,
            "entity_type": entity_type,
            "data": payload,
            "source_id": source_id,
            "connectionId": source_id,
        }
        value_bytes = json.dumps(event_body).encode("utf-8")

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
                    original_payload=json.dumps(event_body),
                    error=f"ProduceError after {self.max_retries} attempts: {last_exc}",
                )
                return False
            logger.info(
                "📡 Published resolved entity to topic '%s' with key '%s'",
                self.topic,
                key,
            )
            return True
        else:
            logger.info(
                "[DRY-RUN] Would publish to %s — key=%s payload_keys=%s",
                self.topic,
                key,
                list(event_body.keys()),
            )
            return True

    def publish_batch_completion(
        self,
        tenant_id: str,
        connection_id: str,
        resolved_entities: int,
    ) -> bool:
        """Publish a batch completion event for entity resolution so consumers can mark the run completed."""
        key = f"{tenant_id}:{connection_id}"
        event_body = {
            "tenant_id": tenant_id,
            "connectionId": connection_id,
            "source_id": connection_id,
            "resolvedEntities": resolved_entities,
            "status": "COMPLETED",
        }
        value_bytes = json.dumps(event_body).encode("utf-8")

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
                    "🚨 CRITICAL ALERT: Kafka produce batch completion to '%s' failed after %d attempts: %s. Routing to dead-letter queue.",
                    self.topic,
                    self.max_retries,
                    last_exc,
                )
                self._get_dlq_producer().publish_dead_letter(
                    tenant_id=tenant_id,
                    source_id=connection_id,
                    original_topic=self.topic,
                    original_key=key,
                    original_payload=json.dumps(event_body),
                    error=f"ProduceError after {self.max_retries} attempts: {last_exc}",
                )
                return False
            logger.info(
                "📡 Published batch completion to '%s' with key '%s'", self.topic, key
            )
            return True
        else:
            logger.info(
                "[DRY-RUN] Would publish batch completion to %s — key=%s payload_keys=%s",
                self.topic,
                key,
                list(event_body.keys()),
            )
            return True

    def flush(self, timeout: float = 1.0) -> None:
        if self._producer is not None:
            self._producer.flush(timeout)
