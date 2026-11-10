"""Dagster asset definitions for Entity Resolution (ER) pipeline."""

import logging

import polars as pl
from dagster import AssetExecutionContext, asset

import app.processing.pipelines.er_pipeline as er_pipe
from app.processing.er.blocking import generate_candidate_pairs
from app.processing.er.classification import (
    classify_candidate_pairs,
    persist_review_candidates,
)
from app.processing.er.comparison import compare_candidate_pairs
from app.processing.pipelines.er_pipeline.golden_ops import (
    synthesize_and_persist_golden_records,
)
from app.processing.pipelines.er_pipeline.helpers import (
    DEFAULT_RETRY_POLICY,
    _extract_run_tags,
)
from app.processing.pipelines.er_pipeline.staging_ops import fetch_staged_records
from app.telemetry import record_er_metrics, trace_span

logger = logging.getLogger(__name__)


@asset(
    name="staged_records_for_er",
    group_name="entity_resolution",
    description="Loads validated records from staging database or Parquet for Entity Resolution.",
    retry_policy=DEFAULT_RETRY_POLICY,
)
def staged_records_for_er(context: AssetExecutionContext) -> pl.DataFrame:
    """Load staged records for ER processing."""
    return fetch_staged_records(context)


@asset(
    name="er_blocked_pairs",
    group_name="entity_resolution",
    description="Groups records into candidate comparison blocks using phonetic and categorical keys.",
    deps=[staged_records_for_er],
    retry_policy=DEFAULT_RETRY_POLICY,
)
def er_blocked_pairs(
    context: AssetExecutionContext,
    staged_records_for_er: pl.DataFrame,
) -> pl.DataFrame:
    """Generate candidate record pairs sharing blocking keys."""
    tags = _extract_run_tags(context)
    tenant_id = tags.get("tenant_id") or "acme"
    run_id = tags.get("luminai_run_id") or tags.get("dagster/run_id")
    cp_mgr = er_pipe.get_checkpoint_manager()
    if run_id:
        cached = cp_mgr.load_checkpoint(run_id, "er_blocked_pairs")
        if cached is not None:
            context.log.info(
                "⏩ Reusing checkpoint for er_blocked_pairs (%d rows)", cached.height
            )
            return cached

    context.log.info("🧱 er_blocked_pairs: generating candidate pairs…")

    with trace_span(
        "er.blocking",
        attributes={
            "tenant.id": str(tenant_id),
            "records.input": int(staged_records_for_er.height),
        },
    ):
        candidate_pairs = generate_candidate_pairs(
            staged_records_for_er,
            id_col="id",
            name_col="name",
            country_col="country",
            entity_type_col="entity_type",
        )
        record_er_metrics(
            tenant_id=tenant_id, candidate_pairs_count=candidate_pairs.height
        )
        context.log.info(
            "🧱 Blocking reduced search space — %d candidate pairs generated from %d records",
            candidate_pairs.height,
            staged_records_for_er.height,
        )
        if run_id:
            cp_mgr.save_checkpoint(run_id, "er_blocked_pairs", candidate_pairs)
        return candidate_pairs


@asset(
    name="er_scored_pairs",
    group_name="entity_resolution",
    description="Evaluates pairwise similarity metrics (Jaro-Winkler, Levenshtein) for candidate pairs.",
    deps=[er_blocked_pairs],
    retry_policy=DEFAULT_RETRY_POLICY,
)
def er_scored_pairs(
    context: AssetExecutionContext,
    er_blocked_pairs: pl.DataFrame,
) -> pl.DataFrame:
    """Compute weighted similarity scores for candidate pairs."""
    tags = _extract_run_tags(context)
    run_id = tags.get("luminai_run_id") or tags.get("dagster/run_id")
    cp_mgr = er_pipe.get_checkpoint_manager()
    if run_id:
        cached = cp_mgr.load_checkpoint(run_id, "er_scored_pairs")
        if cached is not None:
            context.log.info(
                "⏩ Reusing checkpoint for er_scored_pairs (%d rows)", cached.height
            )
            return cached

    context.log.info(
        "📊 er_scored_pairs: evaluating similarity for %d candidate pairs…",
        er_blocked_pairs.height,
    )
    scored = compare_candidate_pairs(er_blocked_pairs)
    context.log.info(
        "📊 Pairwise comparison complete — avg confidence=%.4f",
        scored["confidence_score"].mean() if scored.height > 0 else 0.0,
    )
    if run_id:
        cp_mgr.save_checkpoint(run_id, "er_scored_pairs", scored)
    return scored


@asset(
    name="er_classified_pairs",
    group_name="entity_resolution",
    description="Classifies pairs into Match, Review, and Non-Match; persists Review pairs to er_candidates.",
    deps=[er_scored_pairs],
    retry_policy=DEFAULT_RETRY_POLICY,
)
def er_classified_pairs(
    context: AssetExecutionContext,
    er_scored_pairs: pl.DataFrame,
) -> pl.DataFrame:
    """Classify candidate pairs and persist review candidates to database."""
    tags = _extract_run_tags(context)
    tenant_id = tags.get("tenant_id") or "acme"
    run_id = tags.get("luminai_run_id") or tags.get("dagster/run_id")
    cp_mgr = er_pipe.get_checkpoint_manager()
    if run_id:
        cached = cp_mgr.load_checkpoint(run_id, "er_classified_pairs")
        if cached is not None:
            context.log.info(
                "⏩ Reusing checkpoint for er_classified_pairs (%d rows)", cached.height
            )
            return cached

    context.log.info(
        "⚖️ er_classified_pairs: classifying %d pairs (tenant: %s)…",
        er_scored_pairs.height,
        tenant_id,
    )

    with trace_span(
        "er.classification",
        attributes={
            "tenant.id": str(tenant_id),
            "pairs.input": int(er_scored_pairs.height),
        },
    ):
        matches_df, review_df, non_matches_df = classify_candidate_pairs(
            er_scored_pairs
        )

        record_er_metrics(
            tenant_id=tenant_id,
            matches_count=matches_df.height,
            review_count=review_df.height,
            non_matches_count=non_matches_df.height,
        )

        context.log.info(
            "⚖️ Classification decisions — matches=%d, review=%d, non_matches=%d",
            matches_df.height,
            review_df.height,
            non_matches_df.height,
        )

        if review_df.height > 0:
            persisted = persist_review_candidates(review_df, tenant_id=tenant_id)
            context.log.info(
                "⚖️ Persisted %d review candidates to er_candidates table (tenant: %s)",
                persisted,
                tenant_id,
            )

        if run_id:
            cp_mgr.save_checkpoint(run_id, "er_classified_pairs", matches_df)

        return matches_df


@asset(
    name="er_golden_records",
    group_name="entity_resolution",
    description="Clusters matched pairs via Union-Find, synthesizes Golden Records, tracks provenance, and publishes Kafka events.",
    deps=[er_classified_pairs, staged_records_for_er],
    retry_policy=DEFAULT_RETRY_POLICY,
)
def er_golden_records(
    context: AssetExecutionContext,
    er_classified_pairs: pl.DataFrame,
    staged_records_for_er: pl.DataFrame,
) -> pl.DataFrame:
    """Synthesize canonical Golden Records, persist them, and publish to Kafka."""
    return synthesize_and_persist_golden_records(
        context, er_classified_pairs, staged_records_for_er
    )
