"""Pipeline step checkpoint manager for partial execution and recovery.

Enables pipeline runs to checkpoint intermediate step outputs to Parquet,
allowing partial retries to skip already-successful assets and resume from
the exact point of failure.
"""

from __future__ import annotations

import logging
import os
import shutil
from typing import Optional

import polars as pl

logger = logging.getLogger(__name__)

DEFAULT_CHECKPOINT_DIR = os.path.join("storage", "checkpoints")


class CheckpointManager:
    """Manages reading and writing intermediate pipeline DataFrame checkpoints."""

    def __init__(self, base_dir: Optional[str] = None) -> None:
        self.base_dir = base_dir or DEFAULT_CHECKPOINT_DIR

    def _get_step_path(self, run_id: str, step_name: str) -> str:
        """Return the Parquet file path for a run's step."""
        clean_run_id = str(run_id).replace("..", "_").replace("/", "_").replace("\\", "_")
        clean_step = str(step_name).replace("..", "_").replace("/", "_").replace("\\", "_")
        return os.path.join(self.base_dir, clean_run_id, f"{clean_step}.parquet")

    def save_checkpoint(self, run_id: str, step_name: str, df: pl.DataFrame) -> Optional[str]:
        """Save an intermediate step DataFrame to Parquet storage."""
        if not run_id or not step_name or df is None:
            return None
        try:
            file_path = self._get_step_path(run_id, step_name)
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            df.write_parquet(file_path)
            logger.info("💾 Saved checkpoint for run %s at step '%s' (%d rows)", run_id, step_name, df.height)
            return file_path
        except Exception as exc:
            logger.warning("Could not save checkpoint for run %s step '%s': %s", run_id, step_name, exc)
            return None

    def load_checkpoint(self, run_id: str, step_name: str) -> Optional[pl.DataFrame]:
        """Load an intermediate step DataFrame from Parquet if available."""
        if not run_id or not step_name:
            return None
        file_path = self._get_step_path(run_id, step_name)
        if not os.path.exists(file_path):
            return None
        try:
            df = pl.read_parquet(file_path)
            logger.info("⏩ Reusing checkpoint for run %s at step '%s' (%d rows)", run_id, step_name, df.height)
            return df
        except Exception as exc:
            logger.warning("Could not read checkpoint from %s: %s", file_path, exc)
            return None

    def has_checkpoint(self, run_id: str, step_name: str) -> bool:
        """Check if a checkpoint exists for the given run and step."""
        if not run_id or not step_name:
            return False
        return os.path.exists(self._get_step_path(run_id, step_name))

    def clear_checkpoints(self, run_id: str) -> None:
        """Delete all checkpoints for a completed run."""
        if not run_id:
            return
        clean_run_id = str(run_id).replace("..", "_").replace("/", "_").replace("\\", "_")
        run_dir = os.path.join(self.base_dir, clean_run_id)
        if os.path.exists(run_dir):
            try:
                shutil.rmtree(run_dir, ignore_errors=True)
                logger.debug("Cleared checkpoints for run %s", run_id)
            except Exception as exc:
                logger.debug("Failed to clear checkpoints for %s: %s", run_id, exc)


_global_checkpoint_manager: Optional[CheckpointManager] = None


def get_checkpoint_manager() -> CheckpointManager:
    """Return the global singleton CheckpointManager."""
    global _global_checkpoint_manager
    if _global_checkpoint_manager is None:
        _global_checkpoint_manager = CheckpointManager()
    return _global_checkpoint_manager
