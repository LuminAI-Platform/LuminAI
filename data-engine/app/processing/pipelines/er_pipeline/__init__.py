"""Dagster asset pipeline for Entity Resolution (ER) & Golden Record Synthesis."""

from __future__ import annotations

from app.config import get_settings
from app.processing.checkpoint import get_checkpoint_manager
from app.processing.pipelines.er_pipeline.assets import (
    er_blocked_pairs,
    er_classified_pairs,
    er_golden_records,
    er_scored_pairs,
    staged_records_for_er,
)
from app.processing.pipelines.er_pipeline.golden_ops import (
    synthesize_and_persist_golden_records,
)
from app.processing.pipelines.er_pipeline.helpers import (
    DEFAULT_RETRY_POLICY,
    _extract_run_tags,
    get_synthetic_er_records,
)
from app.processing.pipelines.er_pipeline.staging_ops import fetch_staged_records

__all__ = [
    "get_settings",
    "get_checkpoint_manager",
    "DEFAULT_RETRY_POLICY",
    "_extract_run_tags",
    "get_synthetic_er_records",
    "fetch_staged_records",
    "synthesize_and_persist_golden_records",
    "staged_records_for_er",
    "er_blocked_pairs",
    "er_scored_pairs",
    "er_classified_pairs",
    "er_golden_records",
]
