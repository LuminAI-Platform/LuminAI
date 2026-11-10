"""Base utilities and exponential backoff retry execution for Kafka producers."""

from __future__ import annotations

import logging
import time
from typing import Any, Callable

from confluent_kafka import Producer

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
                luminai_kafka_messages_produced_total.labels(
                    topic=topic, status="success"
                ).inc()
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
                    luminai_kafka_messages_produced_total.labels(
                        topic=topic, status="retry"
                    ).inc()
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
    val = (
        max_retries
        if max_retries is not None
        else getattr(settings, "kafka_producer_max_retries", 3)
    )
    if (
        isinstance(val, int)
        and not isinstance(val, bool)
        and not hasattr(val, "_mock_return_value")
    ):
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
    if (
        isinstance(val_b, (int, float))
        and not isinstance(val_b, bool)
        and not hasattr(val_b, "_mock_return_value")
    ):
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
    if (
        isinstance(val_m, (int, float))
        and not isinstance(val_m, bool)
        and not hasattr(val_m, "_mock_return_value")
    ):
        multiplier = float(val_m)
    elif isinstance(val_m, (str, bytes)):
        try:
            multiplier = float(val_m)
        except (TypeError, ValueError):
            multiplier = 2.0

    return retries, backoff, multiplier
