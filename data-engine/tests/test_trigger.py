"""Tests for the Dagster pipeline trigger integration.

Tests the DagsterTrigger class and its integration with the Kafka
consumer's on_batch_complete callback. Uses mocking to avoid
running actual Dagster materializations during unit tests.
"""

from unittest.mock import MagicMock, patch

from app.processing.trigger import DagsterTrigger


class TestDagsterTriggerInit:
    """Tests for DagsterTrigger construction."""

    def test_trigger_can_be_instantiated(self):
        """DagsterTrigger can be created without errors."""
        trigger = DagsterTrigger()
        assert trigger is not None

    def test_trigger_has_method(self):
        """DagsterTrigger has trigger_cleaning_pipeline method."""
        trigger = DagsterTrigger()
        assert hasattr(trigger, "trigger_cleaning_pipeline")
        assert callable(trigger.trigger_cleaning_pipeline)


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
    def test_trigger_passes_tenant_tags(self, mock_materialize):
        """trigger_cleaning_pipeline passes tenant_id and source_id as run tags."""
        mock_result = MagicMock()
        mock_result.success = True
        mock_result.run_id = "run-abc"
        mock_materialize.return_value = mock_result

        trigger = DagsterTrigger()
        trigger.trigger_cleaning_pipeline(
            tenant_id="acme",
            source_id="src-001",
            batch_metadata={"total_rows": 200},
        )

        call_kwargs = mock_materialize.call_args
        tags = call_kwargs.kwargs.get("tags", {}) or call_kwargs[1].get("tags", {})
        assert tags["tenant_id"] == "acme"
        assert tags["source_id"] == "src-001"
        assert tags["trigger"] == "kafka_batch_complete"

    @patch("app.processing.trigger.materialize")
    def test_trigger_passes_all_five_assets(self, mock_materialize):
        """trigger_cleaning_pipeline materializes all 5 cleaning pipeline assets."""
        mock_result = MagicMock()
        mock_result.success = True
        mock_result.run_id = "run-xyz"
        mock_materialize.return_value = mock_result

        trigger = DagsterTrigger()
        trigger.trigger_cleaning_pipeline("t1", "s1", {})

        call_kwargs = mock_materialize.call_args
        assets = call_kwargs.kwargs.get("assets", []) or call_kwargs[1].get("assets", [])
        assert len(assets) == 5

    @patch("app.processing.trigger.materialize")
    def test_trigger_returns_run_id_on_success(self, mock_materialize):
        """On success, returns the Dagster run ID string."""
        mock_result = MagicMock()
        mock_result.success = True
        mock_result.run_id = "dagster-run-42"
        mock_materialize.return_value = mock_result

        trigger = DagsterTrigger()
        result = trigger.trigger_cleaning_pipeline("acme", "src-001", {})
        assert result == "dagster-run-42"

    @patch("app.processing.trigger.materialize")
    def test_trigger_returns_none_on_failure(self, mock_materialize):
        """On pipeline failure, returns None."""
        mock_result = MagicMock()
        mock_result.success = False
        mock_materialize.return_value = mock_result

        trigger = DagsterTrigger()
        result = trigger.trigger_cleaning_pipeline("acme", "src-001", {})
        assert result is None

    @patch("app.processing.trigger.materialize")
    def test_trigger_returns_none_on_exception(self, mock_materialize):
        """On exception during materialization, returns None without raising."""
        mock_materialize.side_effect = RuntimeError("Dagster crashed")

        trigger = DagsterTrigger()
        result = trigger.trigger_cleaning_pipeline("acme", "src-001", {})
        assert result is None

    @patch("app.processing.trigger.materialize")
    def test_trigger_handles_missing_run_id(self, mock_materialize):
        """Handles case where result has no run_id attribute gracefully."""
        mock_result = MagicMock(spec=[])  # no attributes
        mock_result.success = True
        mock_materialize.return_value = mock_result

        trigger = DagsterTrigger()
        result = trigger.trigger_cleaning_pipeline("acme", "src-001", {})
        # Should return "in-process" fallback since hasattr(result, "run_id") is False
        assert result == "in-process"


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

    @patch("app.processing.trigger.materialize")
    def test_end_to_end_consumer_to_trigger(self, mock_materialize):
        """Full wiring: consumer batch_complete signal triggers Dagster pipeline."""
        mock_result = MagicMock()
        mock_result.success = True
        mock_result.run_id = "e2e-run-001"
        mock_materialize.return_value = mock_result

        from app.kafka.consumers import IngestRawConsumer

        consumer = IngestRawConsumer()
        trigger = DagsterTrigger()
        consumer.on_batch_complete = trigger.trigger_cleaning_pipeline

        # Simulate a batch-complete message
        consumer.handle(
            key="acme:src-001",
            value={
                "tenant_id": "acme",
                "source_id": "src-001",
                "row_count": 1000,
                "total_rows": 1000,
                "batch_complete": True,
            },
        )

        mock_materialize.assert_called_once()
