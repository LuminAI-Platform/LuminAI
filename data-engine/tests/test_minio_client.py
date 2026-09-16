"""Tests for MinIO/S3 Raw Storage Client."""

import io
import shutil
import tempfile
import polars as pl
import pytest
from dagster import build_asset_context

from app.processing.minio_client import MinioRawStorageClient
from app.processing.pipelines.cleaning_pipeline import raw_ingestion_data


@pytest.fixture
def temp_storage():
    """Create a temporary directory for local raw storage tests."""
    temp_dir = tempfile.mkdtemp(prefix="luminai_minio_test_")
    yield temp_dir
    shutil.rmtree(temp_dir, ignore_errors=True)


def test_minio_sigv4_headers():
    """Verify AWS SigV4 authorization headers are generated properly."""
    client = MinioRawStorageClient(
        endpoint="localhost:9000",
        access_key="minioadmin",
        secret_key="minioadmin",
        secure=False,
        region="us-east-1",
    )
    headers = client._build_sigv4_headers("GET", "/luminai-raw/test.csv")
    assert "Authorization" in headers
    assert headers["Authorization"].startswith("AWS4-HMAC-SHA256 Credential=minioadmin/")
    assert "x-amz-date" in headers
    assert "x-amz-content-sha256" in headers
    assert headers["Host"] == "localhost:9000"


def test_put_and_get_local_fallback(temp_storage):
    """Verify object bytes are persisted and retrievable via local filesystem fallback."""
    client = MinioRawStorageClient(local_fallback_dir=temp_storage)
    payload = b"id,name,email\nrec-1,Alice,alice@example.com\n"
    
    success = client.put_object_bytes("test-bucket", "uploads/test.csv", payload)
    assert success is True

    fetched = client.get_object_bytes("test-bucket", "uploads/test.csv")
    assert fetched == payload


def test_load_dataframe_csv(temp_storage):
    """Verify CSV files with messy column whitespace and missing id are parsed cleanly."""
    client = MinioRawStorageClient(local_fallback_dir=temp_storage)
    csv_data = (
        b"  name  , email , age \n"
        b" Bob Jones , bob@test.com , 40 \n"
        b" Charlie , charlie@test.com , 35 \n"
    )
    client.put_object_bytes("test-bucket", "data.csv", csv_data)

    df = client.load_dataframe("test-bucket", "data.csv")
    assert isinstance(df, pl.DataFrame)
    assert df.height == 2
    # Check whitespace stripped from column headers
    assert "name" in df.columns
    assert "email" in df.columns
    assert "age" in df.columns
    # Check deterministic ID column generated
    assert "id" in df.columns
    assert df["id"].to_list() == ["rec-0001", "rec-0002"]


def test_load_dataframe_parquet(temp_storage):
    """Verify Parquet file loading."""
    client = MinioRawStorageClient(local_fallback_dir=temp_storage)
    source_df = pl.DataFrame({
        "id": ["p-1", "p-2"],
        "metric": [10.5, 20.8],
    })
    buf = io.BytesIO()
    source_df.write_parquet(buf)
    client.put_object_bytes("test-bucket", "data.parquet", buf.getvalue())

    df = client.load_dataframe("test-bucket", "data.parquet")
    assert df.height == 2
    assert "metric" in df.columns
    assert "id" in df.columns


def test_load_dataframe_json(temp_storage):
    """Verify JSON file loading."""
    client = MinioRawStorageClient(local_fallback_dir=temp_storage)
    json_data = b'[{"id": "j-1", "product": "Widget A"}, {"id": "j-2", "product": "Widget B"}]'
    client.put_object_bytes("test-bucket", "data.json", json_data)

    df = client.load_dataframe("test-bucket", "data.json")
    assert df.height == 2
    assert "product" in df.columns
    assert "id" in df.columns


def test_object_exists(temp_storage):
    """Verify object_exists returns True when present, False when absent."""
    client = MinioRawStorageClient(local_fallback_dir=temp_storage)
    assert not client.object_exists("test-bucket", "non_existent.csv")

    client.put_object_bytes("test-bucket", "existing.csv", b"a,b\n1,2\n")
    assert client.object_exists("test-bucket", "existing.csv")


def test_raw_ingestion_asset_with_minio_tags(temp_storage, monkeypatch):
    """Verify raw_ingestion_data loads actual data from MinIO client when object_key is in tags."""
    client = MinioRawStorageClient(local_fallback_dir=temp_storage)
    monkeypatch.setattr("app.processing.pipelines.cleaning_pipeline.get_minio_client", lambda: client)

    # Store a test CSV file in the test client
    csv_content = (
        b"id,name,email,age,country,joined_at,score,salary\n"
        b"rec-999,Enterprise User,user@enterprise.org,45,US,2024-01-01,0.99,$5000\n"
    )
    client.put_object_bytes("luminai-raw", "tenant-1/raw/data.csv", csv_content)

    # Run raw_ingestion_data asset with tags
    ctx = build_asset_context(
        run_tags={
            "object_key": "tenant-1/raw/data.csv",
            "bucket": "luminai-raw",
        }
    )
    df = raw_ingestion_data(ctx)

    assert df.height == 1
    assert df["id"][0] == "rec-999"
    assert df["name"][0] == "Enterprise User"
    assert df["email"][0] == "user@enterprise.org"


def test_raw_ingestion_asset_fallback_on_missing_file(monkeypatch):
    """Verify raw_ingestion_data falls back to synthetic dataset if object_key is missing or fails."""
    ctx = build_asset_context(
        run_tags={
            "object_key": "does-not-exist/missing.csv",
            "bucket": "luminai-raw",
        }
    )
    df = raw_ingestion_data(ctx)
    # Synthetic dataset should be returned
    assert df.height == 10
    assert "rec-001" in df["id"].to_list()
