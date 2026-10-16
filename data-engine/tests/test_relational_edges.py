import uuid
from fastapi.testclient import TestClient

from app.main import app
from app.processing.er.relational_edges import (
    generate_relational_edges,
    persist_relational_edges,
)
from app.processing.trigger import DagsterTrigger


def test_generate_relational_edges_auto_detection():
    records = [
        {
            "id": "order-1",
            "customer_id": "cust-100",
            "product_id": "prod-500",
            "amount": 99.5,
        },
        {
            "id": "order-2",
            "customer_id": "cust-200",
            "product_id": "prod-500",
            "amount": 49.0,
        },
    ]

    edges = generate_relational_edges(
        records, tenant_id="acme", source_entity_type="Order"
    )

    assert len(edges) == 4
    edge_types = {e["relationship_type"] for e in edges}
    assert "CUSTOMER_OF" in edge_types
    assert "CONTAINS_PRODUCT" in edge_types

    # Ensure record was enriched with relationships
    assert "relationships" in records[0]
    assert len(records[0]["relationships"]) == 2
    rel_targets = {r["target_id"] for r in records[0]["relationships"]}
    assert rel_targets == {"cust-100", "prod-500"}


def test_generate_relational_edges_explicit_dict_mapping():
    records = [
        {"golden_id": "tx-1", "client_num": "cli-777", "branch_code": "br-9"},
    ]
    fks = {
        "client_num": {"target_type": "Client", "rel_type": "TRANSACTED_BY"},
        "branch_code": {"target_type": "Branch", "rel_type": "ORIGINATED_AT"},
    }

    edges = generate_relational_edges(
        records, tenant_id="finance", foreign_keys=fks, source_entity_type="Transaction"
    )

    assert len(edges) == 2
    types = [e["relationship_type"] for e in edges]
    assert "TRANSACTED_BY" in types
    assert "ORIGINATED_AT" in types


def test_generate_relational_edges_ignores_self_loop_and_empty():
    records = [
        {"id": "node-1", "parent_id": "node-1", "empty_id": "", "null_id": None},
    ]
    edges = generate_relational_edges(records, tenant_id="acme")
    assert len(edges) == 0


def test_persist_relational_edges_sqlite():
    edges = [
        {
            "id": f"edge-test-{uuid.uuid4()}",
            "tenant_id": "test-tenant",
            "relationship_type": "BELONGS_TO",
            "source_entity_id": "src-1",
            "target_entity_id": "tgt-1",
            "properties": "{}",
            "confidence": 1.0,
        }
    ]
    persisted = persist_relational_edges(edges, tenant_id="test-tenant")
    assert persisted == 1


def test_dagster_trigger_generate_relational_edges():
    trigger = DagsterTrigger()
    records = [{"id": "item-1", "supplier_id": "sup-42"}]
    edges = trigger.generate_relational_edges(
        tenant_id="acme",
        records=records,
        publish_to_kafka=False,
        persist_to_db=False,
    )
    assert len(edges) == 1
    assert edges[0]["relationship_type"] == "SUPPLIED_BY"


def test_api_generate_relational_edges_endpoint():
    client = TestClient(app)
    payload = {
        "tenant_id": "acme",
        "source_id": "api-test",
        "records": [{"id": "inv-1", "customer_id": "c-101", "total": 200.0}],
        "foreign_keys": {
            "customer_id": {"target_type": "Customer", "rel_type": "BILLED_TO"}
        },
        "publish_to_kafka": False,
        "persist_to_db": False,
    }
    resp = client.post("/process/edges/generate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["edges_count"] == 1
    assert data["edges"][0]["relationship_type"] == "BILLED_TO"
    assert data["edges"][0]["target_entity_id"] == "c-101"
