"""Entity Resolution (ER) Pairwise Comparison Engine.

Calculates string similarity metrics for candidate pairs using Jaro-Winkler
(for names/strings) and Levenshtein distance (for codes/IDs), weighted by attribute importance.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import logging
import os
from typing import Any, Mapping

import jellyfish
import polars as pl

from app.processing.er.semantic import semantic_name_similarity

logger = logging.getLogger(__name__)

# Default weights for attribute similarity score weighting
DEFAULT_WEIGHTS: dict[str, float] = {
    "name": 0.50,
    "dob": 0.20,
    "email": 0.30,
}


def jaro_winkler_similarity(str_a: str | None, str_b: str | None) -> float:
    """Calculate Jaro-Winkler similarity between two strings.

    Returns a float in range [0.0, 1.0].
    """
    if str_a is None or str_b is None:
        return 0.0
    s_a, s_b = str(str_a).strip().lower(), str(str_b).strip().lower()
    if not s_a and not s_b:
        return 1.0
    if not s_a or not s_b:
        return 0.0
    try:
        score = jellyfish.jaro_winkler_similarity(s_a, s_b)
        return max(0.0, min(1.0, float(score)))
    except Exception:
        return 0.0


def levenshtein_distance(str_a: str | None, str_b: str | None) -> int:
    """Calculate raw Levenshtein edit distance between two strings."""
    if str_a is None or str_b is None:
        val_a = "" if str_a is None else str(str_a).strip().lower()
        val_b = "" if str_b is None else str(str_b).strip().lower()
        return max(len(val_a), len(val_b))
    s_a, s_b = str(str_a).strip().lower(), str(str_b).strip().lower()
    return jellyfish.levenshtein_distance(s_a, s_b)


def levenshtein_similarity(str_a: str | None, str_b: str | None) -> float:
    """Calculate normalized Levenshtein similarity in range [0.0, 1.0].

    Formula: 1.0 - (levenshtein_distance / max_len)
    """
    if str_a is None or str_b is None:
        return 0.0
    s_a, s_b = str(str_a).strip(), str(str_b).strip()
    if not s_a and not s_b:
        return 1.0
    if not s_a or not s_b:
        return 0.0
    dist = levenshtein_distance(s_a, s_b)
    max_len = max(len(s_a), len(s_b))
    if max_len == 0:
        return 1.0
    sim = 1.0 - (dist / max_len)
    return max(0.0, min(1.0, float(sim)))


def calculate_pair_similarity_score(
    record_a: Mapping[str, Any],
    record_b: Mapping[str, Any],
    weights: Mapping[str, float] | None = None,
) -> dict[str, float]:
    """Calculate attribute-level similarities and weighted overall confidence score S.

    Combines string distances with semantic matching (nicknames & abbreviations) for name fields.

    Formula:
      S = sum(w_attr * S_attr) / sum(w_attr_active)

    Returns a dict with attribute scores and overall ``confidence_score`` in [0.0, 1.0].
    """
    w_map = dict(weights) if weights else dict(DEFAULT_WEIGHTS)
    total_weight = sum(w_map.values())
    if total_weight <= 0:
        total_weight = 1.0
        w_map = {k: v / total_weight for k, v in w_map.items()}

    scores: dict[str, float] = {}
    active_weight = 0.0
    weighted_sum = 0.0

    def _get_val(rec: Mapping[str, Any], a_name: str, side: str) -> Any:
        keys_to_try = [
            f"{a_name}_{side}",
            f"{a_name}_{'l' if side == 'a' else 'r'}",
            f"full_{a_name}_{side}",
            f"full_{a_name}_{'l' if side == 'a' else 'r'}",
            f"full_{a_name}",
            a_name,
        ]
        for k in keys_to_try:
            if k in rec and rec[k] is not None:
                return rec[k]
        return None

    for attr, weight in w_map.items():
        val_a = _get_val(record_a, attr, "a")
        val_b = _get_val(record_b, attr, "b")

        # Use semantic matching for name fields (handles Bob <-> Robert, IBM <-> International Business Machines)
        if attr == "name":
            jw = jaro_winkler_similarity(val_a, val_b)
            sem = semantic_name_similarity(val_a, val_b)
            attr_score = max(jw, sem)
        elif attr in ("dob", "code", "id", "ssn", "phone"):
            attr_score = levenshtein_similarity(val_a, val_b)
        else:
            attr_score = jaro_winkler_similarity(val_a, val_b)

        scores[f"score_{attr}"] = round(attr_score, 4)

        if val_a is not None or val_b is not None:
            active_weight += weight
            weighted_sum += weight * attr_score

    if active_weight > 0:
        confidence = weighted_sum / active_weight
    else:
        confidence = 0.0

    scores["confidence_score"] = round(max(0.0, min(1.0, float(confidence))), 4)
    return scores


def _vectorized_attribute_similarity(
    col_a: list[Any],
    col_b: list[Any],
    attr: str,
) -> list[float]:
    """Fast columnar similarity calculation over parallel lists."""
    if attr == "name":
        return [
            round(max(jaro_winkler_similarity(a, b), semantic_name_similarity(a, b)), 4)
            for a, b in zip(col_a, col_b)
        ]
    elif attr in ("dob", "code", "id", "ssn", "phone"):
        return [round(levenshtein_similarity(a, b), 4) for a, b in zip(col_a, col_b)]
    else:
        return [round(jaro_winkler_similarity(a, b), 4) for a, b in zip(col_a, col_b)]


def compare_candidate_pairs(
    candidate_pairs: pl.DataFrame,
    weights: Mapping[str, float] | None = None,
) -> pl.DataFrame:
    """Evaluate candidate record pairs DataFrame and compute similarity scores.

    Optimized for enterprise scale (100K+ pairs) using columnar vectorization and
    thread pool parallelization for multi-thousand pair batches.
    """
    if candidate_pairs.height == 0:
        return candidate_pairs.with_columns(pl.lit(0.0).alias("confidence_score"))

    w_map = dict(weights) if weights else dict(DEFAULT_WEIGHTS)
    total_weight = sum(w_map.values())
    if total_weight <= 0:
        total_weight = 1.0
        w_map = {k: v / total_weight for k, v in w_map.items()}

    # For large datasets (>10,000 pairs), process in parallel chunks
    chunk_size = 5000
    if candidate_pairs.height > chunk_size:
        num_chunks = (candidate_pairs.height + chunk_size - 1) // chunk_size
        chunks = [
            candidate_pairs.slice(i * chunk_size, chunk_size)
            for i in range(num_chunks)
        ]
        max_workers = min(os.cpu_count() or 4, 8)
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            processed_chunks = list(
                executor.map(lambda c: _evaluate_candidate_chunk(c, w_map), chunks)
            )
        result_df = pl.concat(processed_chunks)
    else:
        result_df = _evaluate_candidate_chunk(candidate_pairs, w_map)

    logger.info(
        "Evaluated candidate pairs — total pairs=%d, avg_score=%.4f",
        result_df.height,
        result_df["confidence_score"].mean() if result_df.height > 0 else 0.0,
    )
    return result_df


def _evaluate_candidate_chunk(
    chunk: pl.DataFrame,
    w_map: dict[str, float],
) -> pl.DataFrame:
    """Fast columnar evaluation of a single candidate pairs DataFrame chunk."""
    n_rows = chunk.height
    new_columns: list[pl.Series] = []
    active_weight_list = [0.0] * n_rows
    weighted_sum_list = [0.0] * n_rows

    def _find_col(df_cols: set[str], a_name: str, side: str) -> str | None:
        candidates = [
            f"{a_name}_{side}",
            f"{a_name}_{'l' if side == 'a' else 'r'}",
            f"full_{a_name}_{side}",
            f"full_{a_name}_{'l' if side == 'a' else 'r'}",
            f"full_{a_name}",
            a_name,
        ]
        for c in candidates:
            if c in df_cols:
                return c
        return None

    cols_set = set(chunk.columns)

    for attr, weight in w_map.items():
        col_a_name = _find_col(cols_set, attr, "a")
        col_b_name = _find_col(cols_set, attr, "b")

        if col_a_name is not None and col_b_name is not None:
            col_a = chunk[col_a_name].to_list()
            col_b = chunk[col_b_name].to_list()
            attr_scores = _vectorized_attribute_similarity(col_a, col_b, attr)
            for i in range(n_rows):
                if col_a[i] is not None or col_b[i] is not None:
                    active_weight_list[i] += weight
                    weighted_sum_list[i] += weight * attr_scores[i]
        else:
            attr_scores = [0.0] * n_rows

        new_columns.append(pl.Series(f"score_{attr}", attr_scores, dtype=pl.Float64))

    confidence_scores = [
        round(weighted_sum_list[i] / active_weight_list[i], 4) if active_weight_list[i] > 0 else 0.0
        for i in range(n_rows)
    ]
    new_columns.append(pl.Series("confidence_score", confidence_scores, dtype=pl.Float64))

    return chunk.with_columns(new_columns)

