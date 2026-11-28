"""Regression tests for Knowledge Graph fixes across Data Engine modules."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

from app.config import get_settings
from app.db.tenant import to_uuid_str
from app.processing.er.golden_record.merging import merge_cluster_to_golden_record
from app.processing.er.relational_decomposer import RelationalDecomposer
from app.processing.pipelines.er_pipeline.golden_ops import (
    synthesize_and_persist_golden_records,
)
from app.processing.reconciliation.reconciler import CrossStoreReconciler
from app.processing.trigger.edges_trigger import execute_generate_relational_edges


def test_to_uuid_str_unwraps_gr_prefixed_uuids_consistently():
    raw_uuid = "5fc38c8e-a3a3-42e6-bd6a-9f7698869e5f"
    assert to_uuid_str(f"gr-{raw_uuid}") == raw_uuid
    assert to_uuid_str(raw_uuid) == raw_uuid
    assert uuid.UUID(to_uuid_str("gr-100")) == uuid.uuid5(uuid.NAMESPACE_DNS, "gr-100")


def test_merge_cluster_emits_canonical_uuid_without_gr_prefix():
    cluster = [
        {"id": "row-1", "raw_id": "row-1", "name": "Volta Freight", "entity_type": "Carrier"}
    ]
    gr = merge_cluster_to_golden_record(cluster, tenant_id="luminex")
    parsed = uuid.UUID(gr["golden_id"])
    assert str(parsed) == gr["golden_id"]
    assert not gr["golden_id"].startswith("gr-")


def test_golden_ops_normalizes_gr_uuid_and_attaches_fk_edges():
    import polars as pl
    from dagster import build_asset_context

    raw_uuid = "5fc38c8e-a3a3-42e6-bd6a-9f7698869e5f"
    staged_df = pl.DataFrame(
        [
            {
                "id": "ord-1",
                "raw_id": "ord-1",
                "name": "ORD-1",
                "customer_id": "CUST-42",
                "entity_type": "Order",
            }
        ]
    )
    pairs_df = pl.DataFrame(
        schema={
            "id_1": pl.Utf8,
            "id_2": pl.Utf8,
            "confidence_score": pl.Float64,
            "decision": pl.Utf8,
        }
    )

    captured_calls = []

    class FakeProducer:
        def publish_resolved_entity(self, **kwargs):
            captured_calls.append(kwargs)
            return True

        def publish_batch_completion(self, **kwargs):
            return True

    ctx = build_asset_context(
        run_tags={
            "tenant_id": "luminex",
            "connection_id": str(uuid.uuid4()),
            "entity_type": "Order",
            "foreign_keys": '{"customer_id": {"target_type": "Customer", "rel_type": "PLACED_BY"}}',
        }
    )

    with (
        patch(
            "app.processing.pipelines.er_pipeline.golden_ops.merge_clusters_to_golden_records"
        ) as mock_merge,
        patch(
            "app.processing.pipelines.er_pipeline.golden_ops.persist_golden_records",
            return_value=1,
        ),
        patch(
            "app.processing.pipelines.er_pipeline.golden_ops.persist_provenance_records",
            return_value=0,
        ),
        patch(
            "app.processing.pipelines.er_pipeline.golden_ops.EntityResolvedProducer",
            return_value=FakeProducer(),
        ),
    ):
        mock_merge.return_value = pl.DataFrame(
            [
                {
                    "golden_id": f"gr-{raw_uuid}",
                    "tenant_id": "luminex",
                    "entity_type": "Order",
                    "canonical_name": "ORD-1",
                    "source_record_ids": ["ord-1"],
                    "customer_id": "CUST-42",
                }
            ]
        )
        synthesize_and_persist_golden_records(ctx, pairs_df, staged_df)

    assert len(captured_calls) == 1
    call = captured_calls[0]
    assert call["golden_id"] == raw_uuid
    assert call["payload"]["golden_id"] == raw_uuid
    assert call["payload"]["raw_golden_id"] == f"gr-{raw_uuid}"
    rels = call["payload"].get("relationships", [])
    assert len(rels) == 1
    assert rels[0]["target_id"] == "CUST-42"
    assert rels[0]["type"] == "PLACED_BY"


def test_relational_decomposer_attaches_labels_on_primary_and_secondary_nodes():
    decomposer = RelationalDecomposer()
    res = decomposer.decompose(
        records=[
            {
                "patient_id": "P-100",
                "patient_name": "Kofi Mensah",
                "doctor_id": "D-9",
                "physician_name": "Dr. Ama Boateng",
            }
        ],
        primary_entity_type="Patient",
        primary_id_col="patient_id",
    )
    by_type = {n["entity_type"]: n for n in res.nodes}
    assert by_type["Patient"]["label"] == "Kofi Mensah"
    assert by_type["Patient"]["canonical_name"] == "Kofi Mensah"
    assert by_type["Physician"]["label"] == "Dr. Ama Boateng"
    assert by_type["Physician"]["canonical_name"] == "Dr. Ama Boateng"


def test_edges_trigger_loads_postgres_staged_records_with_tenant_schema():
    fake_row = MagicMock()
    fake_row.id = "ord-99"
    fake_row.data = '{"order_id": "ord-99", "customer_id": "cust-7", "_entity_type": "Order"}'

    fake_conn = MagicMock()
    fake_conn.dialect.name = "postgresql"
    fake_conn.execute.return_value.fetchall.return_value = [fake_row]
    fake_engine = MagicMock()
    fake_engine.connect.return_value.__enter__.return_value = fake_conn

    with (
        patch("app.db.session.get_engine", return_value=fake_engine),
        patch(
            "app.db.tenant.resolve_tenant_pg_context",
            return_value={
                "schema_name": "tenant_luminex",
                "tenant_raw": "luminex",
                "tenant_slug": "luminex",
                "tenant_uuid": "00000000-0000-0000-0000-000000000099",
            },
        ),
        patch(
            "app.db.tenant.resolve_table_schema",
            return_value=("tenant_luminex", {"id", "tenant_id", "data"}),
        ),
        patch("app.db.tenant.set_pg_search_path") as mock_set_sp,
        patch("app.db.tenant.reset_pg_search_path") as mock_reset_sp,
    ):
        edges = execute_generate_relational_edges(
            tenant_id="luminex",
            records=None,
            source_entity_type="Order",
            persist_to_db=False,
            publish_to_kafka=False,
        )

    mock_set_sp.assert_called_once_with(fake_conn, "tenant_luminex")
    mock_reset_sp.assert_called_once_with(fake_conn)
    assert len(edges) == 1
    assert edges[0]["target_entity_id"] == "cust-7"
    assert edges[0]["relationship_type"] == "CUSTOMER_OF"


def test_reconciler_queries_neo4j_with_normalized_tenant_ids_and_configurable_opensearch_url():
    assert hasattr(get_settings(), "opensearch_url")
    reconciler = CrossStoreReconciler(tenant_id="luminex", entity_type="Person")
    fake_session = MagicMock()
    fake_session.run.return_value = []
    fake_driver = MagicMock()
    fake_driver.__enter__.return_value = fake_driver
    fake_driver.session.return_value.__enter__.return_value = fake_session

    fake_neo4j = MagicMock()
    fake_neo4j.GraphDatabase.driver.return_value = fake_driver

    with patch.dict("sys.modules", {"neo4j": fake_neo4j}):
        reconciler.fetch_neo4j_records()

    run_kwargs = fake_session.run.call_args.kwargs
    assert "luminex" in run_kwargs["tenantIds"]
    assert to_uuid_str("luminex") in run_kwargs["tenantIds"]
