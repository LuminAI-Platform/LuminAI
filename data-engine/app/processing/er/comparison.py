"""Entity Resolution (ER) Pairwise Comparison Engine.

Calculates string similarity metrics for candidate pairs using Jaro-Winkler
(for names/strings) and Levenshtein distance (for codes/IDs), weighted by attribute importance.
"""

from __future__ import annotations

import logging
from typing import Any, Mapping

import jellyfish
import polars as pl

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

    for attr, weight in w_map.items():
        val_a = record_a.get(f"{attr}_a", record_a.get(attr))
        val_b = record_b.get(f"{attr}_b", record_b.get(attr))

        # Use Levenshtein for code/ID/date fields, Jaro-Winkler for general text
        if attr in ("dob", "code", "id", "ssn", "phone"):
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


def compare_candidate_pairs(
    candidate_pairs: pl.DataFrame,
    weights: Mapping[str, float] | None = None,
) -> pl.DataFrame:
    """Evaluate candidate record pairs DataFrame and compute similarity scores.

    Applies vectorized/rowwise comparison to candidate pairs DataFrame. Adds
    ``confidence_score`` and attribute similarity score columns.
    """
    if candidate_pairs.height == 0:
        return candidate_pairs.with_columns(pl.lit(0.0).alias("confidence_score"))

    evaluated_rows = []
    for row in candidate_pairs.iter_rows(named=True):
        sim_results = calculate_pair_similarity_score(row, row, weights=weights)
        row_res = dict(row)
        row_res.update(sim_results)
        evaluated_rows.append(row_res)

    result_df = pl.DataFrame(evaluated_rows)
    logger.info(
        "Evaluated candidate pairs — total pairs=%d, avg_score=%.4f",
        result_df.height,
        result_df["confidence_score"].mean() if result_df.height > 0 else 0.0,
    )
    return result_df
