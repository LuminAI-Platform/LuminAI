"""Entity Resolution (ER) Classification Engine.

Classifies evaluated candidate pairs into decision buckets based on configurable
confidence thresholds:
  - Match (S >= 0.90): Automatic merge into Golden Record.
  - Review (0.70 <= S < 0.90): Sent to er_candidates table for human analyst review.
  - Non-Match (S < 0.70): Discarded.
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
import os
import re
from typing import Any, Literal
import uuid

import polars as pl
from sqlalchemy import text


logger = logging.getLogger(__name__)

ClassificationCategory = Literal["match", "review", "non_match"]


def _safe_schema_name(tenant_id: str) -> str:
    """Sanitize tenant identifier to prevent search_path injection."""
    cleaned = str(tenant_id).replace("-", "_").strip()
    if not re.match(r"^[a-zA-Z0-9_]+$", cleaned):
        raise ValueError(f"Invalid tenant identifier: {tenant_id}")
    return f"tenant_{cleaned}" if not cleaned.startswith("tenant_") else cleaned


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
    """Classify an evaluated candidate pairs DataFrame into (matches, review, non_matches)."""
    if evaluated_pairs.height == 0:
        empty = evaluated_pairs.with_columns(pl.lit("").alias("decision"))
        return empty, empty, empty

    if score_col not in evaluated_pairs.columns:
        raise ValueError(f"Column '{score_col}' not found in evaluated_pairs DataFrame")

    decisions = [
        classify_pair(score, match_threshold=match_threshold, review_threshold=review_threshold)
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


def _to_uuid_str(val: Any, default: str = "00000000-0000-0000-0000-000000000001") -> str:
    """Ensure a string or object is formatted as a valid RFC-4122 UUID string."""
    if not val:
        return default
    s = str(val).strip()
    try:
        return str(uuid.UUID(s))
    except (ValueError, AttributeError):
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, s))


def _canonical_pair(a: str, b: str) -> tuple[str, str]:
    return (a, b) if a <= b else (b, a)


def _upsert_flyway_candidates(conn, review_df: pl.DataFrame, tenant_id: str, now_utc: datetime) -> int:
    existing_rows = conn.execute(
        text("SELECT id::text AS id, record_a_id::text AS a, record_b_id::text AS b, status FROM er_candidates;")
    ).mappings().fetchall()
    existing_map: dict[tuple[str, str], tuple[str, str]] = {
        _canonical_pair(str(r["a"]), str(r["b"])): (str(r["id"]), str(r["status"]))
        for r in existing_rows
    }

    inserts: list[dict[str, Any]] = []
    updates: list[dict[str, Any]] = []
    seen_batch: set[tuple[str, str]] = set()

    for row in review_df.iter_rows(named=True):
        id_a_raw = str(row.get("id_a", row.get("id_1", "")))
        id_b_raw = str(row.get("id_b", row.get("id_2", "")))
        ra_uuid, rb_uuid = _to_uuid_str(id_a_raw), _to_uuid_str(id_b_raw)
        pair_key = _canonical_pair(ra_uuid, rb_uuid)
        if pair_key in seen_batch:
            continue
        seen_batch.add(pair_key)

        score = float(row.get("confidence_score", 0.0))
        rec_tenant = str(row.get("tenant_id") or tenant_id)
        item = {
            "tenant_id": _to_uuid_str(rec_tenant),
            "record_a_id": ra_uuid,
            "record_b_id": rb_uuid,
            "similarity_score": score,
            "match_method": "JARO_WINKLER_LEVENSHTEIN",
            "record_a_snapshot": json.dumps({k: v for k, v in row.items() if k.endswith("_a") or k.endswith("_1")}),
            "record_b_snapshot": json.dumps({k: v for k, v in row.items() if k.endswith("_b") or k.endswith("_2")}),
            "match_rationale": f"Similarity score {score:.4f} within human review band [0.70, 0.90)",
            "comparison_details": json.dumps(row),
            "created_at": now_utc,
            "updated_at": now_utc,
        }
        existing = existing_map.get(pair_key)
        if existing:
            cand_id, cand_status = existing
            if cand_status == "PENDING":
                updates.append({**item, "id": cand_id})
        else:
            inserts.append({**item, "id": str(uuid.uuid4())})

    if inserts:
        conn.execute(
            text("""
                INSERT INTO er_candidates (
                    id, tenant_id, record_a_id, record_b_id, similarity_score,
                    match_method, status, record_a_snapshot, record_b_snapshot,
                    match_rationale, comparison_details, created_at, updated_at
                ) VALUES (
                    :id, :tenant_id, :record_a_id, :record_b_id, :similarity_score,
                    :match_method, 'PENDING', :record_a_snapshot, :record_b_snapshot,
                    :match_rationale, :comparison_details, :created_at, :updated_at
                );
            """),
            inserts,
        )
    if updates:
        conn.execute(
            text("""
                UPDATE er_candidates
                SET similarity_score = :similarity_score,
                    record_a_snapshot = :record_a_snapshot,
                    record_b_snapshot = :record_b_snapshot,
                    match_rationale = :match_rationale,
                    comparison_details = :comparison_details,
                    updated_at = :updated_at
                WHERE id = :id;
            """),
            updates,
        )
    return len(inserts) + len(updates)


def _upsert_declarative_candidates(conn, review_df: pl.DataFrame, tenant_id: str, now_utc: datetime) -> int:
    existing_rows = conn.execute(
        text("SELECT id, tenant_id, record_id_a, record_id_b, status FROM er_candidates;")
    ).mappings().fetchall()
    existing_map: dict[tuple[str, str, str], tuple[str, str]] = {
        (str(r["tenant_id"]), *_canonical_pair(str(r["record_id_a"]), str(r["record_id_b"]))): (
            str(r["id"]),
            str(r["status"]),
        )
        for r in existing_rows
    }

    inserts: list[dict[str, Any]] = []
    updates: list[dict[str, Any]] = []
    seen_batch: set[tuple[str, str, str]] = set()

    for row in review_df.iter_rows(named=True):
        id_a = str(row.get("id_a", row.get("id_1", "")))
        id_b = str(row.get("id_b", row.get("id_2", "")))
        rec_tenant = str(row.get("tenant_id") or tenant_id)
        pair_key = (rec_tenant, *_canonical_pair(id_a, id_b))
        if pair_key in seen_batch:
            continue
        seen_batch.add(pair_key)

        score = float(row.get("confidence_score", 0.0))
        item = {
            "tenant_id": rec_tenant,
            "record_id_a": id_a,
            "record_id_b": id_b,
            "confidence_score": score,
            "payload": json.dumps(row),
            "created_at": now_utc,
        }
        existing = existing_map.get(pair_key)
        if existing:
            cand_id, cand_status = existing
            if cand_status == "PENDING":
                updates.append({"id": cand_id, "confidence_score": score, "payload": item["payload"]})
        else:
            inserts.append({**item, "id": str(uuid.uuid4())})

    if inserts:
        conn.execute(
            text("""
                INSERT INTO er_candidates (id, tenant_id, record_id_a, record_id_b, confidence_score, payload, status, created_at)
                VALUES (:id, :tenant_id, :record_id_a, :record_id_b, :confidence_score, :payload, 'PENDING', :created_at);
            """),
            inserts,
        )
    if updates:
        conn.execute(
            text("""
                UPDATE er_candidates
                SET confidence_score = :confidence_score, payload = :payload
                WHERE id = :id;
            """),
            updates,
        )
    return len(inserts) + len(updates)


def persist_review_candidates(
    review_df: pl.DataFrame,
    tenant_id: str = "acme",
) -> int:
    """Persist review candidate pairs (0.70 <= S < 0.90) idempotently to er_candidates table."""
    if review_df.height == 0:
        return 0

    from sqlalchemy import inspect
    from app.db import ensure_tables_exist, get_engine, get_sqlite_engine

    now_utc = datetime.now(timezone.utc)
    schema_name = _safe_schema_name(tenant_id)

    try:
        pg_engine = get_engine()
        with pg_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        ensure_tables_exist(pg_engine)

        with pg_engine.connect() as conn:
            try:
                conn.execute(text(f'SET search_path TO "{schema_name}", tenant_default, public;'))
            except Exception:
                pass
            inspector = inspect(conn)
            cols: set[str] = set()
            for sc in (schema_name, "tenant_default", None):
                try:
                    cols = {c["name"] for c in inspector.get_columns("er_candidates", schema=sc)} if sc else {c["name"] for c in inspector.get_columns("er_candidates")}
                    if cols:
                        break
                except Exception:
                    continue
            try:
                conn.execute(text("RESET search_path;"))
            except Exception:
                pass

        with pg_engine.begin() as conn:
            try:
                conn.execute(text(f'SET search_path TO "{schema_name}", tenant_default, public;'))
            except Exception:
                pass
            if "record_a_id" in cols:
                count = _upsert_flyway_candidates(conn, review_df, tenant_id, now_utc)
            else:
                count = _upsert_declarative_candidates(conn, review_df, tenant_id, now_utc)
            try:
                conn.execute(text("RESET search_path;"))
            except Exception:
                pass

        logger.info("Persisted/updated %d ER review candidates in PostgreSQL er_candidates", count)
        return count
    except Exception as exc:
        logger.warning("Could not persist to PostgreSQL (%s). Using SQLite fallback.", exc)

    try:
        os.makedirs(os.path.join("storage", "sqlite"), exist_ok=True)
        sqlite_path = os.path.join("storage", "sqlite", "er_staging.db")
        sqlite_engine = get_sqlite_engine(sqlite_path)
        ensure_tables_exist(sqlite_engine)
        with sqlite_engine.begin() as conn:
            count = _upsert_declarative_candidates(conn, review_df, tenant_id, now_utc)
        logger.info("Persisted/updated %d ER review candidates in SQLite er_candidates at %s", count, sqlite_path)
        return count
    except Exception as exc:
        logger.error("Failed to persist ER review candidates to SQLite: %s", exc)
        return 0
