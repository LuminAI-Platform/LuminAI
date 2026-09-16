"""Unit and integration tests for the Dead-Letter Queue (DLQ) & Quarantine system.

Covers:
- QuarantineManager recording, indexing, and SQLite persistence
- DeadLetterProducer and IngestRawProducer execution
- Consumer auto-quarantine upon deserialization & processing errors
- Endpoints:
  - POST /process/quarantine
  - GET  /process/quarantine
  - POST /process/quarantine/replay
  - POST /process/quarantine/discard
"""

import json
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
import pytest

from app.kafka.consumers import IngestRawConsumer
from app.kafka.producers import DeadLetterProducer, IngestRawProducer
from app.kafka.quarantine import (
    QuarantineManager,
    QuarantinedMessage,
    get_quarantine_manager,
)
from app.main import app

client = TestClient(app)


@pytest.fixture
def temp_quarantine_mgr(tmp_path):
    """Provide an isolated QuarantineManager backed by a temporary SQLite file."""
    db_file = str(tmp_path / "test_quarantine.db")
    dlq_prod = MagicMock(spec=DeadLetterProducer)
    raw_prod = MagicMock(spec=IngestRawProducer)
    mgr = QuarantineManager(
        db_path=db_file,
        dead_letter_producer=dlq_prod,
        ingest_raw_producer=raw_prod,
    )
    return mgr


class TestQuarantineManager:
    """Unit tests for QuarantineManager core operations."""

    def test_record_failure(self, temp_quarantine_mgr):
        """Failed message is recorded with quarantined status and published to DLQ."""
        msg = temp_quarantine_mgr.record_failure(
            topic="ingest.raw",
            key="tenant-x:src-1",
            raw_payload='{"invalid": json}',
            error="JSONDecodeError: Expecting value",
            tenant_id="tenant-x",
            source_id="src-1",
        )

        assert msg.message_id is not None
        assert msg.tenant_id == "tenant-x"
        assert msg.source_id == "src-1"
        assert msg.status == "quarantined"
        assert msg.retry_count == 0
        assert "JSONDecodeError" in msg.error_reason

        temp_quarantine_mgr.dead_letter_producer.publish_dead_letter.assert_called_once()

    def test_record_failure_infers_tenant_from_key(self, temp_quarantine_mgr):
        """Tenant and source IDs are inferred from key when unspecified."""
        msg = temp_quarantine_mgr.record_failure(
            topic="ingest.raw",
            key="acme_corp:connector_99",
            raw_payload="plain-corrupted-text",
            error="Malformed payload",
        )
        assert msg.tenant_id == "acme_corp"
        assert msg.source_id == "connector_99"

    def test_list_and_filter_messages(self, temp_quarantine_mgr):
        """Messages can be filtered by tenant and status with pagination."""
        temp_quarantine_mgr.record_failure("ingest.raw", "acme:s1", "err1", "err", tenant_id="acme")
        temp_quarantine_mgr.record_failure("ingest.raw", "acme:s2", "err2", "err", tenant_id="acme")
        temp_quarantine_mgr.record_failure("ingest.raw", "other:s1", "err3", "err", tenant_id="other")

        # Filter by tenant
        acme_msgs, total = temp_quarantine_mgr.list_messages(tenant_id="acme")
        assert total == 2
        assert len(acme_msgs) == 2

        # Filter all
        all_msgs, total = temp_quarantine_mgr.list_messages(tenant_id=None, status="all")
        assert total == 3

    def test_replay_message(self, temp_quarantine_mgr):
        """Replaying a message publishes to ingest.raw and increments retry count."""
        msg = temp_quarantine_mgr.record_failure(
            topic="ingest.raw",
            key="acme:s1",
            raw_payload='{"data": 123}',
            error="Transient failure",
            tenant_id="acme",
        )

        replayed = temp_quarantine_mgr.replay_messages([msg.message_id])
        assert len(replayed) == 1
        assert replayed[0].status == "replayed"
        assert replayed[0].retry_count == 1
        assert replayed[0].last_replayed_at is not None

        temp_quarantine_mgr.ingest_raw_producer.publish_raw.assert_called_once_with(
            key="acme:s1",
            payload='{"data": 123}',
        )

    def test_discard_message(self, temp_quarantine_mgr):
        """Discarding updates status to discarded."""
        msg = temp_quarantine_mgr.record_failure(
            topic="ingest.raw",
            key="acme:s1",
            raw_payload="unrecoverable poison pill",
            error="Fatal corruption",
            tenant_id="acme",
        )

        discarded = temp_quarantine_mgr.discard_messages([msg.message_id])
        assert len(discarded) == 1
        assert discarded[0].status == "discarded"


