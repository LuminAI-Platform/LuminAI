"""Unit tests for TASK S2-12: Kafka Event Publisher (entity.resolved)."""

from unittest.mock import MagicMock, patch

from app.kafka.producers import EntityResolvedProducer, IngestValidProducer


class TestIngestValidProducer:
    """Tests for IngestValidProducer."""

    def test_init_dry_run_when_disabled(self):
        producer = IngestValidProducer()
        assert producer.topic == "ingest.valid"
        assert producer.enabled is False

    def test_publish_dry_run(self):
        producer = IngestValidProducer()
        # Should not raise in dry-run mode
        producer.publish("acme", "Person", {"count": 10})

    @patch("app.kafka.producers.Producer")
    def test_publish_active_producer(self, mock_kafka_producer_cls):
        mock_instance = MagicMock()
        mock_kafka_producer_cls.return_value = mock_instance

        with patch("app.kafka.producers.get_settings") as mock_settings:
            settings = MagicMock()
            settings.kafka_topic_ingest_valid = "ingest.valid"
            settings.kafka_bootstrap_servers = "localhost:9092"
            settings.kafka_enabled = True
            mock_settings.return_value = settings

            producer = IngestValidProducer()
            producer.publish("acme", "Person", {"count": 10})

            mock_instance.produce.assert_called_once()


class TestEntityResolvedProducer:
    """Tests for EntityResolvedProducer (S2-12)."""

    def test_init_dry_run_when_disabled(self):
        producer = EntityResolvedProducer()
        assert producer.topic == "entity.resolved"
        assert producer.enabled is False

    def test_publish_resolved_entity_dry_run(self):
        producer = EntityResolvedProducer()
        # Should not raise in dry-run mode
        producer.publish_resolved_entity(
            tenant_id="acme",
            golden_id="gr-100",
            entity_type="Person",
            payload={"name": "Alice Smith", "email": "alice@example.com"},
        )

    @patch("app.kafka.producers.Producer")
    def test_publish_active_producer(self, mock_kafka_producer_cls):
        mock_instance = MagicMock()
        mock_kafka_producer_cls.return_value = mock_instance

        with patch("app.kafka.producers.get_settings") as mock_settings:
            settings = MagicMock()
            settings.kafka_topic_entity_resolved = "entity.resolved"
            settings.kafka_bootstrap_servers = "localhost:9092"
            settings.kafka_enabled = True
            mock_settings.return_value = settings

            producer = EntityResolvedProducer()
            producer.publish_resolved_entity(
                tenant_id="acme",
                golden_id="gr-100",
                entity_type="Person",
                payload={"name": "Alice Smith"},
            )

            mock_instance.produce.assert_called_once()
            call_kwargs = mock_instance.produce.call_args.kwargs
            assert call_kwargs["topic"] == "entity.resolved"
            assert call_kwargs["key"] == b"acme:gr-100"
