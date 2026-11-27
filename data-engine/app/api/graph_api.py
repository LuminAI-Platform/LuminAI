"""Graph intelligence and relational decomposition endpoints.

POST /analytics/graph/decompose -> Decomposes flat tabular records into multi-class entity graph
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.processing.er.relational_decomposer import (
    DecompositionRule,
    RelationalDecomposer,
)

router = APIRouter(prefix="/analytics/graph", tags=["Graph Intelligence"])


class DecompositionRuleModel(BaseModel):
    """Schema for custom entity extraction rules."""

    target_entity_type: str = Field(..., description="Target node entity type (e.g. Physician).")
    relationship_type: str = Field(..., description="Typed relationship name (e.g. TREATED_BY).")
    id_column: Optional[str] = Field(None, description="Column containing unique identifier/code.")
    name_column: Optional[str] = Field(None, description="Column containing entity name.")
    attribute_columns: List[str] = Field(default_factory=list, description="Columns to attach as entity properties.")
    direction: str = Field(default="OUTGOING", description="Relationship direction.")


class DecomposeRequest(BaseModel):
    """Request payload for multi-class relational decomposition."""

    records: List[Dict[str, Any]] = Field(..., description="Flat tabular records to decompose.")
    primary_entity_type: str = Field(default="Record", description="Primary entity type (e.g. Patient, Order).")
    primary_id_column: Optional[str] = Field(None, description="Column for primary record identifier.")
    rules: Optional[List[DecompositionRuleModel]] = Field(
        None, description="Optional custom extraction rules. If omitted, inferred automatically."
    )


class DecomposeResponse(BaseModel):
    """Response payload containing extracted graph nodes and typed edges."""

    primary_entity_type: str
    total_nodes: int
    total_edges: int
    node_counts_by_type: Dict[str, int]
    edge_counts_by_type: Dict[str, int]
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]


@router.post(
    "/decompose",
    response_model=DecomposeResponse,
    summary="Decompose flat records into multi-class entity graph nodes and edges",
)
def decompose_records(request: DecomposeRequest) -> DecomposeResponse:
    """Decompose denormalized tabular rows into a structured knowledge graph."""
    if not request.records:
        raise HTTPException(status_code=400, detail="records list cannot be empty")

    decomposer = RelationalDecomposer()
    rules = None
    if request.rules:
        rules = [
            DecompositionRule(
                target_entity_type=r.target_entity_type,
                relationship_type=r.relationship_type,
                id_column=r.id_column,
                name_column=r.name_column,
                attribute_columns=r.attribute_columns,
                direction=r.direction,
            )
            for r in request.rules
        ]

    try:
        res = decomposer.decompose(
            records=request.records,
            primary_entity_type=request.primary_entity_type,
            primary_id_col=request.primary_id_column,
            rules=rules,
        )
        return DecomposeResponse(
            primary_entity_type=res.primary_entity_type,
            total_nodes=res.total_nodes,
            total_edges=res.total_edges,
            node_counts_by_type=res.node_counts_by_type,
            edge_counts_by_type=res.edge_counts_by_type,
            nodes=res.nodes,
            edges=res.edges,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Graph decomposition failed: {exc}")
