"""Unit tests for Kafka Event Producers with exponential backoff retry and DLQ routing."""

from unittest.mock import MagicMock, patch

from app.kafka.producers import (
    DeadLetterProducer,
    EntityResolvedProducer,
    IngestRawProducer,
    IngestValidProducer,
)


class TestIngestValidProducer:
    """Tests for IngestValidProducer with retry and DLQ routing."""

    def test_init_dry_run_when_disabled(self):
        producer = IngestValidProducer()
        assert producer.topic == "ingest.valid"
        assert producer.enabled is False

    def test_publish_dry_run(self):
        producer = IngestValidProducer()
        # Should not raise in dry-run mode
        res = producer.publish("acme", "Person", {"count": 10})
        assert res is True

    @patch("app.kafka.producers.Producer")
    def test_publish_active_producer_succeeds_first_attempt(self, mock_kafka_producer_cls):
        mock_instance = MagicMock()
        mock_kafka_producer_cls.return_value = mock_instance

        with patch("app.kafka.producers.get_settings") as mock_settings:
            settings = MagicMock()
            settings.kafka_topic_ingest_valid = "ingest.valid"
            settings.kafka_bootstrap_servers = "localhost:9092"
            settings.kafka_enabled = True
            settings.kafka_producer_max_retries = 3
            settings.kafka_producer_initial_backoff = 0.1
            settings.kafka_producer_backoff_multiplier = 2.0
            mock_settings.return_value = settings

            mock_dlq = MagicMock(spec=DeadLetterProducer)
            mock_sleep = MagicMock()

            producer = IngestValidProducer(
                dead_letter_producer=mock_dlq,
                sleep_fn=mock_sleep,
            )
            success = producer.publish("acme", "Person", {"count": 10})

            assert success is True
            assert mock_instance.produce.call_count == 1
            mock_sleep.assert_not_called()
            mock_dlq.publish_dead_letter.assert_not_called()

    @patch("app.kafka.producers.Producer")
    def test_publish_retries_and_recovers(self, mock_kafka_producer_cls):
        mock_instance = MagicMock()
        mock_kafka_producer_cls.return_value = mock_instance

        # Attempt 1 fails, Attempt 2 succeeds
        mock_instance.produce.side_effect = [
            Exception("Temporary network timeout"),
            None,
        ]

        with patch("app.kafka.producers.get_settings") as mock_settings:
            settings = MagicMock()
            settings.kafka_topic_ingest_valid = "ingest.valid"
            settings.kafka_bootstrap_servers = "localhost:9092"
            settings.kafka_enabled = True
            settings.kafka_producer_max_retries = 3
            settings.kafka_producer_initial_backoff = 0.5
            settings.kafka_producer_backoff_multiplier = 2.0
            mock_settings.return_value = settings

            mock_dlq = MagicMock(spec=DeadLetterProducer)
            mock_sleep = MagicMock()

            producer = IngestValidProducer(
                dead_letter_producer=mock_dlq,
                sleep_fn=mock_sleep,
            )
            success = producer.publish("acme", "Person", {"count": 10})

            assert success is True
            assert mock_instance.produce.call_count == 2
            mock_sleep.assert_called_once_with(0.5)
            mock_dlq.publish_dead_letter.assert_not_called()

    @patch("app.kafka.producers.Producer")
    def test_publish_exhausts_retries_and_routes_to_dlq(self, mock_kafka_producer_cls):
        mock_instance = MagicMock()
        mock_kafka_producer_cls.return_value = mock_instance

        # All 3 attempts fail
        mock_instance.produce.side_effect = Exception("Permanent broker crash")

        with patch("app.kafka.producers.get_settings") as mock_settings:
            settings = MagicMock()
            settings.kafka_topic_ingest_valid = "ingest.valid"
            settings.kafka_bootstrap_servers = "localhost:9092"
            settings.kafka_enabled = True
            settings.kafka_producer_max_retries = 3
            settings.kafka_producer_initial_backoff = 0.5
            settings.kafka_producer_backoff_multiplier = 2.0
            mock_settings.return_value = settings

            mock_dlq = MagicMock(spec=DeadLetterProducer)
            mock_sleep = MagicMock()

            producer = IngestValidProducer(
                dead_letter_producer=mock_dlq,
                sleep_fn=mock_sleep,
            )
            success = producer.publish("acme", "Person", {"count": 10}, source_id="src-999")

            assert success is False
            assert mock_instance.produce.call_count == 3
            assert mock_sleep.call_count == 2
            assert mock_sleep.call_args_list[0][0][0] == 0.5
            assert mock_sleep.call_args_list[1][0][0] == 1.0

            # Verified routed to DLQ with error details
            mock_dlq.publish_dead_letter.assert_called_once()
            dlq_kwargs = mock_dlq.publish_dead_letter.call_args.kwargs
            assert dlq_kwargs["tenant_id"] == "acme"
            assert dlq_kwargs["source_id"] == "src-999"
            assert dlq_kwargs["original_topic"] == "ingest.valid"
            assert dlq_kwargs["original_key"] == "acme:Person"
            assert "Permanent broker crash" in dlq_kwargs["error"]

    @patch("app.kafka.producers.Producer")
    def test_publish_buffer_error_triggers_poll_drain(self, mock_kafka_producer_cls):
        mock_instance = MagicMock()
        mock_kafka_producer_cls.return_value = mock_instance

        # 1st attempt: BufferError (local queue full)
        # 2nd attempt: Success
        mock_instance.produce.side_effect = [
            BufferError("Queue full"),
            None,
        ]

        with patch("app.kafka.producers.get_settings") as mock_settings:
            settings = MagicMock()
            settings.kafka_topic_ingest_valid = "ingest.valid"
            settings.kafka_bootstrap_servers = "localhost:9092"
            settings.kafka_enabled = True
            mock_settings.return_value = settings

            mock_sleep = MagicMock()
            producer = IngestValidProducer(sleep_fn=mock_sleep)
            success = producer.publish("acme", "Person", {"batch": 1})

            assert success is True
            assert mock_instance.produce.call_count == 2
            # Verify poll(0.2) was called to drain buffer
            mock_instance.poll.assert_any_call(0.2)


