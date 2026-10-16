"""Relational edge generator for cross-entity linking via foreign keys.

Resolves cross-entity relationships (e.g., Customer -> Order, Order -> Product)
by analyzing foreign key columns in staged or resolved entity records,
generating typed graph edges, persisting them to the database, and emitting
them to Kafka so Neo4j synchronizes cross-entity connections.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional, Union

from sqlalchemy import text

from app.db.session import get_session_factory
from app.kafka.producers import EntityResolvedProducer

logger = logging.getLogger(__name__)

# Common foreign key patterns and standard relationship naming
DEFAULT_RELATION_TYPES: dict[str, str] = {
    "customer_id": "CUSTOMER_OF",
    "user_id": "CREATED_BY",
    "order_id": "PART_OF_ORDER",
    "product_id": "CONTAINS_PRODUCT",
    "account_id": "ACCOUNT_OF",
    "org_id": "ORGANIZATION_OF",
    "organization_id": "ORGANIZATION_OF",
    "parent_id": "CHILD_OF",
    "seller_id": "SOLD_BY",
    "supplier_id": "SUPPLIED_BY",
    "vendor_id": "SUPPLIED_BY",
    "buyer_id": "BOUGHT_BY",
    "patient_id": "PATIENT_OF",
    "doctor_id": "TREATED_BY",
    "employee_id": "EMPLOYED_BY",
    "device_id": "RECORDED_BY_DEVICE",
}


def _infer_relationship_type(col_name: str) -> str:
    """Infer a standardized uppercase Neo4j relationship type from a column name."""
    col_lower = col_name.lower().strip()
    if col_lower in DEFAULT_RELATION_TYPES:
        return DEFAULT_RELATION_TYPES[col_lower]

    if col_lower.endswith("_id"):
        target_name = col_lower[:-3]
        return f"REL_{target_name.upper()}"
    elif col_lower.endswith("id") and len(col_lower) > 2:
        target_name = col_lower[:-2]
        return f"REL_{target_name.upper()}"

    return f"LINKED_VIA_{col_name.upper()}"


def _extract_source_id(record: dict[str, Any]) -> str | None:
    """Extract a canonical source entity identifier from a record dictionary."""
    for key in ("golden_id", "id", "_id", "entity_id", "record_id", "uuid"):
        val = record.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()
    return None


def generate_relational_edges(
    records: list[dict[str, Any]],
    tenant_id: str = "acme",
    foreign_keys: Optional[Union[dict[str, Any], list[dict[str, Any]]]] = None,
    source_entity_type: Optional[str] = None,
) -> list[dict[str, Any]]:
    """Generate relational edge records connecting source entities to target entities using foreign keys.

    Args:
        records: List of record dictionaries.
        tenant_id: Scoping tenant ID.
        foreign_keys: Optional explicit FK mapping. Can be:
            - Dict e.g. {"customer_id": "Customer"} or
              {"customer_id": {"target_type": "Customer", "rel_type": "PLACED_BY"}}
            - List of dicts e.g. [{"column": "customer_id", "target_type": "Customer", "rel_type": "PLACED_BY"}]
        source_entity_type: Type of source entity (e.g. "Order", "Transaction").

    Returns:
        List of generated relational edge dictionaries.
    """
    if not records:
        return []

    # Normalize foreign keys specification
    fk_configs: dict[str, dict[str, Any]] = {}
    if isinstance(foreign_keys, dict):
        for col, cfg in foreign_keys.items():
            if isinstance(cfg, str):
                fk_configs[col] = {
                    "target_type": cfg,
                    "rel_type": _infer_relationship_type(col),
                    "direction": "OUTGOING",
                }
            elif isinstance(cfg, dict):
                fk_configs[col] = {
                    "target_type": cfg.get("target_type")
                    or cfg.get("targetType")
                    or "Entity",
                    "rel_type": cfg.get("rel_type")
                    or cfg.get("relationship_type")
                    or cfg.get("type")
                    or _infer_relationship_type(col),
                    "direction": cfg.get("direction", "OUTGOING"),
                }
    elif isinstance(foreign_keys, list):
        for item in foreign_keys:
            if isinstance(item, dict):
                col = (
                    item.get("column")
                    or item.get("source_column")
                    or item.get("fk_column")
                )
                if col:
                    fk_configs[str(col)] = {
                        "target_type": item.get("target_type")
                        or item.get("targetType")
                        or "Entity",
                        "rel_type": item.get("rel_type")
                        or item.get("relationship_type")
                        or item.get("type")
                        or _infer_relationship_type(str(col)),
                        "direction": item.get("direction", "OUTGOING"),
                    }

    # If no explicit foreign keys provided, automatically detect candidate columns
    if not fk_configs:
        sample_keys = set()
        for r in records[:20]:
            sample_keys.update(r.keys())

        ignored_pks = {
            "id",
            "_id",
            "record_id",
            "uuid",
            "golden_id",
            "tenant_id",
            "source_id",
        }
        for k in sample_keys:
            if k.lower() in ignored_pks:
                continue
            if k.lower().endswith("_id") or (k.lower().endswith("id") and len(k) > 2):
                fk_configs[k] = {
                    "target_type": "Entity",
                    "rel_type": _infer_relationship_type(k),
                    "direction": "OUTGOING",
                }

    generated_edges: list[dict[str, Any]] = []

    for record in records:
        src_id = _extract_source_id(record)
        if not src_id:
            continue

        relationships_list = record.setdefault("relationships", [])

        for fk_col, cfg in fk_configs.items():
            target_val = record.get(fk_col)
            if target_val is None:
                continue

            target_id_str = str(target_val).strip()
            # Do not create self-loops or blank target IDs
            if not target_id_str or target_id_str == src_id:
                continue

            rel_type = cfg["rel_type"]
            direction = cfg["direction"]
            target_type = cfg["target_type"]

            edge_id = str(uuid.uuid4())
            edge_record = {
                "id": edge_id,
                "tenant_id": str(tenant_id),
                "relationship_type": rel_type,
                "source_entity_id": src_id,
                "target_entity_id": target_id_str,
                "source_entity_type": source_entity_type
                or record.get("entity_type")
                or "Entity",
                "target_entity_type": target_type,
                "direction": direction,
                "confidence": 1.0,
                "properties": json.dumps(
                    {
                        "fk_column": fk_col,
                        "created_by": "relational_edge_generator",
                        "source_entity_type": source_entity_type
                        or record.get("entity_type")
                        or "Entity",
                        "target_entity_type": target_type,
                    }
                ),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            generated_edges.append(edge_record)

            # Append to record relationships array if not already present
            existing_match = any(
                r.get("target_id") == target_id_str and r.get("type") == rel_type
                for r in relationships_list
                if isinstance(r, dict)
            )
            if not existing_match:
                relationships_list.append(
                    {
                        "target_id": target_id_str,
                        "type": rel_type,
                        "direction": direction,
                        "target_type": target_type,
                    }
                )

    logger.info(
        "🔗 Generated %d relational edges across %d records (tenant=%s)",
        len(generated_edges),
        len(records),
        tenant_id,
    )
    return generated_edges


def persist_relational_edges(
    edges: list[dict[str, Any]],
    tenant_id: str = "acme",
    session: Optional[Any] = None,
) -> int:
    """Persist generated relationship edges to the database.

    Inserts rows into the ``relationships`` table with resilient fallback.
    """
    if not edges:
        return 0

    create_sql = text("""
        CREATE TABLE IF NOT EXISTS relationships (
            id VARCHAR(36) PRIMARY KEY,
            tenant_id VARCHAR(255) NOT NULL,
            relationship_type VARCHAR(100) NOT NULL,
            source_entity_id VARCHAR(255) NOT NULL,
            target_entity_id VARCHAR(255) NOT NULL,
            properties TEXT DEFAULT '{}',
            confidence FLOAT DEFAULT 1.0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """)

    insert_sql = text("""
        INSERT INTO relationships (
            id, tenant_id, relationship_type, source_entity_id, target_entity_id,
            properties, confidence, created_at
        ) VALUES (
            :id, :tenant_id, :relationship_type, :source_entity_id, :target_entity_id,
            :properties, :confidence, :created_at
        )
        ON CONFLICT (id) DO UPDATE SET
            properties = EXCLUDED.properties,
            confidence = EXCLUDED.confidence
    """)

    persisted_count = 0

    if session is not None:
        session.execute(create_sql)
        for edge in edges:
            session.execute(
                insert_sql,
                {
                    "id": edge["id"],
                    "tenant_id": edge["tenant_id"],
                    "relationship_type": edge["relationship_type"],
                    "source_entity_id": edge["source_entity_id"],
                    "target_entity_id": edge["target_entity_id"],
                    "properties": edge.get("properties", "{}"),
                    "confidence": float(edge.get("confidence", 1.0)),
                    "created_at": datetime.now(timezone.utc),
                },
            )
            persisted_count += 1
        return persisted_count

    try:
        session_factory = get_session_factory()
        with session_factory() as s:
            s.execute(create_sql)
            for edge in edges:
                s.execute(
                    insert_sql,
                    {
                        "id": edge["id"],
                        "tenant_id": edge["tenant_id"],
                        "relationship_type": edge["relationship_type"],
                        "source_entity_id": edge["source_entity_id"],
                        "target_entity_id": edge["target_entity_id"],
                        "properties": edge.get("properties", "{}"),
                        "confidence": float(edge.get("confidence", 1.0)),
                        "created_at": datetime.now(timezone.utc),
                    },
                )
                persisted_count += 1
            s.commit()
    except Exception as exc:
        logger.warning(
            "Primary DB persistence failed (%s); writing to local SQLite fallback",
            exc,
        )
        try:
            from app.db.session import get_sqlite_engine

            engine = get_sqlite_engine("sqlite_fallback.db")
            with engine.begin() as conn:
                conn.execute(create_sql)
                for edge in edges:
                    conn.execute(
                        insert_sql,
                        {
                            "id": edge["id"],
                            "tenant_id": edge["tenant_id"],
                            "relationship_type": edge["relationship_type"],
                            "source_entity_id": edge["source_entity_id"],
                            "target_entity_id": edge["target_entity_id"],
                            "properties": edge.get("properties", "{}"),
                            "confidence": float(edge.get("confidence", 1.0)),
                            "created_at": datetime.now(timezone.utc),
                        },
                    )
                    persisted_count += 1
        except Exception as sqlite_exc:
            logger.error("SQLite fallback edge persistence also failed: %s", sqlite_exc)

    logger.info(
        "💾 Persisted %d relational edges to database for tenant '%s'",
        persisted_count,
        tenant_id,
    )
    return persisted_count


def publish_relational_edges_to_kafka(
    records: list[dict[str, Any]],
    tenant_id: str,
    source_id: str = "relational-generator",
) -> int:
    """Publish records with resolved relationships to the ``entity.resolved`` Kafka topic."""
    producer = EntityResolvedProducer()
    published_count = 0

    for rec in records:
        relationships = rec.get("relationships")
        if not relationships:
            continue

        golden_id = _extract_source_id(rec)
        if not golden_id:
            continue

        entity_type = str(rec.get("entity_type") or "Entity")
        try:
            success = producer.publish_resolved_entity(
                tenant_id=tenant_id,
                golden_id=golden_id,
                entity_type=entity_type,
                payload=rec,
                source_id=source_id,
            )
            if success:
                published_count += 1
        except Exception as exc:
            logger.warning("Could not publish relational edge event to Kafka: %s", exc)

    return published_count
