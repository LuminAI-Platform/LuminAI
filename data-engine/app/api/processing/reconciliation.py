"""Cross-store data reconciliation and relational graph edge generation endpoints.

Endpoints:
  POST /reconciliation   → Execute drift detection comparing PG, Neo4j, and OpenSearch.
  POST /edges/generate   → Generate directional relational graph edges via foreign keys.
"""

from fastapi import APIRouter

from app.api.processing.models import (
    ReconciliationRequest,
    RelationalEdgeTriggerRequest,
    RelationalEdgeTriggerResponse,
)
from app.processing.reconciliation import (
    ReconciliationReport,
    run_cross_store_reconciliation,
)
from app.processing.trigger import DagsterTrigger

router = APIRouter()


@router.post(
    "/reconciliation",
    response_model=ReconciliationReport,
    summary="Execute Cross-Store Data Reconciliation",
)
async def execute_reconciliation(
    request: ReconciliationRequest,
) -> ReconciliationReport:
    """Execute cross-store reconciliation comparing PostgreSQL, Neo4j, and OpenSearch."""
    report = run_cross_store_reconciliation(
        tenant_id=request.tenant_id,
        entity_type=request.entity_type,
        pg_records=request.pg_records,
        neo4j_records=request.neo4j_records,
        opensearch_records=request.opensearch_records,
    )
    return report


@router.post(
    "/edges/generate",
    response_model=RelationalEdgeTriggerResponse,
    summary="Generate cross-entity relational edges using foreign keys",
)
async def generate_relational_edges_endpoint(
    payload: RelationalEdgeTriggerRequest,
) -> RelationalEdgeTriggerResponse:
    """Generate directional relational graph edges linking entities via foreign keys."""
    trigger = DagsterTrigger()
    edges = trigger.generate_relational_edges(
        tenant_id=payload.tenant_id,
        records=payload.records,
        foreign_keys=payload.foreign_keys,
        source_id=payload.source_id,
        source_entity_type=payload.source_entity_type,
        publish_to_kafka=payload.publish_to_kafka,
        persist_to_db=payload.persist_to_db,
    )
    return RelationalEdgeTriggerResponse(
        tenant_id=payload.tenant_id,
        edges_count=len(edges),
        edges=edges,
    )
