"""Unit tests for PipelineRunTracker and Dagster status integration."""

import os
import tempfile
from unittest.mock import MagicMock, patch

import pytest

from app.processing.run_tracker import PipelineRunTracker


@pytest.fixture
def temp_tracker():
    """Create a tracker with an isolated temporary SQLite database."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        temp_path = f.name
    tracker = PipelineRunTracker(db_path=temp_path)
    yield tracker
    if os.path.exists(temp_path):
        try:
            os.remove(temp_path)
        except OSError:
            pass


class TestPipelineRunTrackerLifecycle:
    """Tests for run lifecycle state machine (queued -> running -> steps -> completed/failed)."""

    def test_init_run(self, temp_tracker):
        rec = temp_tracker.init_run(
            run_id="run-1",
            pipeline_name="cleaning_pipeline",
            tenant_id="acme",
            source_id="crm-1",
            total_steps=5,
        )
        assert rec.run_id == "run-1"
        assert rec.status == "queued"
        assert rec.progress_pct == 0
        assert rec.total_steps == 5
        assert "queued" in rec.message

    def test_start_run(self, temp_tracker):
        temp_tracker.init_run("run-2", "cleaning_pipeline", "acme", "crm-1")
        rec = temp_tracker.start_run("run-2", message="Starting now...")
        assert rec.status == "running"
        assert rec.started_at is not None
        assert rec.message == "Starting now..."

    def test_update_step_progress(self, temp_tracker):
        temp_tracker.init_run("run-3", "cleaning_pipeline", "acme", "crm-1", total_steps=5)
        temp_tracker.start_run("run-3")

        # Step 1: 1 / 5 = 20%
        rec = temp_tracker.update_step("run-3", "raw_ingestion_data")
        assert rec.current_step == "raw_ingestion_data"
        assert rec.steps_completed == ["raw_ingestion_data"]
        assert rec.progress_pct == 20

        # Step 2: 2 / 5 = 40%
        rec = temp_tracker.update_step("run-3", "cleaned_ingestion_data")
        assert rec.steps_completed == ["raw_ingestion_data", "cleaned_ingestion_data"]
        assert rec.progress_pct == 40

    def test_complete_run(self, temp_tracker):
        temp_tracker.init_run("run-4", "cleaning_pipeline", "acme", "crm-1")
        temp_tracker.start_run("run-4")
        temp_tracker.update_step("run-4", "raw_ingestion_data")

        rec = temp_tracker.complete_run("run-4", dagster_run_id="dag-xyz-123")
        assert rec.status == "completed"
        assert rec.progress_pct == 100
        assert rec.completed_at is not None
        assert rec.dagster_run_id == "dag-xyz-123"

    def test_fail_run(self, temp_tracker):
        temp_tracker.init_run("run-5", "cleaning_pipeline", "acme", "crm-1")
        temp_tracker.start_run("run-5")

        rec = temp_tracker.fail_run("run-5", error="Connection timeout to MinIO")
        assert rec.status == "failed"
        assert rec.error == "Connection timeout to MinIO"
        assert rec.completed_at is not None
        assert "Connection timeout" in rec.message


class TestPipelineRunTrackerPersistence:
    """Tests for SQLite persistence across tracker instances."""

    def test_persistence_across_instances(self):
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            temp_path = f.name

        try:
            tracker1 = PipelineRunTracker(db_path=temp_path)
            tracker1.init_run("run-persist", "er_pipeline", "acme", "crm", total_steps=5)
            tracker1.start_run("run-persist")
            tracker1.update_step("run-persist", "staged_records_for_er")

            # Create a second tracker pointing to the same db
            tracker2 = PipelineRunTracker(db_path=temp_path)
            rec = tracker2.get_status("run-persist")

            assert rec.run_id == "run-persist"
            assert rec.status == "running"
            assert rec.progress_pct == 20
            assert rec.current_step == "staged_records_for_er"
            assert "staged_records_for_er" in rec.steps_completed
        finally:
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except OSError:
                    pass


class TestUnknownRunAndGraphQLFallback:
    """Tests for handling non-existent runs and Dagster GraphQL integration."""

    def test_unknown_run_returns_failed_with_clear_message(self, temp_tracker):
        rec = temp_tracker.get_status("completely-unknown-run-id")
        assert rec.run_id == "completely-unknown-run-id"
        assert rec.status == "failed"
        assert rec.progress_pct == 0
        assert "not found" in rec.message

    def test_dagster_graphql_success_mapping(self, temp_tracker):
        mock_response_data = b"""{
            "data": {
                "pipelineRunOrError": {
                    "__typename": "Run",
                    "runId": "dagster-run-123",
                    "status": "SUCCESS",
                    "stepStats": [
                        {"stepKey": "asset1", "status": "SUCCESS"},
                        {"stepKey": "asset2", "status": "SUCCESS"}
                    ]
                }
            }
        }"""
        mock_cm = MagicMock()
        mock_cm.__enter__.return_value.read.return_value = mock_response_data

        with patch("urllib.request.urlopen", return_value=mock_cm):
            rec = temp_tracker.get_status("dagster-run-123")
            assert rec.run_id == "dagster-run-123"
            assert rec.status == "completed"
            assert rec.progress_pct == 100
            assert rec.steps_completed == ["asset1", "asset2"]
