"""Kafka producers for the LuminAI Data Engine.

Produces:
  1. ``DeadLetterProducer``: Poison-pill or failed ingestion events to ``ingest.dead_letter``.
  2. ``IngestValidProducer``: Validated ingestion events to ``ingest.valid``.
  3. ``EntityResolvedProducer``: Resolved Golden Records to ``entity.resolved``.
  4. ``IngestRawProducer``: Replays or publishes raw payloads to ``ingest.raw``.

All producers implement:
  - Configurable exponential backoff retry (at least 3 attempts).
  - Buffer queue draining on ``BufferError``.
  - Critical alert logging on retry exhaustion.
  - Automatic routing of failed message envelopes to the Dead-Letter Queue (DLQ).
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Callable

from confluent_kafka import Producer

from app.config import get_settings
from app.telemetry import luminai_kafka_messages_produced_total, trace_span

logger = logging.getLogger(__name__)


def _produce_with_exponential_backoff(
    producer: Producer,
    topic: str,
    key: bytes | None,
    value: bytes,
    callback: Any,
    max_retries: int = 3,
    initial_backoff: float = 0.5,
    backoff_multiplier: float = 2.0,
    sleep_fn: Callable[[float], None] = time.sleep,
) -> tuple[bool, Exception | None]:
    """Execute producer.produce() with exponential backoff retry.

    If a BufferError occurs, polls the producer to drain the internal message queue
    before applying exponential backoff and retrying.

    Returns:
        tuple[bool, Exception | None]: (True, None) on success, or (False, last_exception).
    """
    key_str = key.decode("utf-8", errors="replace") if key else None
    attempt = 0
    backoff = initial_backoff
    last_exc: Exception | None = None

    with trace_span(
        "kafka.produce",
        attributes={
            "messaging.system": "kafka",
            "messaging.destination": topic,
            "messaging.message_id": key_str or "",
        },
    ):
        while attempt < max_retries:
            attempt += 1
            try:
                producer.produce(
                    topic=topic,
                    key=key,
                    value=value,
                    callback=callback,
                )
                producer.poll(0)
                luminai_kafka_messages_produced_total.labels(topic=topic, status="success").inc()
                logger.info(
                    "📡 Successfully produced message to topic '%s' (attempt %d/%d)",
                    topic,
                    attempt,
                    max_retries,
                )
                return True, None
            except Exception as exc:
                last_exc = exc
                logger.warning(
                    "⚠️ Produce attempt %d/%d failed for topic '%s' (key=%s): %s",
                    attempt,
                    max_retries,
                    topic,
                    key_str,
                    exc,
                )
                if attempt < max_retries:
                    luminai_kafka_messages_produced_total.labels(topic=topic, status="retry").inc()
                    # If local queue is full, poll to drain queue
                    if isinstance(exc, BufferError):
                        producer.poll(0.2)
                    sleep_fn(backoff)
                    backoff *= backoff_multiplier

        luminai_kafka_messages_produced_total.labels(topic=topic, status="failed").inc()
        return False, last_exc



def _extract_retry_settings(
    settings: Any,
    max_retries: int | None,
    initial_backoff: float | None,
    backoff_multiplier: float | None,
) -> tuple[int, float, float]:
    """Safely extract retry settings with fallback defaults resistant to MagicMock objects."""
    # Retries
    retries = 3
    val = max_retries if max_retries is not None else getattr(settings, "kafka_producer_max_retries", 3)
    if isinstance(val, int) and not isinstance(val, bool) and not hasattr(val, "_mock_return_value"):
        retries = val
    elif isinstance(val, (str, bytes)):
        try:
            retries = int(val)
        except (TypeError, ValueError):
            retries = 3

    # Initial backoff
    backoff = 0.5
    val_b = (
        initial_backoff
        if initial_backoff is not None
        else getattr(settings, "kafka_producer_initial_backoff", 0.5)
    )
    if isinstance(val_b, (int, float)) and not isinstance(val_b, bool) and not hasattr(val_b, "_mock_return_value"):
        backoff = float(val_b)
    elif isinstance(val_b, (str, bytes)):
        try:
            backoff = float(val_b)
        except (TypeError, ValueError):
            backoff = 0.5

    # Backoff multiplier
    multiplier = 2.0
    val_m = (
        backoff_multiplier
        if backoff_multiplier is not None
        else getattr(settings, "kafka_producer_backoff_multiplier", 2.0)
    )
    if isinstance(val_m, (int, float)) and not isinstance(val_m, bool) and not hasattr(val_m, "_mock_return_value"):
        multiplier = float(val_m)
    elif isinstance(val_m, (str, bytes)):
        try:
            multiplier = float(val_m)
        except (TypeError, ValueError):
            multiplier = 2.0

    return retries, backoff, multiplier



class DeadLetterProducer:
    """Publishes poison-pill or failed ingestion events to ``ingest.dead_letter``."""

    def __init__(
        self,
        max_retries: int | None = None,
        initial_backoff: float | None = None,
        backoff_multiplier: float | None = None,
        sleep_fn: Callable[[float], None] = time.sleep,
    ) -> None:
        settings = get_settings()
        self.topic = settings.kafka_topic_ingest_dead_letter
        self.bootstrap_servers = settings.kafka_bootstrap_servers
        self.enabled = settings.kafka_enabled
        self.max_retries, self.initial_backoff, self.backoff_multiplier = _extract_retry_settings(
            settings, max_retries, initial_backoff, backoff_multiplier
        )
        self._sleep_fn = sleep_fn
        self._producer: Producer | None = None

        if self.enabled:
            try:
                conf = {
                    "bootstrap.servers": self.bootstrap_servers,
                    "client.id": "data-engine-dlq-producer",
                }
                self._producer = Producer(conf)
                logger.info("DeadLetterProducer started — topic='%s'", self.topic)
            except Exception as e:
                logger.error("❌ Failed to create DeadLetterProducer: %s", e)
                self._producer = None
        else:
            logger.info("DeadLetterProducer initialised in dry-run mode. Would publish to '%s'", self.topic)

    def _delivery_report(self, err: Any, msg: Any) -> None:
        if err is not None:
            logger.error("❌ Dead-letter delivery failed: %s", err)
        else:
            logger.info("💀 Dead-letter delivered to %s [%d] at offset %d", msg.topic(), msg.partition(), msg.offset())

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
            logger.info("💀 Published dead-letter event to '%s' with key '%s'", self.topic, key)
            return True
        else:
            logger.info("[DRY-RUN] Would publish dead letter to %s — key=%s error=%s", self.topic, key, error)
            return True

    def flush(self, timeout: float = 1.0) -> None:
        if self._producer is not None:
            self._producer.flush(timeout)


class IngestValidProducer:
    """Publishes validated ingestion events to the ``ingest.valid`` Kafka topic.

    Message key format  : ``{tenant_id}:{entity_type}``
    Message value format: JSON payload with cleaned record batches and metadata.
    """

    def __init__(
        self,
        dead_letter_producer: DeadLetterProducer | None = None,
        max_retries: int | None = None,
        initial_backoff: float | None = None,
        backoff_multiplier: float | None = None,
        sleep_fn: Callable[[float], None] = time.sleep,
    ) -> None:
        settings = get_settings()
        self.topic = settings.kafka_topic_ingest_valid
        self.bootstrap_servers = settings.kafka_bootstrap_servers
        self.enabled = settings.kafka_enabled
        self.max_retries, self.initial_backoff, self.backoff_multiplier = _extract_retry_settings(
            settings, max_retries, initial_backoff, backoff_multiplier
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

    def _get_dlq_producer(self) -> DeadLetterProducer:
        if self._dlq_producer is None:
            self._dlq_producer = DeadLetterProducer(
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
            logger.info("📡 Published message to topic '%s' with key '%s'", self.topic, key)
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


class EntityResolvedProducer:
    """Publishes resolved Golden Records to the ``entity.resolved`` Kafka topic.

    Message key format  : ``{tenant_id}:{golden_id}``
    Message value format: JSON payload containing Golden Record attributes and metadata.
    """

    def __init__(
        self,
        dead_letter_producer: DeadLetterProducer | None = None,
        max_retries: int | None = None,
        initial_backoff: float | None = None,
        backoff_multiplier: float | None = None,
        sleep_fn: Callable[[float], None] = time.sleep,
    ) -> None:
        settings = get_settings()
        self.topic = settings.kafka_topic_entity_resolved
        self.bootstrap_servers = settings.kafka_bootstrap_servers
        self.enabled = settings.kafka_enabled
        self.max_retries, self.initial_backoff, self.backoff_multiplier = _extract_retry_settings(
            settings, max_retries, initial_backoff, backoff_multiplier
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
                self._producer = Producer(conf)
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

    def _get_dlq_producer(self) -> DeadLetterProducer:
        if self._dlq_producer is None:
            self._dlq_producer = DeadLetterProducer(
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
            logger.info("📡 Published resolved entity to topic '%s' with key '%s'", self.topic, key)
            return True
        else:
            logger.info(
                "[DRY-RUN] Would publish to %s — key=%s payload_keys=%s",
                self.topic,
                key,
                list(event_body.keys()),
            )
            return True

    def flush(self, timeout: float = 1.0) -> None:
        if self._producer is not None:
            self._producer.flush(timeout)


class IngestRawProducer:
    """Publishes or replays ingestion payloads back into the ``ingest.raw`` topic."""

    def __init__(
        self,
        dead_letter_producer: DeadLetterProducer | None = None,
        max_retries: int | None = None,
        initial_backoff: float | None = None,
        backoff_multiplier: float | None = None,
        sleep_fn: Callable[[float], None] = time.sleep,
    ) -> None:
        settings = get_settings()
        self.topic = settings.kafka_topic_ingest_raw
        self.bootstrap_servers = settings.kafka_bootstrap_servers
        self.enabled = settings.kafka_enabled
        self.max_retries, self.initial_backoff, self.backoff_multiplier = _extract_retry_settings(
            settings, max_retries, initial_backoff, backoff_multiplier
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
                self._producer = Producer(conf)
                logger.info("IngestRawProducer started — topic='%s'", self.topic)
            except Exception as e:
                logger.error("❌ Failed to create IngestRawProducer: %s", e)
                self._producer = None
        else:
            logger.info("IngestRawProducer initialised in dry-run mode. Would publish to '%s'", self.topic)

    def _get_dlq_producer(self) -> DeadLetterProducer:
        if self._dlq_producer is None:
            self._dlq_producer = DeadLetterProducer(
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
            logger.info("🔁 IngestRaw replayed to %s [%d] at offset %d", msg.topic(), msg.partition(), msg.offset())

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
            logger.info("🔁 Published raw message to '%s' with key '%s'", self.topic, key)
            return True
        else:
            logger.info("[DRY-RUN] Would replay raw message to %s — key=%s", self.topic, key)
            return True

    def flush(self, timeout: float = 1.0) -> None:
        if self._producer is not None:
            self._producer.flush(timeout)
