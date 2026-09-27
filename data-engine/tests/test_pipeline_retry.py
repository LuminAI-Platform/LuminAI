"""Tests for Pipeline Error Recovery and Retry Logic (Task 21 · MVP-21).

Covers:
  1. Dagster asset RetryPolicy configuration (max_retries=3, exponential backoff)
  2. RunTracker error history, failed step tracking, and retry count lifecycle
  3. POST /process/retry/{run_id} API endpoint validation and behavior
  4. Quarantine capture of invalid/unrecoverable records in cleaning pipeline
  5. CheckpointManager save, load, and partial pipeline recovery
"""

import os
import tempfile
import uuid
from unittest.mock import MagicMock, patch

import polars as pl
import pytest
from dagster import Backoff, build_asset_context
from fastapi.testclient import TestClient

from app.kafka.quarantine import QuarantineManager
from app.main import app
from app.processing.checkpoint import CheckpointManager
from app.processing.pipelines import cleaning_pipeline, er_pipeline
from app.processing.run_tracker import PipelineRunTracker

client = TestClient(app)


# ─── 1. Dagster Asset Retry Policy Tests ────────────────────────────────────


class TestAssetRetryPolicies:
    """Verify that all Dagster pipeline assets have max_retries=3 and exponential backoff."""

    @pytest.mark.parametrize(
        "asset_fn",
        [
            cleaning_pipeline.raw_ingestion_data,
            cleaning_pipeline.cleaned_ingestion_data,
            cleaning_pipeline.deduplicated_ingestion_data,
            cleaning_pipeline.validated_ingestion_data,
            cleaning_pipeline.staged_ingestion_data,
        ],
    )
    def test_cleaning_pipeline_assets_have_retry_policy(self, asset_fn):
        """Every cleaning pipeline asset must configure max_retries=3 with exponential backoff."""
        policy = asset_fn.op.retry_policy
        assert policy is not None, f"Asset '{asset_fn.key.to_user_string()}' missing retry_policy"
        assert policy.max_retries == 3
        assert policy.backoff == Backoff.EXPONENTIAL

    @pytest.mark.parametrize(
        "asset_fn",
        [
            er_pipeline.staged_records_for_er,
            er_pipeline.er_blocked_pairs,
            er_pipeline.er_scored_pairs,
            er_pipeline.er_classified_pairs,
            er_pipeline.er_golden_records,
        ],
    )
    def test_er_pipeline_assets_have_retry_policy(self, asset_fn):
        """Every ER pipeline asset must configure max_retries=3 with exponential backoff."""
        policy = asset_fn.op.retry_policy
        assert policy is not None, f"Asset '{asset_fn.key.to_user_string()}' missing retry_policy"
        assert policy.max_retries == 3
        assert policy.backoff == Backoff.EXPONENTIAL


# ─── 2. RunTracker Retry & Error History Tests ─────────────────────────────


class TestRunTrackerRetryLogic:
    """Verify RunTracker records error history, failed steps, and retry counts."""

    @pytest.fixture
    def tracker(self):
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            temp_path = f.name
        t = PipelineRunTracker(db_path=temp_path)
        yield t
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass

    def test_record_step_error_appends_to_history(self, tracker):
        """Step failure records step name, error message, and retry attempt in history."""
        run_id = "test-run-err-1"
        tracker.init_run(run_id, "cleaning_pipeline", "acme", "src-1")
        tracker.start_run(run_id)

        tracker.record_step_error(run_id, "cleaned_ingestion_data", "Type coercion error: invalid int")
        rec = tracker.get_status(run_id)

        assert rec.failed_step == "cleaned_ingestion_data"
        assert rec.error == "Type coercion error: invalid int"
        assert len(rec.error_history) == 1
        entry = rec.error_history[0]
        assert entry["step"] == "cleaned_ingestion_data"
        assert "Type coercion" in entry["error"]
        assert entry["retry_count"] == 0
        assert "timestamp" in entry

    def test_fail_run_records_failed_step_and_error(self, tracker):
        """fail_run records failed_step and adds entry to error history."""
        run_id = "test-run-err-2"
        tracker.init_run(run_id, "cleaning_pipeline", "acme", "src-1")
        tracker.start_run(run_id)
        tracker.update_step(run_id, "raw_ingestion_data")

        tracker.fail_run(
            run_id,
            error="Duplicate key violation",
            failed_step="deduplicated_ingestion_data",
        )
        rec = tracker.get_status(run_id)

        assert rec.status == "failed"
        assert rec.failed_step == "deduplicated_ingestion_data"
        assert rec.error == "Duplicate key violation"
        assert len(rec.error_history) == 1
        assert rec.error_history[0]["step"] == "deduplicated_ingestion_data"

    def test_retry_run_increments_count_and_resets_status(self, tracker):
        """retry_run increments retry_count by 1, sets status='running', clears error."""
        run_id = "test-run-retry-1"
        tracker.init_run(run_id, "cleaning_pipeline", "acme", "src-1")
        tracker.start_run(run_id)
        tracker.fail_run(run_id, error="MinIO timeout", failed_step="staged_ingestion_data")

        # First retry
        rec1 = tracker.retry_run(run_id)
        assert rec1.status == "running"
        assert rec1.retry_count == 1
        assert rec1.error is None
        assert "attempt 1" in rec1.message

        # Second retry
        tracker.fail_run(run_id, error="Network glitch", failed_step="staged_ingestion_data")
        rec2 = tracker.retry_run(run_id)
        assert rec2.retry_count == 2
        assert rec2.status == "running"
        assert len(rec2.error_history) == 2

    def test_sqlite_persistence_of_retry_and_error_history(self, tracker):
        """Ensure retry_count, failed_step, and error_history persist across instances."""
        run_id = "test-run-persist-retry"
        tracker.init_run(run_id, "er_pipeline", "tenant-alpha", "src-alpha")
        tracker.start_run(run_id)
        tracker.record_step_error(run_id, "er_scored_pairs", "OutOfMemoryError in blocking")
        tracker.fail_run(run_id, error="Blocking stage failed", failed_step="er_blocked_pairs")
        tracker.retry_run(run_id)

        # Reload from second tracker instance on same DB
        tracker2 = PipelineRunTracker(db_path=tracker.db_path)
        reloaded = tracker2.get_status(run_id)

        assert reloaded.run_id == run_id
        assert reloaded.status == "running"
        assert reloaded.retry_count == 1
        assert reloaded.failed_step == "er_blocked_pairs"
        assert len(reloaded.error_history) >= 1
        assert reloaded.error_history[0]["step"] == "er_scored_pairs"


