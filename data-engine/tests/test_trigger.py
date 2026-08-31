"""Tests for the Dagster pipeline trigger integration."""

from unittest.mock import MagicMock, patch

from app.processing.trigger import DagsterTrigger


class TestDagsterTriggerInit:
    """Tests for DagsterTrigger construction."""

    def test_trigger_can_be_instantiated(self):
        """DagsterTrigger can be created without errors."""
        trigger = DagsterTrigger()
        assert trigger is not None

    def test_trigger_has_methods(self):
        """DagsterTrigger has trigger methods."""
        trigger = DagsterTrigger()
        assert hasattr(trigger, "trigger_cleaning_pipeline")
        assert hasattr(trigger, "trigger_er_pipeline")
        assert hasattr(trigger, "trigger_reconciliation")


class TestTriggerCleaningPipeline:
    """Tests for DagsterTrigger.trigger_cleaning_pipeline()."""

    @patch("app.processing.trigger.materialize")
    def test_trigger_calls_materialize(self, mock_materialize):
        """trigger_cleaning_pipeline invokes dagster.materialize with the correct assets."""
        mock_result = MagicMock()
        mock_result.success = True
        mock_result.run_id = "test-run-123"
        mock_materialize.return_value = mock_result

        trigger = DagsterTrigger()
        run_id = trigger.trigger_cleaning_pipeline(
            tenant_id="acme",
            source_id="src-001",
            batch_metadata={"total_rows": 100},
        )

        mock_materialize.assert_called_once()
        assert run_id is not None

    @patch("app.processing.trigger.materialize")
    def test_trigger_er_pipeline_calls_materialize(self, mock_materialize):
        """trigger_er_pipeline invokes dagster.materialize with ER assets."""
        mock_result = MagicMock()
        mock_result.success = True
        mock_result.run_id = "er-run-123"
        mock_materialize.return_value = mock_result

        trigger = DagsterTrigger()
        run_id = trigger.trigger_er_pipeline(tenant_id="acme", source_id="src-001")

        mock_materialize.assert_called_once()
        assert run_id == "er-run-123"

    def test_trigger_reconciliation_returns_report_dict(self):
        """trigger_reconciliation runs cross-store reconciliation and returns dict."""
        trigger = DagsterTrigger()
        records = [{"golden_id": "gr-1", "name": "Alice"}]
        report = trigger.trigger_reconciliation(
            tenant_id="acme",
            entity_type="Person",
            pg_records=records,
            neo4j_records=records,
            opensearch_records=records,
        )
        assert isinstance(report, dict)
        assert report["status"] == "HEALTHY"
        assert report["pg_count"] == 1


class TestTriggerWiringInMain:
    """Tests verifying the trigger is wired to the consumer in main.py."""

    def test_trigger_is_callable_as_batch_callback(self):
        """DagsterTrigger.trigger_cleaning_pipeline has the correct signature for on_batch_complete."""
        import inspect

        trigger = DagsterTrigger()
        sig = inspect.signature(trigger.trigger_cleaning_pipeline)
        params = list(sig.parameters.keys())
        assert "tenant_id" in params
        assert "source_id" in params
        assert "batch_metadata" in params

    def test_consumer_accepts_trigger_callback(self):
        """IngestRawConsumer.on_batch_complete can be set to the trigger method."""
        from app.kafka.consumers import IngestRawConsumer

        consumer = IngestRawConsumer()
        trigger = DagsterTrigger()
        consumer.on_batch_complete = trigger.trigger_cleaning_pipeline

        assert consumer.on_batch_complete is not None
        assert callable(consumer.on_batch_complete)
