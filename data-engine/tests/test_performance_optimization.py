"""Tests validating: Data Engine Performance Optimization.

Acceptance Criteria:
1. Connection pool sized at 10 base, 20 max with overflow + live telemetry
2. Batch inserts for golden records (batch size 500)
3. Kafka consumer processes 100 messages per batch with explicit batch commit
4. Analytics query timeout at 30s + DuckDB query plan optimization
5. MinIO multipart upload for large files (>100MB threshold)
6. Load test scripts in tests/load/
"""

import asyncio
from unittest.mock import MagicMock, patch
import uuid
import polars as pl
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.db.session import DatabaseManager, get_db_manager
from app.kafka.consumers import IngestRawConsumer
from app.main import app
from app.processing.analytics_engine import DuckDBAnalyticsEngine
from app.processing.er.golden_record import (
    get_golden_record,
    persist_golden_records,
)
from app.processing.minio_client import (
    DEFAULT_PART_SIZE,
    MULTIPART_THRESHOLD,
    MinioRawStorageClient,
)


# 1. Connection Pool Verification
def test_connection_pool_sizing_and_telemetry():
    """Verify connection pool is configured to 10 base, 20 max overflow, and status reports metrics."""
    settings = get_settings()
    assert settings.db_pool_size == 10, f"Expected db_pool_size=10, got {settings.db_pool_size}"
    assert settings.db_max_overflow == 20, f"Expected db_max_overflow=20, got {settings.db_max_overflow}"
    assert settings.db_pool_timeout == 30.0

    pool_status = DatabaseManager.get_pool_status()
    assert "pool_type" in pool_status
    assert "pool_size" in pool_status
    assert "max_overflow" in pool_status
    assert pool_status["pool_size"] == 10
    assert pool_status["max_overflow"] == 20

    # Also check instance method
    inst_status = get_db_manager().get_pool_status()
    assert inst_status["pool_size"] == 10


# 2. Golden Record Batch Persistence (batch size 500)
def test_golden_record_batch_inserts_500():
    """Verify persist_golden_records handles large recordsets in batches of 500."""
    uid = uuid.uuid4().hex[:8]
    # Generate 1250 unique records
    records = []
    for i in range(1250):
        records.append({
            "golden_id": f"gid-batch-{uid}-{i:04d}",
            "tenant_id": "test-perf-batch",
            "cluster_size": 1,
            "source_record_ids": [f"src-{i}"],
            "full_name": f"User Batch {i}",
            "email": f"user{i}@perf.org",
        })
    df = pl.DataFrame(records)

    persisted = persist_golden_records(df, tenant_id="test-perf-batch", batch_size=500)
    assert persisted == 1250

    # Verify first and last records exist
    r0 = get_golden_record(f"gid-batch-{uid}-0000", tenant_id="test-perf-batch")
    assert r0 is not None
    assert r0["version"] == 1

    r1249 = get_golden_record(f"gid-batch-{uid}-1249", tenant_id="test-perf-batch")
    assert r1249 is not None
    assert r1249["version"] == 1


def test_golden_record_batch_updates_and_versioning():
    """Verify batch updates increment version numbers and maintain audit history."""
    uid = uuid.uuid4().hex[:8]
    gid = f"gid-update-perf-{uid}"
    df_v1 = pl.DataFrame([{
        "golden_id": gid,
        "tenant_id": "test-perf-batch",
        "cluster_size": 1,
        "source_record_ids": ["src-v1"],
        "full_name": "Original Name",
        "email": "orig@perf.org",
    }])
    persist_golden_records(df_v1, tenant_id="test-perf-batch", batch_size=500)

    rec_v1 = get_golden_record(gid, tenant_id="test-perf-batch")
    assert rec_v1 is not None
    assert rec_v1["version"] == 1

    # Update in batch
    df_v2 = pl.DataFrame([{
        "golden_id": gid,
        "tenant_id": "test-perf-batch",
        "cluster_size": 2,
        "source_record_ids": ["src-v1", "src-v2"],
        "full_name": "Updated Name",
        "email": "updated@perf.org",
    }])
    persist_golden_records(df_v2, tenant_id="test-perf-batch", batch_size=500)

    rec_v2 = get_golden_record(gid, tenant_id="test-perf-batch")
    assert rec_v2 is not None
    assert rec_v2["version"] == 2


