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
from typing import Any, Literal

import polars as pl
from sqlalchemy import text


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


def _to_uuid_str(
    val: Any, default: str = "00000000-0000-0000-0000-000000000001"
) -> str:
    """Ensure a string or object is formatted as a valid RFC-4122 UUID string."""
    if not val:
        return default
    s = str(val).strip()
    try:
        return str(uuid.UUID(s))
    except (ValueError, AttributeError):
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, s))


def persist_review_candidates(
    review_df: pl.DataFrame,
    tenant_id: str = "acme",
) -> int:
    """Persist review candidate pairs (0.70 <= S < 0.90) to er_candidates table.

    Dynamically aligns with Flyway PostgreSQL migrations (record_a_id, record_b_id, similarity_score)
    or declarative SQLite schema (record_id_a, record_id_b, confidence_score).
    Returns the number of candidate pairs persisted.
    """
    if review_df.height == 0:
        return 0

    from sqlalchemy import inspect
    from app.db import ensure_tables_exist, get_engine, get_sqlite_engine

    now_utc = datetime.now(timezone.utc)

    # Try PostgreSQL first
    try:
        pg_engine = get_engine()
        with pg_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        ensure_tables_exist(pg_engine)

        with pg_engine.connect() as conn:
            try:
                conn.execute(text("SET search_path TO tenant_default, public;"))
            except Exception:
                pass
            inspector = inspect(conn)
            cols = set()
            try:
                cols = {
                    c["name"]
                    for c in inspector.get_columns(
                        "er_candidates", schema="tenant_default"
                    )
                }
            except Exception:
                pass
            if not cols:
                try:
                    cols = {c["name"] for c in inspector.get_columns("er_candidates")}
                except Exception:
                    cols = set()

        with pg_engine.begin() as conn:
            try:
                conn.execute(text("SET search_path TO tenant_default, public;"))
            except Exception:
                pass

            if "record_a_id" in cols:
                # PostgreSQL Flyway schema (V5 / V8 / Core Backend JPA)
                insert_sql = """
                INSERT INTO er_candidates (
                    id, tenant_id, record_a_id, record_b_id, similarity_score,
                    match_method, status, record_a_snapshot, record_b_snapshot,
                    match_rationale, comparison_details, created_at, updated_at
                ) VALUES (
                    :id, :tenant_id, :record_a_id, :record_b_id, :similarity_score,
                    :match_method, 'PENDING', :record_a_snapshot, :record_b_snapshot,
                    :match_rationale, :comparison_details, :created_at, :updated_at
                );
                """
                params = []
                for row in review_df.iter_rows(named=True):
                    id_a = str(row.get("id_a", row.get("id_1", "")))
                    id_b = str(row.get("id_b", row.get("id_2", "")))
                    score = float(row.get("confidence_score", 0.0))
                    rec_tenant = str(row.get("tenant_id") or tenant_id)
                    params.append(
                        {
                            "id": str(uuid.uuid4()),
                            "tenant_id": _to_uuid_str(rec_tenant),
                            "record_a_id": _to_uuid_str(id_a),
                            "record_b_id": _to_uuid_str(id_b),
                            "similarity_score": score,
                            "match_method": "JARO_WINKLER_LEVENSHTEIN",
                            "record_a_snapshot": json.dumps(
                                {
                                    k: v
                                    for k, v in row.items()
                                    if k.endswith("_a") or k.endswith("_1")
                                }
                            ),
                            "record_b_snapshot": json.dumps(
                                {
                                    k: v
                                    for k, v in row.items()
                                    if k.endswith("_b") or k.endswith("_2")
                                }
                            ),
                            "match_rationale": f"Similarity score {score:.4f} within human review band [0.70, 0.90)",
                            "comparison_details": json.dumps(row),
                            "created_at": now_utc,
                            "updated_at": now_utc,
                        }
                    )
                conn.execute(text(insert_sql), params)
            else:
                # Declarative SQLAlchemy schema
                insert_sql = """
                INSERT INTO er_candidates (id, tenant_id, record_id_a, record_id_b, confidence_score, payload, status, created_at)
                VALUES (:id, :tenant_id, :record_id_a, :record_id_b, :confidence_score, :payload, 'PENDING', :created_at);
                """
                params = []
                for row in review_df.iter_rows(named=True):
                    id_a = str(row.get("id_a", row.get("id_1", "")))
                    id_b = str(row.get("id_b", row.get("id_2", "")))
                    score = float(row.get("confidence_score", 0.0))
                    params.append(
                        {
                            "id": str(uuid.uuid4()),
                            "tenant_id": str(row.get("tenant_id") or tenant_id),
                            "record_id_a": id_a,
                            "record_id_b": id_b,
                            "confidence_score": score,
                            "payload": json.dumps(row),
                            "created_at": now_utc,
                        }
                    )
                conn.execute(text(insert_sql), params)

        logger.info(
            "Persisted %d ER review candidates to PostgreSQL er_candidates",
            len(review_df),
        )
        return review_df.height
    except Exception as exc:
        logger.warning(
            "Could not persist to PostgreSQL (%s). Using SQLite fallback.", exc
        )

    # SQLite fallback
    try:
        os.makedirs(os.path.join("storage", "sqlite"), exist_ok=True)
        sqlite_path = os.path.join("storage", "sqlite", "er_staging.db")
        sqlite_engine = get_sqlite_engine(sqlite_path)
        ensure_tables_exist(sqlite_engine)

        insert_sql = """
        INSERT INTO er_candidates (id, tenant_id, record_id_a, record_id_b, confidence_score, payload, status, created_at)
        VALUES (:id, :tenant_id, :record_id_a, :record_id_b, :confidence_score, :payload, 'PENDING', :created_at);
        """
        params = []
        for row in review_df.iter_rows(named=True):
            id_a = str(row.get("id_a", row.get("id_1", "")))
            id_b = str(row.get("id_b", row.get("id_2", "")))
            score = float(row.get("confidence_score", 0.0))
            params.append(
                {
                    "id": str(uuid.uuid4()),
                    "tenant_id": str(row.get("tenant_id") or tenant_id),
                    "record_id_a": id_a,
                    "record_id_b": id_b,
                    "confidence_score": score,
                    "payload": json.dumps(row),
                    "created_at": now_utc,
                }
            )

        with sqlite_engine.begin() as conn:
            conn.execute(text(insert_sql), params)
        logger.info(
            "Persisted %d ER review candidates to SQLite er_candidates at %s",
            len(params),
            sqlite_path,
        )
        return len(params)
    except Exception as exc:
        logger.error("Failed to persist ER review candidates to SQLite: %s", exc)
        return 0
