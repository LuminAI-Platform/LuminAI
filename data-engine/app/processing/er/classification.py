"""Entity Resolution (ER) Classification Engine.

Classifies evaluated candidate pairs into decision buckets based on configurable
confidence thresholds:
  - Match (S >= 0.90): Automatic merge into Golden Record.
  - Review (0.70 <= S < 0.90): Sent to er_candidates table for human analyst review.
  - Non-Match (S < 0.70): Discarded.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Literal

import polars as pl
from sqlalchemy import create_engine, text

from app.config import get_settings

logger = logging.getLogger(__name__)

ClassificationCategory = Literal["match", "review", "non_match"]

MATCH_THRESHOLD_DEFAULT = 0.90
REVIEW_THRESHOLD_DEFAULT = 0.70


def classify_pair(
    confidence_score: float,
    match_threshold: float = MATCH_THRESHOLD_DEFAULT,
    review_threshold: float = REVIEW_THRESHOLD_DEFAULT,
) -> ClassificationCategory:
    """Classify a single pair confidence score into a decision bucket."""
    score = float(confidence_score)
    if score >= match_threshold:
        return "match"
    elif score >= review_threshold:
        return "review"
    else:
        return "non_match"


def classify_candidate_pairs(
    evaluated_pairs: pl.DataFrame,
    score_col: str = "confidence_score",
    match_threshold: float = MATCH_THRESHOLD_DEFAULT,
    review_threshold: float = REVIEW_THRESHOLD_DEFAULT,
) -> tuple[pl.DataFrame, pl.DataFrame, pl.DataFrame]:
    """Classify an evaluated candidate pairs DataFrame into (matches, review, non_matches).

    Returns a 3-tuple of Polars DataFrames for matches, review candidates, and non-matches.
    Adds a ``decision`` column to each DataFrame.
    """
    if evaluated_pairs.height == 0:
        empty = evaluated_pairs.with_columns(pl.lit("").alias("decision"))
        return empty, empty, empty

    if score_col not in evaluated_pairs.columns:
        raise ValueError(f"Column '{score_col}' not found in evaluated_pairs DataFrame")

    decisions = [
        classify_pair(
            score,
            match_threshold=match_threshold,
            review_threshold=review_threshold,
        )
        for score in evaluated_pairs[score_col].to_list()
    ]

    classified_df = evaluated_pairs.with_columns(pl.Series("decision", decisions))

    matches_df = classified_df.filter(pl.col("decision") == "match")
    review_df = classified_df.filter(pl.col("decision") == "review")
    non_matches_df = classified_df.filter(pl.col("decision") == "non_match")

    logger.info(
        "Classification complete — total=%d, matches=%d, review=%d, non_matches=%d",
        classified_df.height,
        matches_df.height,
        review_df.height,
        non_matches_df.height,
    )

    return matches_df, review_df, non_matches_df


def persist_review_candidates(
    review_df: pl.DataFrame,
    tenant_id: str = "acme",
) -> int:
    """Persist review candidate pairs (0.70 <= S < 0.90) to er_candidates table.

    Attempts PostgreSQL first, falling back to local SQLite staging database if unavailable.
    Returns the number of candidate pairs persisted.
    """
    if review_df.height == 0:
        return 0

    settings = get_settings()

    db_url = (
        f"postgresql+pg8000://{settings.postgres_user}:{settings.postgres_password}"
        f"@{settings.postgres_host}:{settings.postgres_port}/{settings.postgres_db}"
    )

    create_table_sql = """
    CREATE TABLE IF NOT EXISTS er_candidates (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(255),
        record_id_a VARCHAR(255),
        record_id_b VARCHAR(255),
        confidence_score FLOAT,
        payload TEXT,
        status VARCHAR(50) DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """

    insert_sql = """
    INSERT INTO er_candidates (id, tenant_id, record_id_a, record_id_b, confidence_score, payload, status, created_at)
    VALUES (:id, :tenant_id, :record_id_a, :record_id_b, :confidence_score, :payload, 'PENDING', :created_at);
    """

    params = []
    now_utc = datetime.now(timezone.utc)

    for row in review_df.iter_rows(named=True):
        id_a = str(row.get("id_a", row.get("id_1", "")))
        id_b = str(row.get("id_b", row.get("id_2", "")))
        score = float(row.get("confidence_score", 0.0))

        params.append({
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "record_id_a": id_a,
            "record_id_b": id_b,
            "confidence_score": score,
            "payload": json.dumps(row),
            "created_at": now_utc,
        })

    # Try PostgreSQL first
    pg_engine = None
    try:
        pg_engine = create_engine(db_url, pool_pre_ping=True)
        with pg_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        with pg_engine.begin() as conn:
            conn.execute(text(create_table_sql))
            conn.execute(text(insert_sql), params)
        logger.info("Persisted %d ER review candidates to PostgreSQL er_candidates", len(params))
        return len(params)
    except Exception as exc:
        logger.warning("Could not persist to PostgreSQL (%s). Using SQLite fallback.", exc)
    finally:
        if pg_engine is not None:
            pg_engine.dispose()

    # SQLite fallback
    sqlite_engine = None
    try:
        os.makedirs(os.path.join("storage", "sqlite"), exist_ok=True)
        sqlite_path = os.path.join("storage", "sqlite", "er_staging.db")
        sqlite_engine = create_engine(f"sqlite:///{sqlite_path}")

        with sqlite_engine.begin() as conn:
            conn.execute(text(create_table_sql))
            conn.execute(text(insert_sql), params)
        logger.info("Persisted %d ER review candidates to SQLite er_candidates at %s", len(params), sqlite_path)
        return len(params)
    except Exception as exc:
        logger.error("Failed to persist ER review candidates to SQLite: %s", exc)
        return 0
    finally:
        if sqlite_engine is not None:
            sqlite_engine.dispose()
