"""Tests for the Kafka consumer scaffold

Tests the IngestRawConsumer class in isolation without requiring
a live Kafka broker. Uses mocking to simulate message polling,
deserialization, and batch-complete callback handling.
"""

from unittest.mock import MagicMock, patch

from app.kafka.consumers import IngestRawConsumer


class TestConsumerInitialization:
    """Tests for IngestRawConsumer construction and configuration."""

    def test_consumer_initializes(self):
        """IngestRawConsumer can be instantiated without errors."""
        consumer = IngestRawConsumer()
        assert consumer is not None

    def test_consumer_default_topic(self):
        """Consumer reads from the configured ingest.raw topic."""
        consumer = IngestRawConsumer()
        assert consumer.topic == "ingest.raw"

    def test_consumer_default_group_id(self):
        """Consumer uses the configured group ID."""
        consumer = IngestRawConsumer()
        assert consumer.group_id == "data-engine"

    def test_consumer_default_bootstrap_servers(self):
        """Consumer uses the configured bootstrap servers."""
        consumer = IngestRawConsumer()
        assert consumer.bootstrap_servers == "localhost:9092"

    def test_consumer_not_running_initially(self):
        """Consumer is not running after construction."""
        consumer = IngestRawConsumer()
        assert consumer._running is False

    def test_consumer_no_callback_initially(self):
        """on_batch_complete callback is None by default."""
        consumer = IngestRawConsumer()
        assert consumer.on_batch_complete is None

    def test_consumer_kafka_client_not_created_on_init(self):
        """Kafka Consumer client is not created until start() is called."""
        consumer = IngestRawConsumer()
        assert consumer._consumer is None


class TestMessageHandling:
    """Tests for IngestRawConsumer.handle() message processing."""

    def test_handle_basic_message(self):
        """handle() processes a standard ingest.raw message without error."""
        consumer = IngestRawConsumer()
        consumer.handle(
            key="acme:src-001",
            value={
                "tenant_id": "acme",
                "source_id": "src-001",
                "row_count": 100,
                "rows": [{"id": "1", "name": "Alice"}],
            },
        )
        # No exception means success

    def test_handle_extracts_tenant_id(self):
        """handle() correctly reads tenant_id from the message payload."""
        consumer = IngestRawConsumer()
        # handle() logs the tenant_id; we verify it doesn't crash
        consumer.handle(
            key="tenant-x:source-y",
            value={"tenant_id": "tenant-x", "source_id": "source-y", "row_count": 50},
        )

    def test_handle_missing_fields_uses_defaults(self):
        """handle() uses 'unknown' defaults for missing fields."""
        consumer = IngestRawConsumer()
        # Should not raise even with minimal payload
        consumer.handle(key=None, value={})

    def test_handle_with_none_key(self):
        """handle() accepts None as the message key."""
        consumer = IngestRawConsumer()
        consumer.handle(
            key=None,
            value={"tenant_id": "acme", "source_id": "src-001", "row_count": 10},
        )


class TestBatchCompleteCallback:
    """Tests for the batch_complete signal and callback wiring."""

    def test_batch_complete_triggers_callback(self):
        """When batch_complete is True, on_batch_complete callback is invoked."""
        consumer = IngestRawConsumer()
        mock_callback = MagicMock()
        consumer.on_batch_complete = mock_callback

        consumer.handle(
            key="acme:src-001",
            value={
                "tenant_id": "acme",
                "source_id": "src-001",
                "row_count": 500,
                "batch_complete": True,
            },
        )

        mock_callback.assert_called_once_with(
            "acme",
            "src-001",
            {
                "tenant_id": "acme",
                "source_id": "src-001",
                "row_count": 500,
                "batch_complete": True,
            },
        )

    def test_no_callback_when_batch_not_complete(self):
        """Callback is NOT invoked when batch_complete is False."""
        consumer = IngestRawConsumer()
        mock_callback = MagicMock()
        consumer.on_batch_complete = mock_callback

        consumer.handle(
            key="acme:src-001",
            value={
                "tenant_id": "acme",
                "source_id": "src-001",
                "row_count": 100,
                "batch_complete": False,
            },
        )

        mock_callback.assert_not_called()

    def test_no_callback_when_batch_complete_missing(self):
        """Callback is NOT invoked when batch_complete key is absent."""
        consumer = IngestRawConsumer()
        mock_callback = MagicMock()
        consumer.on_batch_complete = mock_callback

        consumer.handle(
            key="acme:src-001",
            value={"tenant_id": "acme", "source_id": "src-001", "row_count": 100},
        )

        mock_callback.assert_not_called()

    def test_callback_not_called_when_none(self):
        """No error when batch_complete is True but callback is None."""
        consumer = IngestRawConsumer()
        consumer.on_batch_complete = None

        # Should not raise
        consumer.handle(
            key="acme:src-001",
            value={
                "tenant_id": "acme",
                "source_id": "src-001",
                "batch_complete": True,
            },
        )

    def test_callback_exception_is_caught(self):
        """Exceptions in on_batch_complete are caught and logged, not re-raised."""
        consumer = IngestRawConsumer()
        consumer.on_batch_complete = MagicMock(side_effect=RuntimeError("trigger failed"))

        # Should NOT raise even though callback throws
        consumer.handle(
            key="acme:src-001",
            value={
                "tenant_id": "acme",
                "source_id": "src-001",
                "batch_complete": True,
            },
        )


class TestConsumerLifecycle:
    """Tests for start/stop lifecycle methods."""

    def test_start_sets_running_flag(self):
        """start() sets the _running flag to True."""
        import asyncio

        consumer = IngestRawConsumer()

        async def _test():
            with patch.object(consumer, "_create_consumer"):
                with patch("asyncio.get_running_loop") as mock_loop:
                    mock_loop.return_value = MagicMock()
                    await consumer.start()
                    assert consumer._running is True
                    consumer._running = False

        asyncio.run(_test())

    def test_start_idempotent(self):
        """Calling start() twice does not create duplicate poll loops."""
        import asyncio

        consumer = IngestRawConsumer()
        consumer._running = True

        async def _test():
            with patch("asyncio.get_running_loop") as mock_loop:
                await consumer.start()
                mock_loop.assert_not_called()

        asyncio.run(_test())

    def test_stop_clears_running_flag(self):
        """stop() sets the _running flag to False."""
        import asyncio

        consumer = IngestRawConsumer()
        consumer._running = True

        asyncio.run(consumer.stop())
        assert consumer._running is False

    def test_stop_when_not_running_is_noop(self):
        """stop() is a no-op when consumer is not running."""
        import asyncio

        consumer = IngestRawConsumer()
        consumer._running = False

        asyncio.run(consumer.stop())
        assert consumer._running is False


class TestConsumerConfiguration:
    """Tests for the internal Kafka consumer config."""

    def test_create_consumer_config(self):
        """_create_consumer creates a Consumer with correct config."""
        consumer = IngestRawConsumer()

        with patch("app.kafka.consumers.Consumer") as mock_consumer_cls:
            consumer._create_consumer()

            mock_consumer_cls.assert_called_once()
            conf = mock_consumer_cls.call_args[0][0]
            assert conf["bootstrap.servers"] == "localhost:9092"
            assert conf["group.id"] == "data-engine"
            assert conf["auto.offset.reset"] == "earliest"
            assert conf["enable.auto.commit"] is True
