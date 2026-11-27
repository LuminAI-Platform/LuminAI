"""Tests for large-dataset streaming bounds, clean-preview optimization, and checkpoint cleanup."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from dagster import build_asset_context
from fastapi.testclient import TestClient

from app.main import app
from app.processing.engine.dataset_cleaner import DatasetCleaner
from app.processing.minio_client import MinioRawStorageClient
from app.processing.pipelines.cleaning_pipeline import raw_ingestion_data
from app.processing.trigger import DagsterTrigger


def test_clean_dataset_sync_skips_golden_records_when_opted_out():
    """POST /process/dataset/clean omits goldenRecords bloat when include_golden_records=False."""
    client = TestClient(app)
    rows = [
        {"id": "1", "name": "Alice Smith", "email": "alice@example.com", "amount": 100.5},
        {"id": "2", "name": "Bob Jones", "email": "bob@example.com", "amount": 250.0},
        {"id": "3", "name": "Alice Smith", "email": "alice@example.com", "amount": 100.5},
    ]

    compact_resp = client.post(
        "/process/dataset/clean",
        json={
            "tenant_id": "acme",
            "source_id": "conn-1",
            "rows": rows,
            "options": {"include_golden_records": False},
        },
    )
    assert compact_resp.status_code == 200
    compact_body = compact_resp.json()
    assert compact_body["status"] == "COMPLETED"
    assert compact_body["totalRawRecords"] == 3
    assert compact_body["duplicatesMerged"] == 1
    assert compact_body["totalCleanRecords"] == 2
    assert compact_body["goldenRecords"] == []
    assert len(compact_body["rows"]) == 2

    full_resp = client.post(
        "/process/dataset/clean",
        json={"tenant_id": "acme", "source_id": "conn-1", "rows": rows},
    )
    assert full_resp.status_code == 200
    assert len(full_resp.json()["goldenRecords"]) >= 1


def test_dataset_cleaner_precomputed_assessments_match_default():
    """Pre-classified column roles and precomputed assessments match standard results accurately."""
    import polars as pl

    rows = [
        {"id": f"r-{i}", "name": f"User {i}", "email": f"u{i}@test.com", "metric_1": i * 1.5}
        for i in range(50)
    ]
    df = pl.DataFrame(rows)
    res_full = DatasetCleaner(tenant_id="t1").process_dataframe(df, build_golden_records=True)
    res_preview = DatasetCleaner(tenant_id="t1").process_dataframe(df, build_golden_records=False)

    assert res_full.total_clean_records == res_preview.total_clean_records == 50
    assert res_full.data_quality_score == res_preview.data_quality_score
    assert res_preview.golden_records == []


def test_minio_load_dataframe_bounded_caps_large_csv(tmp_path):
    """load_dataframe_bounded reads only bounded line/byte windows without loading entire large CSVs."""
    client = MinioRawStorageClient(
        endpoint="127.0.0.1:59999",
        local_fallback_dir=str(tmp_path),
    )
    csv_lines = ["id,name,email,amount"] + [
        f"id-{i},Person {i},person{i}@example.com,{i * 10}"
        for i in range(1, 501)
    ]
    payload = ("\n".join(csv_lines) + "\n").encode("utf-8")
    client.put_object_bytes("luminai-raw", "tenant/raw/conn/big.csv", payload)

    bounded_df = client.load_dataframe_bounded(
        "luminai-raw",
        "tenant/raw/conn/big.csv",
        max_rows=50,
        max_bytes=1024 * 1024,
    )
    assert bounded_df.height == 50
    assert bounded_df["id"][0] == "id-1"
    assert bounded_df["id"][49] == "id-50"


def test_raw_ingestion_data_uses_bounded_loader_for_large_tags(monkeypatch, tmp_path):
    """raw_ingestion_data honors max_rows/max_bytes run tags to protect worker memory."""
    client = MinioRawStorageClient(
        endpoint="127.0.0.1:59999",
        local_fallback_dir=str(tmp_path),
    )
    monkeypatch.setattr(
        "app.processing.pipelines.cleaning_pipeline.get_minio_client", lambda: client
    )
    csv_lines = ["id,name,email"] + [
        f"rec-{i},Name {i},n{i}@corp.com" for i in range(1, 301)
    ]
    client.put_object_bytes(
        "luminai-raw", "huge.csv", ("\n".join(csv_lines) + "\n").encode("utf-8")
    )

    ctx = build_asset_context(
        run_tags={
            "object_key": "huge.csv",
            "bucket": "luminai-raw",
            "max_rows": "25",
            "max_bytes": "524288",
        }
    )
    df = raw_ingestion_data(ctx)
    assert df.height == 25


def test_trigger_sets_bounded_tags_and_clears_checkpoints(monkeypatch):
    """DagsterTrigger passes max_rows/max_bytes for object_key runs and clears checkpoints on success."""
    mock_result = MagicMock()
    mock_result.success = True
    mock_result.run_id = "dagster-run-999"
    mock_result.all_events = []

    cleared: list[str] = []
    mock_cp = MagicMock()
    mock_cp.clear_checkpoints.side_effect = lambda rid: cleared.append(rid)

    with (
        patch("app.processing.trigger.materialize", return_value=mock_result) as mock_mat,
        patch("app.processing.checkpoint.get_checkpoint_manager", return_value=mock_cp),
    ):
        trigger = DagsterTrigger()
        run_id = trigger.trigger_cleaning_pipeline(
            tenant_id="acme",
            source_id="src-big",
            batch_metadata={
                "object_key": "acme/raw/src-big/100k.csv",
                "totalRows": 100000,
                "file_size_bytes": 120_000_000,
            },
            run_id="run-bounded-1",
        )

    assert run_id == "dagster-run-999"
    tags = mock_mat.call_args.kwargs["tags"]
    assert tags["source_total_rows"] == "100000"
    assert tags["file_size_bytes"] == "120000000"
    assert int(tags["max_rows"]) > 0
    assert int(tags["max_bytes"]) > 0
    assert cleared == ["run-bounded-1"]
