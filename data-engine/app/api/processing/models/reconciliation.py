"""Reconciliation and relational edge request/response Pydantic models."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ReconciliationRequest(BaseModel):
    """Request payload schema for executing Cross-Store Data Reconciliation."""

    tenant_id: str = Field(
        default="acme",
        description="Tenant identifier to reconcile across stores.",
        examples=["acme"],
    )
    entity_type: str = Field(
        default="Person",
        description="Ontology entity type to verify.",
        examples=["Person"],
    )
    pg_records: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Optional explicit PostgreSQL records payload override.",
    )
    neo4j_records: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Optional explicit Neo4j records payload override.",
    )
    opensearch_records: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Optional explicit OpenSearch records payload override.",
    )


class RelationalEdgeTriggerRequest(BaseModel):
    """Request payload for triggering relational edge generation."""

    tenant_id: str = Field(
        ...,
        description="Tenant identifier scoping the pipeline run.",
        examples=["acme"],
    )
    source_id: str = Field(
        default="default-source",
        description="ID of the data source.",
    )
    records: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Optional explicit records list. If omitted, uses staged records.",
    )
    foreign_keys: Optional[Any] = Field(
        default=None,
        description="Foreign key definitions mapping column names to target entities.",
    )
    source_entity_type: Optional[str] = Field(
        default=None,
        description="Entity type for the source records.",
    )
    publish_to_kafka: bool = Field(
        default=True,
        description="Whether to publish generated graph relationships to Kafka.",
    )
    persist_to_db: bool = Field(
        default=True,
        description="Whether to persist generated edges to the database.",
    )


class RelationalEdgeTriggerResponse(BaseModel):
    """Response payload for generated relational edges."""

    tenant_id: str
    edges_count: int
    edges: List[Dict[str, Any]]
