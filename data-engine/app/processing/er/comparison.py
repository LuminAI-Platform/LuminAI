"""Entity Resolution (ER) Pairwise Comparison Engine.

Calculates string similarity metrics for candidate pairs using Jaro-Winkler
(for names/strings) and Levenshtein distance (for codes/IDs), weighted by attribute importance,
with verified identifier match/contradiction safeguards.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import logging
import os
import re
from typing import Any, Mapping

import jellyfish
import polars as pl

from app.processing.er.semantic import semantic_name_similarity

logger = logging.getLogger(__name__)

DOMAIN_IDENTIFIER_FIELDS: tuple[str, ...] = (
    "mrn",
    "ssn",
    "national_id",
    "tax_id",
    "id_number",
    "entity_id",
    "customer_id",
    "account_id",
)
_NULL_SENTINEL_UPPER = {"", "NULL", "NONE", "N/A", "NA", "-", "?", "0", "UNKNOWN"}
_ATTR_ALIASES: dict[str, tuple[str, ...]] = {
    "name": (
        "name",
        "full_name",
        "canonical_name",
        "customer_name",
        "patient_name",
        "person_name",
        "contact_name",
        "company_name",
    ),
    "email": ("email", "contact_email", "primary_email", "work_email", "user_email", "email_address"),
    "dob": ("dob", "date_of_birth", "birth_date", "birthdate"),
    "phone": ("phone", "contact_phone", "phone_e164", "phone_number", "mobile", "telephone"),
}

DEFAULT_WEIGHTS: dict[str, float] = {
    "name": 0.50,
    "dob": 0.20,
    "email": 0.30,
}


def _has_value(val: Any) -> bool:
    return val is not None and str(val).strip() != ""


def _norm_domain_id(val: Any) -> str | None:
    if val is None:
        return None
    s = str(val).strip().upper()
    return None if s in _NULL_SENTINEL_UPPER else s


def jaro_winkler_similarity(str_a: str | None, str_b: str | None) -> float:
    """Calculate Jaro-Winkler similarity between two strings in [0.0, 1.0]."""
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
    """Calculate normalized Levenshtein similarity in range [0.0, 1.0]."""
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


def _candidate_keys_for(attr: str, side: str) -> list[str]:
    opp_side = "l" if side == "a" else "r"
    base_names = _ATTR_ALIASES.get(attr, (attr,))
    keys: list[str] = []
    for base in base_names:
        keys.extend((f"{base}_{side}", f"{base}_{opp_side}"))
    keys.extend(base_names)
    return keys


def _get_val(rec: Mapping[str, Any], a_name: str, side: str) -> Any:
    for k in _candidate_keys_for(a_name, side):
        if k in rec and rec[k] is not None:
            return rec[k]
    return None


def _find_col(df_cols: set[str], a_name: str, side: str) -> str | None:
    for c in _candidate_keys_for(a_name, side):
        if c in df_cols:
            return c
    return None


def calculate_pair_similarity_score(
    record_a: Mapping[str, Any],
    record_b: Mapping[str, Any],
    weights: Mapping[str, float] | None = None,
) -> dict[str, float]:
    """Calculate attribute-level similarities and weighted overall confidence score S."""
    w_map = dict(weights) if weights else dict(DEFAULT_WEIGHTS)
    total_weight = sum(w_map.values())
    if total_weight <= 0:
        w_map = {k: 1.0 / max(1, len(w_map)) for k in w_map}

    scores: dict[str, float] = {}
    active_weight = 0.0
    weighted_sum = 0.0

    # Contradiction Guard + exact domain identifier match
    exact_id_match = False
    for id_field in DOMAIN_IDENTIFIER_FIELDS:
        id_a = _norm_domain_id(_get_val(record_a, id_field, "a"))
        id_b = _norm_domain_id(_get_val(record_b, id_field, "b"))
        if id_a is not None and id_b is not None:
            if id_a != id_b:
                return {"confidence_score": 0.0, "identifier_conflict": 1.0}
            exact_id_match = True

    exact_email_match = False
    for attr, weight in w_map.items():
        val_a = _get_val(record_a, attr, "a")
        val_b = _get_val(record_b, attr, "b")

        has_a = _has_value(val_a)
        has_b = _has_value(val_b)
        if not has_a and not has_b:
            scores[f"score_{attr}"] = 0.0
            continue
        if not has_a or not has_b:
            scores[f"score_{attr}"] = 0.0
            active_weight += weight
            continue

        if attr == "name":
            attr_score = _name_similarity(val_a, val_b)
        elif attr in ("dob", "code", "id", "ssn", "phone"):
            attr_score = levenshtein_similarity(val_a, val_b)
        elif attr == "email":
            attr_score = _email_similarity(val_a, val_b)
            if str(val_a).strip().lower() == str(val_b).strip().lower() and "@" in str(val_a):
                exact_email_match = True
        else:
            attr_score = jaro_winkler_similarity(val_a, val_b)

        scores[f"score_{attr}"] = round(attr_score, 4)
        active_weight += weight
        weighted_sum += weight * attr_score

    confidence = (weighted_sum / active_weight) if active_weight > 0 else 0.0
    name_score = scores.get("score_name", 1.0)
    if exact_id_match:
        if _has_value(_get_val(record_a, "name", "a")) and _has_value(_get_val(record_b, "name", "b")) and name_score < 0.60:
            confidence = min(confidence or 0.75, 0.75)
        else:
            confidence = max(confidence, 0.99)
    elif weights is None and exact_email_match and (
        not _has_value(_get_val(record_a, "name", "a"))
        or not _has_value(_get_val(record_b, "name", "b"))
        or name_score >= 0.70
    ):
        confidence = max(confidence, 0.95)

    scores["confidence_score"] = round(max(0.0, min(1.0, float(confidence))), 4)
    return scores


def _email_similarity(val_a: Any, val_b: Any) -> float:
    if val_a is None or val_b is None:
        return 0.0
    sa, sb = str(val_a).strip().lower(), str(val_b).strip().lower()
    if not sa or not sb:
        return 1.0 if (not sa and not sb) else 0.0
    if sa == sb:
        return 1.0
    if "@" in sa and "@" in sb:
        la, da = sa.split("@", 1)
        lb, db = sb.split("@", 1)
        if re.findall(r"\d+", la) != re.findall(r"\d+", lb):
            return 0.0
        if la != lb and da == db:
            tokens_a = [t for t in re.split(r"[._+\-]+", la) if len(t) >= 4]
            tokens_b = [t for t in re.split(r"[._+\-]+", lb) if len(t) >= 4]
            shared_token = any(t in lb for t in tokens_a) or any(t in la for t in tokens_b)
            if not shared_token and jaro_winkler_similarity(la, lb) < 0.50 and jellyfish.levenshtein_distance(la, lb) > 1:
                return 0.0
    return jaro_winkler_similarity(sa, sb)


def _name_similarity(val_a: Any, val_b: Any) -> float:
    if val_a is None or val_b is None:
        return 0.0
    sa, sb = str(val_a).strip().lower(), str(val_b).strip().lower()
    if re.findall(r"\d+", sa) != re.findall(r"\d+", sb):
        return 0.0
    return max(jaro_winkler_similarity(val_a, val_b), semantic_name_similarity(val_a, val_b))


def _vectorized_attribute_similarity(
    col_a: list[Any],
    col_b: list[Any],
    attr: str,
) -> list[float]:
    if attr == "name":
        return [round(_name_similarity(a, b), 4) for a, b in zip(col_a, col_b)]
    if attr in ("dob", "code", "id", "ssn", "phone"):
        return [round(levenshtein_similarity(a, b), 4) for a, b in zip(col_a, col_b)]
    if attr == "email":
        return [round(_email_similarity(a, b), 4) for a, b in zip(col_a, col_b)]
    return [round(jaro_winkler_similarity(a, b), 4) for a, b in zip(col_a, col_b)]


def compare_candidate_pairs(
    candidate_pairs: pl.DataFrame,
    weights: Mapping[str, float] | None = None,
) -> pl.DataFrame:
    """Evaluate candidate record pairs DataFrame and compute similarity scores."""
    if candidate_pairs.height == 0:
        return candidate_pairs.with_columns(pl.lit(0.0).alias("confidence_score"))

    w_map = dict(weights) if weights else dict(DEFAULT_WEIGHTS)
    if sum(w_map.values()) <= 0:
        w_map = {k: 1.0 / max(1, len(w_map)) for k in w_map}

    chunk_size = 5000
    if candidate_pairs.height > chunk_size:
        num_chunks = (candidate_pairs.height + chunk_size - 1) // chunk_size
        chunks = [candidate_pairs.slice(i * chunk_size, chunk_size) for i in range(num_chunks)]
        max_workers = min(os.cpu_count() or 4, 8)
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            processed_chunks = list(executor.map(lambda c: _evaluate_candidate_chunk(c, w_map, weights is None), chunks))
        result_df = pl.concat(processed_chunks)
    else:
        result_df = _evaluate_candidate_chunk(candidate_pairs, w_map, weights is None)

    logger.info(
        "Evaluated candidate pairs — total pairs=%d, avg_score=%.4f",
        result_df.height,
        result_df["confidence_score"].mean() if result_df.height > 0 else 0.0,
    )
    return result_df


def _evaluate_candidate_chunk(
    chunk: pl.DataFrame,
    w_map: dict[str, float],
    allow_rule_boosts: bool = True,
) -> pl.DataFrame:
    """Fast columnar evaluation of a single candidate pairs DataFrame chunk."""
    n_rows = chunk.height
    new_columns: list[pl.Series] = []
    active_weight_list = [0.0] * n_rows
    weighted_sum_list = [0.0] * n_rows
    cols_set = set(chunk.columns)

    name_scores: list[float] = [1.0] * n_rows
    has_both_names: list[bool] = [False] * n_rows
    exact_email_flags: list[bool] = [False] * n_rows

    for attr, weight in w_map.items():
        col_a_name = _find_col(cols_set, attr, "a")
        col_b_name = _find_col(cols_set, attr, "b")

        if col_a_name is not None and col_b_name is not None:
            col_a = chunk[col_a_name].to_list()
            col_b = chunk[col_b_name].to_list()
            attr_scores = _vectorized_attribute_similarity(col_a, col_b, attr)
            for i in range(n_rows):
                ha, hb = _has_value(col_a[i]), _has_value(col_b[i])
                if ha or hb:
                    active_weight_list[i] += weight
                    weighted_sum_list[i] += weight * attr_scores[i]
                if attr == "name" and ha and hb:
                    has_both_names[i] = True
                    name_scores[i] = attr_scores[i]
                elif attr == "email" and ha and hb:
                    ea, eb = str(col_a[i]).strip().lower(), str(col_b[i]).strip().lower()
                    if ea == eb and "@" in ea:
                        exact_email_flags[i] = True
        else:
            attr_scores = [0.0] * n_rows

        new_columns.append(pl.Series(f"score_{attr}", attr_scores, dtype=pl.Float64))

    conflict_flags = [False] * n_rows
    exact_id_flags = [False] * n_rows
    for id_field in DOMAIN_IDENTIFIER_FIELDS:
        id_col_a = _find_col(cols_set, id_field, "a")
        id_col_b = _find_col(cols_set, id_field, "b")
        if id_col_a is not None and id_col_b is not None:
            vals_a = chunk[id_col_a].to_list()
            vals_b = chunk[id_col_b].to_list()
            for i in range(n_rows):
                na = _norm_domain_id(vals_a[i])
                nb = _norm_domain_id(vals_b[i])
                if na is not None and nb is not None:
                    if na != nb:
                        conflict_flags[i] = True
                    else:
                        exact_id_flags[i] = True

    confidence_scores: list[float] = []
    for i in range(n_rows):
        if conflict_flags[i]:
            confidence_scores.append(0.0)
            continue
        score = round(weighted_sum_list[i] / active_weight_list[i], 4) if active_weight_list[i] > 0 else 0.0
        if exact_id_flags[i]:
            if has_both_names[i] and name_scores[i] < 0.60:
                score = min(score or 0.75, 0.75)
            else:
                score = max(score, 0.99)
        elif allow_rule_boosts and exact_email_flags[i] and (not has_both_names[i] or name_scores[i] >= 0.70):
            score = max(score, 0.95)
        confidence_scores.append(score)

    new_columns.append(pl.Series("confidence_score", confidence_scores, dtype=pl.Float64))
    return chunk.with_columns(new_columns)