class TestEntityResolvedProducer:
    """Tests for EntityResolvedProducer."""

    def test_init_dry_run_when_disabled(self):
        producer = EntityResolvedProducer()
        assert producer.topic == "entity.resolved"
        assert producer.enabled is False

    def test_publish_resolved_entity_dry_run(self):
        producer = EntityResolvedProducer()
        res = producer.publish_resolved_entity(
            tenant_id="acme",
            golden_id="gr-100",
            entity_type="Person",
            payload={"name": "Alice Smith", "email": "alice@example.com"},
        )
        assert res is True

    @patch("app.kafka.producers.Producer")
    def test_publish_active_producer_succeeds(self, mock_kafka_producer_cls):
        mock_instance = MagicMock()
        mock_kafka_producer_cls.return_value = mock_instance

        with patch("app.kafka.producers.get_settings") as mock_settings:
            settings = MagicMock()
            settings.kafka_topic_entity_resolved = "entity.resolved"
            settings.kafka_bootstrap_servers = "localhost:9092"
            settings.kafka_enabled = True
            mock_settings.return_value = settings

            producer = EntityResolvedProducer()
            success = producer.publish_resolved_entity(
                tenant_id="acme",
                golden_id="gr-100",
                entity_type="Person",
                payload={"name": "Alice Smith"},
            )

            assert success is True
            mock_instance.produce.assert_called_once()
            call_kwargs = mock_instance.produce.call_args.kwargs
            assert call_kwargs["topic"] == "entity.resolved"
            assert call_kwargs["key"] == b"acme:gr-100"

    @patch("app.kafka.producers.Producer")
    def test_publish_resolved_entity_exhausts_retries_and_routes_to_dlq(self, mock_kafka_producer_cls):
        mock_instance = MagicMock()
        mock_kafka_producer_cls.return_value = mock_instance
        mock_instance.produce.side_effect = Exception("Kafka broker disconnected")

        with patch("app.kafka.producers.get_settings") as mock_settings:
            settings = MagicMock()
            settings.kafka_topic_entity_resolved = "entity.resolved"
            settings.kafka_bootstrap_servers = "localhost:9092"
            settings.kafka_enabled = True
            mock_settings.return_value = settings

            mock_dlq = MagicMock(spec=DeadLetterProducer)
            mock_sleep = MagicMock()

            producer = EntityResolvedProducer(
                dead_letter_producer=mock_dlq,
                sleep_fn=mock_sleep,
            )
            success = producer.publish_resolved_entity(
                tenant_id="acme",
                golden_id="gr-200",
                entity_type="Person",
                payload={"name": "Bob Jones"},
            )

            assert success is False
            assert mock_instance.produce.call_count == 3
            mock_dlq.publish_dead_letter.assert_called_once()
            dlq_kwargs = mock_dlq.publish_dead_letter.call_args.kwargs
            assert dlq_kwargs["tenant_id"] == "acme"
            assert dlq_kwargs["original_topic"] == "entity.resolved"
            assert dlq_kwargs["original_key"] == "acme:gr-200"


