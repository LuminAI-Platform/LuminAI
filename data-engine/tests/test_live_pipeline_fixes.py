"""Regression tests for live ingestion, tenant schema routing, and dynamic naming."""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from dagster import build_asset_context
import polars as pl

from app.config import Settings
from app.db.tenant import set_pg_search_path
from app.kafka.consumers import IngestRawConsumer
from app.processing.engine.dataset_cleaner import DatasetCleaner
from app.processing.engine.golden_record_engine import GoldenRecordEngine
from app.processing.er.golden_record.merging import merge_cluster_to_golden_record
from app.processing.er.provenance import track_field_provenance
from app.processing.pipelines import cleaning_pipeline
from app.processing.trigger.cleaning_trigger import execute_cleaning_pipeline


def test_inline_rows_work_in_production_without_minio(tmp_path):
    """execute_cleaning_pipeline stages inline Kafka rows so raw_ingestion_data works in prod without MinIO."""
    from app.processing.checkpoint import CheckpointManager

    prod_settings = Settings(environment="production", allow_synthetic_data=False)
    cp_mgr = CheckpointManager(base_dir=str(tmp_path / "cp"))

    rows = [
        {
            "company_name": "Luminex Logistics",
            "email": "ops@luminex-logistics.com",
            "country": "GH",
        }
    ]
    captured_tags = {}

    def fake_materialize(**kwargs):
        captured_tags.update(kwargs.get("tags", {}))
        ctx = build_asset_context(run_tags=captured_tags)
        loaded = cleaning_pipeline.raw_ingestion_data(ctx)
        assert loaded.height == 1
        assert loaded["company_name"][0] == "Luminex Logistics"
        res = MagicMock()
        res.success = True
        res.run_id = "dag-inline-1"
        res.all_events = []
        return res

    with (
        patch("app.processing.trigger.cleaning_trigger.get_settings", return_value=prod_settings),
        patch("app.processing.checkpoint.get_checkpoint_manager", return_value=cp_mgr),
        patch("app.processing.pipelines.cleaning_pipeline.get_settings", return_value=prod_settings),
        patch(
            "app.processing.pipelines.cleaning_pipeline.assets.get_checkpoint_manager",
            return_value=cp_mgr,
        ),
        patch("app.processing.trigger.materialize", side_effect=fake_materialize),
    ):
        execute_cleaning_pipeline(
            trigger_instance=MagicMock(),
            tenant_id="luminex",
            source_id="conn-123",
            batch_metadata={
                "source": "luminex_carriers.csv",
                "rows": rows,
                "batch_complete": True,
                "auto_er": False,
                "generate_edges": False,
            },
            run_id="run-inline-1",
        )
        assert captured_tags["source_name"] == "luminex_carriers.csv"


def test_dynamic_canonical_name_and_entity_type_resolution():
    """Domain datasets resolve real names and entity types instead of Unnamed Entity or rec-0001."""
    ship_row = {"tracking_number": "TRK-9001", "carrier_name": "DHL Cargo", "origin": "Accra"}
    assert GoldenRecordEngine.resolve_canonical_name(ship_row) == "DHL Cargo"
    assert GoldenRecordEngine.infer_entity_type(ship_row) == "Shipment"

    df = pl.DataFrame(
        [
            {"order_id": "ORD-42", "customer_name": "Kofi Mensah", "amount": 500.0},
        ]
    )
    cleaned = DatasetCleaner(tenant_id="luminex").process_dataframe(df, entity_type_hint=None)
    assert cleaned.records[0].canonical_name == "Kofi Mensah"
    assert cleaned.records[0].entity_type == "Transaction"
    assert cleaned.golden_records[0].canonical_name == "Kofi Mensah"


def test_merge_cluster_and_provenance_preserve_source_and_entity_type():
    """merge_cluster_to_golden_record keeps entity_type and source metadata while track_field_provenance ignores _ internals."""
    cluster = [
        {
            "id": "r1",
            "company_name": "Tema Port Coldstore",
            "_entity_type": "Organization",
            "_source_name": "partners.csv",
            "_connection_id": "11111111-1111-1111-1111-111111111111",
        }
    ]
    merged = merge_cluster_to_golden_record(cluster, tenant_id="luminex")
    assert merged["entity_type"] == "Organization"
    assert merged["canonical_name"] == "Tema Port Coldstore"
    assert merged["_source_name"] == "partners.csv"
    assert merged["_connection_id"] == "11111111-1111-1111-1111-111111111111"

    prov = track_field_provenance(merged, cluster, tenant_id="luminex")
    attr_names = {entry["attribute_name"] for entry in prov}
    assert "_source_name" not in attr_names
    assert "_connection_id" not in attr_names
    assert "company_name" in attr_names
    assert prov[0]["source_id"] == "11111111-1111-1111-1111-111111111111"


def test_ingest_raw_consumer_combines_multi_chunk_rows():
    """IngestRawConsumer buffers non-final chunks and combines them on batch_complete=True."""
    consumer = IngestRawConsumer()
    cb = MagicMock()
    consumer.on_batch_complete = cb

    consumer.handle("luminex:c1", {"tenant_id": "luminex", "source_id": "c1", "rows": [{"id": 1}], "batch_complete": False})
    cb.assert_not_called()

    consumer.handle("luminex:c1", {"tenant_id": "luminex", "source_id": "c1", "rows": [{"id": 2}], "batch_complete": True})
    cb.assert_called_once()
    delivered = cb.call_args[0][2]
    assert delivered["rows"] == [{"id": 1}, {"id": 2}]


def test_set_pg_search_path_preserves_public_schema():
    """set_pg_search_path('public') does not rewrite schema to tenant_public."""
    conn = MagicMock()
    conn.dialect.name = "postgresql"
    set_pg_search_path(conn, "public")
    sql_executed = str(conn.execute.call_args[0][0])
    assert "tenant_public" not in sql_executed
    assert "SET search_path TO public" in sql_executed