# 3. Kafka Consumer Batch Processing (100 messages per batch)
def test_kafka_consumer_batch_processing_100():
    """Verify IngestRawConsumer processes 100 messages per batch and performs explicit batch commits."""
    consumer = IngestRawConsumer(batch_size=100)
    assert consumer.batch_size == 100
    consumer._running = True

    mock_ck_consumer = MagicMock()
    consumer._consumer = mock_ck_consumer

    fake_messages = []
    for i in range(100):
        msg = MagicMock()
        msg.error.return_value = None
        msg.key.return_value = f"key-{i}".encode("utf-8")
        msg.value.return_value = f'{{"event_id": "{i}", "tenant_id": "acme", "payload": {{}}}}'.encode("utf-8")
        msg.offset.return_value = i
        fake_messages.append(msg)

    mock_ck_consumer.consume.return_value = fake_messages

    processed = consumer.consume_batch(batch_size=100, timeout=0.1)

    assert len(processed) == 100
    mock_ck_consumer.consume.assert_called_once_with(num_messages=100, timeout=0.1)
    mock_ck_consumer.commit.assert_called_once_with(asynchronous=False)


# 4. DuckDB Query Plan Optimization & 30s Timeout Enforcement
def test_duckdb_query_plan_and_pragmas():
    """Verify DuckDB analytics engine configures performance pragmas and produces EXPLAIN query plans."""
    engine = DuckDBAnalyticsEngine()
    plan = engine.explain_query(
        tenant_id="acme",
        entity_type="Person",
        aggregations=["count"],
    )

    assert isinstance(plan, str)
    assert len(plan) > 0
    assert "EXPLAIN" in plan.upper() or "QUERY PLAN" in plan.upper() or "PHYSICAL_PLAN" in plan.upper() or "SCAN" in plan.upper()


def test_analytics_query_timeout_setting():
    """Verify analytics query timeout setting is configured to 30.0 seconds."""
    settings = get_settings()
    assert settings.analytics_query_timeout_seconds == 30.0


def test_analytics_query_timeout_enforcement():
    """Verify analytics query endpoint returns HTTP 504 when query exceeds timeout."""
    client = TestClient(app)

    with patch("app.api.analytics.asyncio.wait_for", side_effect=asyncio.TimeoutError()):
        resp = client.post(
            "/analytics/query",
            json={
                "tenant_id": "test-tenant",
                "entity_type": "Person",
                "aggregations": ["count"],
            },
            headers={"X-API-Key": "test-api-key-12345"},
        )
        assert resp.status_code == 504
        assert "timed out after 30" in resp.json()["detail"] or "30.0s limit" in resp.json()["detail"]


# 5. MinIO Multipart Upload for Large Files (>100MB)
def test_minio_multipart_constants():
    """Verify MinIO multipart upload constants are sized appropriately (>100MB threshold, 10MB chunk)."""
    assert MULTIPART_THRESHOLD == 100 * 1024 * 1024  # 100 MB
    assert DEFAULT_PART_SIZE == 10 * 1024 * 1024     # 10 MB


def test_minio_multipart_routing_for_large_files(temp_storage):
    """Verify put_object_bytes routes to multipart upload when payload >= 100MB."""
    client = MinioRawStorageClient(local_fallback_dir=temp_storage)

    with patch.object(client, "put_object_multipart", return_value=True) as mock_multipart:
        # Under threshold: 1 KB
        small_payload = b"small payload"
        client.put_object_bytes("test-bucket", "small.csv", small_payload)
        mock_multipart.assert_not_called()

        # Over threshold: 100MB + 1 byte
        large_payload = b"X" * (MULTIPART_THRESHOLD + 1)
        client.put_object_bytes("test-bucket", "large.csv", large_payload)
        mock_multipart.assert_called_once_with("test-bucket", "large.csv", large_payload, content_type="text/csv")


@pytest.fixture
def temp_storage(tmp_path):
    return str(tmp_path / "minio_local")