class TestIngestRawProducer:
    """Tests for IngestRawProducer."""

    def test_init_dry_run_when_disabled(self):
        producer = IngestRawProducer()
        assert producer.topic == "ingest.raw"
        assert producer.enabled is False

    @patch("app.kafka.producers.Producer")
    def test_publish_raw_retries_and_routes_to_dlq(self, mock_kafka_producer_cls):
        mock_instance = MagicMock()
        mock_kafka_producer_cls.return_value = mock_instance
        mock_instance.produce.side_effect = Exception("Leader not available")

        with patch("app.kafka.producers.get_settings") as mock_settings:
            settings = MagicMock()
            settings.kafka_topic_ingest_raw = "ingest.raw"
            settings.kafka_bootstrap_servers = "localhost:9092"
            settings.kafka_enabled = True
            mock_settings.return_value = settings

            mock_dlq = MagicMock(spec=DeadLetterProducer)
            mock_sleep = MagicMock()

            producer = IngestRawProducer(
                dead_letter_producer=mock_dlq,
                sleep_fn=mock_sleep,
            )
            success = producer.publish_raw(
                key="raw-key-1",
                payload={"batch": 1},
                tenant_id="acme",
                source_id="src-1",
            )

            assert success is False
            assert mock_instance.produce.call_count == 3
            mock_dlq.publish_dead_letter.assert_called_once()
            dlq_kwargs = mock_dlq.publish_dead_letter.call_args.kwargs
            assert dlq_kwargs["original_topic"] == "ingest.raw"
            assert dlq_kwargs["original_key"] == "raw-key-1"


class TestDeadLetterProducer:
    """Tests for DeadLetterProducer."""

    def test_init_dry_run_when_disabled(self):
        producer = DeadLetterProducer()
        assert producer.topic == "ingest.dead_letter"
        assert producer.enabled is False

    @patch("app.kafka.producers.Producer")
    def test_dead_letter_retries_and_does_not_infinite_loop(self, mock_kafka_producer_cls):
        mock_instance = MagicMock()
        mock_kafka_producer_cls.return_value = mock_instance
        # Terminal failure on DLQ
        mock_instance.produce.side_effect = Exception("DLQ topic unavailable")

        with patch("app.kafka.producers.get_settings") as mock_settings:
            settings = MagicMock()
            settings.kafka_topic_ingest_dead_letter = "ingest.dead_letter"
            settings.kafka_bootstrap_servers = "localhost:9092"
            settings.kafka_enabled = True
            mock_settings.return_value = settings

            mock_sleep = MagicMock()
            producer = DeadLetterProducer(sleep_fn=mock_sleep)
            success = producer.publish_dead_letter(
                tenant_id="acme",
                error="Bad payload",
                original_topic="ingest.valid",
                original_key="acme:Person",
                original_payload="{}",
            )

            assert success is False
            assert mock_instance.produce.call_count == 3
            assert mock_sleep.call_count == 2
