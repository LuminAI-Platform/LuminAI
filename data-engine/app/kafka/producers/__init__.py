"""Kafka producers package for the LuminAI Data Engine.

Decomposed into:
  - base.py            → Retry backoff execution and settings extraction
  - dead_letter.py     → DeadLetterProducer for poison-pill / error event publishing
  - ingest_valid.py    → IngestValidProducer for validated ingestion batches
  - entity_resolved.py → EntityResolvedProducer for golden records & batch completions
  - ingest_raw.py      → IngestRawProducer for raw message replay

All classes and backward-compatible mock hooks are re-exported at package root.
"""

from confluent_kafka import Producer

from app.config import get_settings
from app.kafka.producers.base import (
    _extract_retry_settings,
    _produce_with_exponential_backoff,
)
from app.kafka.producers.dead_letter import DeadLetterProducer
from app.kafka.producers.entity_resolved import EntityResolvedProducer
from app.kafka.producers.ingest_raw import IngestRawProducer
from app.kafka.producers.ingest_valid import IngestValidProducer

__all__ = [
    "Producer",
    "get_settings",
    "_produce_with_exponential_backoff",
    "_extract_retry_settings",
    "DeadLetterProducer",
    "IngestValidProducer",
    "EntityResolvedProducer",
    "IngestRawProducer",
]