# ─── 3. Quarantine Manager Integration Tests ────────────────────────────────


class TestQuarantineFailureCapture:
    """Verify that unrecoverable/invalid records are routed to QuarantineManager."""

    @pytest.fixture
    def temp_quarantine_db(self):
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            temp_path = f.name
        yield temp_path
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass

    def test_validated_data_quarantines_invalid_rows(self, temp_quarantine_db):
        """Rows failing ID, name, or email validation are quarantined into QuarantineManager."""
        mock_dead_letter = MagicMock()
        mock_raw = MagicMock()
        qm = QuarantineManager(
            db_path=temp_quarantine_db,
            dead_letter_producer=mock_dead_letter,
            ingest_raw_producer=mock_raw,
        )

        test_data = pl.DataFrame({
            "id": ["valid-1", "", "valid-3", "valid-4"],
            "name": ["Alice Smith", "Bob Jones", "", "David Brown"],
            "email": ["alice@example.com", "bob@example.com", "carol@example.com", "no-at-sign.com"],
        })

        context = build_asset_context(
            run_tags={
                "tenant_id": "test-tenant",
                "source_id": "test-src",
                "luminai_run_id": f"test-quarantine-{uuid.uuid4()}",
            }
        )

        with patch("app.kafka.quarantine.get_quarantine_manager", return_value=qm):
            result = cleaning_pipeline.validated_ingestion_data(context, test_data)

            # Only valid-1 passes all three checks
            assert result.height == 1
            assert result["id"].to_list() == ["valid-1"]

            # Quarantined messages should be recorded in SQLite
            quarantined, total = qm.list_messages(tenant_id="test-tenant")
            assert total == 3
            assert len(quarantined) == 3

            # Verify quarantine reasons
            reasons = [m.error_reason for m in quarantined]
            assert any("Empty/missing ID" in r for r in reasons)
            assert any("Empty/missing Name" in r for r in reasons)
            assert any("Missing '@'" in r for r in reasons)


# ─── 4. Checkpoint Manager Tests ───────────────────────────────────────────