class TestProducers:
    """Tests for DeadLetterProducer and IngestRawProducer in dry-run and live modes."""

    def test_dead_letter_producer_dry_run(self):
        """DeadLetterProducer works cleanly in dry-run mode when Kafka is disabled."""
        producer = DeadLetterProducer()
        # Should not raise exception
        producer.publish_dead_letter(
            tenant_id="acme",
            error="Corrupt payload",
            original_topic="ingest.raw",
            original_key="acme:s1",
            original_payload="test",
        )
        producer.flush()

    def test_ingest_raw_producer_dry_run(self):
        """IngestRawProducer works cleanly in dry-run mode."""
        producer = IngestRawProducer()
        # Should not raise exception
        producer.publish_raw(key="acme:s1", payload={"foo": "bar"})
        producer.flush()


class TestConsumerQuarantineIntegration:
    """Verify IngestRawConsumer automatically routes failures to QuarantineManager."""

    def test_consumer_quarantines_malformed_json(self):
        """Malformed message value in poll loop triggers quarantine."""
        consumer = IngestRawConsumer()
        mock_msg = MagicMock()
        mock_msg.error.return_value = None
        mock_msg.offset.return_value = 42
        mock_msg.key.return_value = b"acme:crm-1"
        mock_msg.value.return_value = b"{bad_json_not_parseable"

        with patch("app.kafka.consumers.get_quarantine_manager") as mock_get_mgr:
            mock_mgr = MagicMock()
            mock_get_mgr.return_value = mock_mgr

            # Execute single poll iteration logic
            consumer._consumer = MagicMock()
            consumer._consumer.poll.return_value = mock_msg
            consumer._running = True

            # Run one loop cycle then break
            def fake_poll(timeout):
                consumer._running = False
                return mock_msg

            consumer._consumer.poll.side_effect = fake_poll
            with patch.object(consumer, "_create_consumer", return_value=consumer._consumer):
                consumer._poll_loop()

            mock_mgr.record_failure.assert_called_once()
            call_kwargs = mock_mgr.record_failure.call_args[1]
            assert call_kwargs["key"] == "acme:crm-1"
            assert "DeserializationError" in call_kwargs["error"]


class TestQuarantineApiEndpoints:
    """Tests for FastAPI /process/quarantine endpoints."""

    @pytest.fixture(autouse=True)
    def setup_quarantine(self, tmp_path):
        """Override the global quarantine manager with a fresh temporary instance."""
        db_file = str(tmp_path / "api_test_quarantine.db")
        raw_prod = MagicMock(spec=IngestRawProducer)
        dlq_prod = MagicMock(spec=DeadLetterProducer)
        self.mgr = QuarantineManager(
            db_path=db_file,
            dead_letter_producer=dlq_prod,
            ingest_raw_producer=raw_prod,
        )

        with patch("app.api.processing.get_quarantine_manager", return_value=self.mgr):
            yield

    def test_list_quarantine_empty(self):
        """POST /process/quarantine returns empty list when no failed messages exist."""
        response = client.post("/process/quarantine", json={})
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["items"] == []

    def test_list_quarantine_with_items_and_get(self):
        """POST and GET /process/quarantine retrieve stored failed messages."""
        msg = self.mgr.record_failure(
            topic="ingest.raw",
            key="tenant-alpha:s1",
            raw_payload='{"test": 1}',
            error="Test schema error",
            tenant_id="tenant-alpha",
        )

        # POST /process/quarantine
        post_res = client.post(
            "/process/quarantine",
            json={"tenant_id": "tenant-alpha"},
        )
        assert post_res.status_code == 200
        assert post_res.json()["total"] == 1
        assert post_res.json()["items"][0]["message_id"] == msg.message_id

        # GET /process/quarantine
        get_res = client.get("/process/quarantine?tenant_id=tenant-alpha")
        assert get_res.status_code == 200
        assert get_res.json()["total"] == 1

    def test_replay_endpoint(self):
        """POST /process/quarantine/replay re-publishes selected messages."""
        msg = self.mgr.record_failure(
            topic="ingest.raw",
            key="tenant-beta:s1",
            raw_payload='{"replayed": true}',
            error="Syntax error",
            tenant_id="tenant-beta",
        )

        res = client.post(
            "/process/quarantine/replay",
            json={"message_ids": [msg.message_id]},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["action"] == "replay"
        assert data["processed_count"] == 1
        assert msg.message_id in data["message_ids"]

    def test_discard_endpoint(self):
        """POST /process/quarantine/discard marks messages as discarded."""
        msg = self.mgr.record_failure(
            topic="ingest.raw",
            key="tenant-gamma:s1",
            raw_payload='{"bad": true}',
            error="Permanent error",
            tenant_id="tenant-gamma",
        )

        res = client.post(
            "/process/quarantine/discard",
            json={"message_ids": [msg.message_id]},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["action"] == "discard"
        assert data["processed_count"] == 1
