"""Relational edges generation trigger and persistence."""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from app.processing.er.relational_edges import (
    generate_relational_edges as _gen_edges,
    persist_relational_edges,
    publish_relational_edges_to_kafka,
)

logger = logging.getLogger(__name__)


def execute_generate_relational_edges(
    tenant_id: str = "acme",
    records: Optional[list[dict[str, Any]]] = None,
    foreign_keys: Optional[dict[str, Any] | list[dict[str, Any]]] = None,
    source_id: str = "default-source",
    source_entity_type: Optional[str] = None,
    publish_to_kafka: bool = True,
    persist_to_db: bool = True,
) -> list[dict[str, Any]]:
    """Generate relational edges for cross-entity linking using foreign keys."""
    logger.info(
        "Triggering Relational Edge Generation — tenant=%s, source=%s, records=%s",
        tenant_id,
        source_id,
        len(records) if records else "auto-fetch",
    )

    effective_records = records
    if effective_records is None:
        try:
            from app.db.models import StagingRecord
            from app.db.session import get_session_factory

            session_factory = get_session_factory()
            with session_factory() as session:
                db_records = (
                    session.query(StagingRecord)
                    .filter_by(tenant_id=tenant_id)
                    .limit(500)
                    .all()
                )
                effective_records = []
                for r in db_records:
                    try:
                        payload = (
                            json.loads(r.data)
                            if isinstance(r.data, str)
                            else dict(r.data)
                        )
                        payload.setdefault("id", r.id)
                        effective_records.append(payload)
                    except Exception:
                        continue
        except Exception as e:
            logger.warning(
                "Could not auto-fetch staged records for edge generation: %s", e
            )
            effective_records = []

    edges = _gen_edges(
        records=effective_records,
        tenant_id=tenant_id,
        foreign_keys=foreign_keys,
        source_entity_type=source_entity_type,
    )

    if persist_to_db and edges:
        try:
            persist_relational_edges(edges, tenant_id=tenant_id)
        except Exception as e:
            logger.warning("Failed to persist relational edges to DB: %s", e)

    if publish_to_kafka and effective_records:
        try:
            publish_relational_edges_to_kafka(
                records=effective_records,
                tenant_id=tenant_id,
                source_id=source_id,
            )
        except Exception as e:
            logger.warning("Failed to publish relational edges to Kafka: %s", e)

    return edges