class TestCheckpointManager:
    """Verify intermediate step DataFrame saving, loading, and cleanup."""

    @pytest.fixture
    def cp_mgr(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            mgr = CheckpointManager(base_dir=tmp_dir)
            yield mgr

    def test_save_and_load_checkpoint(self, cp_mgr):
        """Saved DataFrame can be retrieved identically via load_checkpoint."""
        run_id = "test-cp-run-1"
        step = "cleaned_ingestion_data"
        df = pl.DataFrame({
            "id": ["1", "2", "3"],
            "name": ["Alice", "Bob", "Charlie"],
            "score": [95.5, 88.0, 72.3],
        })

        path = cp_mgr.save_checkpoint(run_id, step, df)
        assert path is not None
        assert os.path.exists(path)
        assert cp_mgr.has_checkpoint(run_id, step) is True

        loaded = cp_mgr.load_checkpoint(run_id, step)
        assert loaded is not None
        assert loaded.height == 3
        assert loaded["name"].to_list() == ["Alice", "Bob", "Charlie"]

    def test_load_nonexistent_checkpoint_returns_none(self, cp_mgr):
        """Loading a missing checkpoint returns None safely without raising."""
        loaded = cp_mgr.load_checkpoint("unknown-run", "some_step")
        assert loaded is None
        assert cp_mgr.has_checkpoint("unknown-run", "some_step") is False

    def test_clear_checkpoints_removes_directory(self, cp_mgr):
        """clear_checkpoints cleans up all checkpoint files for the run."""
        run_id = "test-cp-run-clear"
        df = pl.DataFrame({"x": [1, 2]})
        cp_mgr.save_checkpoint(run_id, "step1", df)
        cp_mgr.save_checkpoint(run_id, "step2", df)
        assert cp_mgr.has_checkpoint(run_id, "step1") is True

        cp_mgr.clear_checkpoints(run_id)
        assert cp_mgr.has_checkpoint(run_id, "step1") is False
        assert cp_mgr.has_checkpoint(run_id, "step2") is False


# ─── 5. POST /process/retry/{run_id} API Tests ─────────────────────────────


class TestRetryApiEndpoint:
    """Tests for POST /process/retry/{run_id} endpoint."""

    @pytest.fixture
    def setup_failed_run(self):
        """Set up a failed pipeline run in the active tracker."""
        from app.processing.run_tracker import get_run_tracker

        tracker = get_run_tracker()
        run_id = f"retry-api-test-{uuid.uuid4()}"
        tracker.init_run(
            run_id=run_id,
            pipeline_name="cleaning_pipeline",
            tenant_id="acme",
            source_id="connector-test",
            total_steps=5,
            metadata={"options": {"max_rows": 500}},
        )
        tracker.start_run(run_id)
        tracker.update_step(run_id, "raw_ingestion_data")
        tracker.update_step(run_id, "cleaned_ingestion_data")
        tracker.fail_run(
            run_id,
            error="Connection timeout to staging store",
            failed_step="deduplicated_ingestion_data",
        )
        return run_id

    def test_retry_failed_run_returns_200(self, setup_failed_run):
        """Retrying a failed run returns 200 with running status and incremented retry_count."""
        run_id = setup_failed_run

        with patch("app.processing.trigger.DagsterTrigger.retry_pipeline") as mock_retry:
            response = client.post(f"/process/retry/{run_id}")
            assert response.status_code == 200
            data = response.json()

            assert data["run_id"] == run_id
            assert data["status"] == "running"
            assert data["retry_count"] == 1
            assert data["resumed_step"] == "deduplicated_ingestion_data"
            assert "scheduled for retry" in data["message"]

            mock_retry.assert_called_once_with(run_id)

    def test_status_endpoint_reflects_retry_and_error_history(self, setup_failed_run):
        """GET /process/status/{run_id} includes retry_count, failed_step, and error_history."""
        run_id = setup_failed_run

        with patch("app.processing.trigger.DagsterTrigger.retry_pipeline"):
            client.post(f"/process/retry/{run_id}")

        status_resp = client.get(f"/process/status/{run_id}")
        assert status_resp.status_code == 200
        data = status_resp.json()

        assert data["run_id"] == run_id
        assert data["retry_count"] == 1
        assert data["failed_step"] == "deduplicated_ingestion_data"
        assert len(data["error_history"]) >= 1
        assert data["error_history"][0]["step"] == "deduplicated_ingestion_data"

    def test_retry_rejects_non_failed_run(self):
        """Cannot retry a run that is currently queued, running, or completed."""
        from app.processing.run_tracker import get_run_tracker

        tracker = get_run_tracker()
        run_id = f"running-run-{uuid.uuid4()}"
        tracker.init_run(run_id, "cleaning_pipeline", "acme", "src-1")
        tracker.start_run(run_id)

        response = client.post(f"/process/retry/{run_id}")
        assert response.status_code == 400
        assert "Only failed runs can be retried" in response.json()["detail"]

    def test_retry_enforces_max_3_attempts(self):
        """Fails with 400 if a run has already reached 3 retries."""
        from app.processing.run_tracker import get_run_tracker

        tracker = get_run_tracker()
        run_id = f"max-retry-run-{uuid.uuid4()}"
        tracker.init_run(run_id, "cleaning_pipeline", "acme", "src-1")
        tracker.start_run(run_id)
        tracker.fail_run(run_id, "Failure 0")

        # Execute 3 retries
        tracker.retry_run(run_id)  # retry 1
        tracker.fail_run(run_id, "Failure 1")
        tracker.retry_run(run_id)  # retry 2
        tracker.fail_run(run_id, "Failure 2")
        tracker.retry_run(run_id)  # retry 3
        tracker.fail_run(run_id, "Failure 3")

        response = client.post(f"/process/retry/{run_id}")
        assert response.status_code == 400
        assert "Maximum retry limit of 3 exceeded" in response.json()["detail"]

    def test_retry_returns_404_for_unknown_run(self):
        """Retrying a non-existent run ID returns 404 Not Found."""
        response = client.post("/process/retry/nonexistent-run-id-999")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]
