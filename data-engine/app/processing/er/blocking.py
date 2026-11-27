"""Entity Resolution (ER) Blocking Engine.

Implements candidate pair blocking to reduce pairwise comparison complexity from O(N^2) to O(N).
Groups records into candidate blocks using phonetic encoding (Metaphone) combined with
country/entity type, plus exact secondary blocks for emails and strong identifiers.
"""

from __future__ import annotations

import logging
import re
from typing import Any

import jellyfish
import polars as pl

from app.processing.er.semantic import canonicalize_name

logger = logging.getLogger(__name__)

_NAME_ALIAS_COLS = (
    "full_name",
    "canonical_name",
    "customer_name",
    "patient_name",
    "person_name",
    "contact_name",
    "company_name",
    "organization",
)
_EMAIL_COLS = ("email", "contact_email", "primary_email", "work_email", "user_email", "email_address")
_ID_COLS = ("mrn", "national_id", "ssn", "tax_id", "id_number", "entity_id", "customer_id", "account_id")
_NULL_UPPER = {"", "NULL", "NONE", "N/A", "NA", "-", "?", "0", "UNKNOWN", "UNDEFINED"}


def _resolve_row_name(row: dict[str, Any], name_col: str) -> str | None:
    val = row.get(name_col)
    if isinstance(val, str) and val.strip():
        return val
    if val is not None and str(val).strip():
        return str(val)
    for alias in _NAME_ALIAS_COLS:
        aval = row.get(alias)
        if aval is not None and str(aval).strip():
            return str(aval)
    first = str(row.get("first_name") or "").strip()
    last = str(row.get("last_name") or "").strip()
    combined = f"{first} {last}".strip()
    return combined or None


def generate_blocking_key(
    name: str | None,
    country: str | None = None,
    entity_type: str | None = None,
) -> str:
    """Generate a blocking key for a single record.

    Format: ``{Metaphone(CanonicalName)}_{Country}_{EntityType}``
    """
    if not name or not isinstance(name, str):
        meta_code = "EMPTY"
    else:
        canonical = canonicalize_name(name)
        cleaned_name = re.sub(r"[^a-zA-Z\s]", "", canonical or name).strip()
        if not cleaned_name:
            meta_code = "EMPTY"
        else:
            try:
                meta_code = jellyfish.metaphone(cleaned_name) or "EMPTY"
            except Exception:
                meta_code = "EMPTY"

    if not country or not isinstance(country, str) or not country.strip():
        norm_country = "GLOBAL"
    else:
        norm_country = country.strip().upper()

    if not entity_type or not isinstance(entity_type, str) or not entity_type.strip():
        norm_entity_type = "DEFAULT"
    else:
        norm_entity_type = entity_type.strip().title()

    return f"{meta_code}_{norm_country}_{norm_entity_type}"


def generate_blocking_keys_frame(
    df: pl.DataFrame | pl.LazyFrame,
    name_col: str = "name",
    country_col: str = "country",
    entity_type_col: str = "entity_type",
    output_col: str = "block_key",
) -> pl.DataFrame:
    """Add a blocking key column to a Polars DataFrame, falling back to name aliases if needed."""
    if isinstance(df, pl.LazyFrame):
        df = df.collect()

    cols = df.columns
    if name_col not in cols:
        df = df.with_columns(pl.lit(None).alias(name_col))
    if country_col not in cols:
        df = df.with_columns(pl.lit("GLOBAL").alias(country_col))
    if entity_type_col not in cols:
        df = df.with_columns(pl.lit("DEFAULT").alias(entity_type_col))

    block_keys = [
        generate_blocking_key(
            name=_resolve_row_name(row, name_col),
            country=row.get(country_col),
            entity_type=row.get(entity_type_col),
        )
        for row in df.iter_rows(named=True)
    ]
    return df.with_columns(pl.Series(output_col, block_keys))


def _collect_secondary_pair_indices(records: list[dict[str, Any]]) -> list[tuple[int, int, str]]:
    """Collect candidate index pairs (i < j) from exact email and domain identifier blocks."""
    sec_blocks: dict[str, list[int]] = {}
    for idx, row in enumerate(records):
        for ecol in _EMAIL_COLS:
            eval_raw = row.get(ecol)
            if eval_raw:
                em = str(eval_raw).strip().lower()
                if "@" in em:
                    sec_blocks.setdefault(f"EMAIL:{em}", []).append(idx)
                    break
        for idcol in _ID_COLS:
            ival_raw = row.get(idcol)
            if ival_raw is not None:
                iv = str(ival_raw).strip().upper()
                if iv and iv not in _NULL_UPPER:
                    sec_blocks.setdefault(f"ID:{idcol}:{iv}", []).append(idx)

    pairs: list[tuple[int, int, str]] = []
    seen_pairs: set[tuple[int, int]] = set()
    max_exact_block = 200
    for bkey, idx_list in sec_blocks.items():
        if len(idx_list) < 2 or len(idx_list) >= max_exact_block:
            continue
        for pos_a in range(len(idx_list)):
            for pos_b in range(pos_a + 1, len(idx_list)):
                ia, ib = idx_list[pos_a], idx_list[pos_b]
                pair = (min(ia, ib), max(ia, ib))
                if pair[0] != pair[1] and pair not in seen_pairs:
                    seen_pairs.add(pair)
                    pairs.append((pair[0], pair[1], bkey))
    return pairs


def generate_candidate_pairs(
    df: pl.DataFrame | pl.LazyFrame,
    id_col: str = "id",
    name_col: str = "name",
    country_col: str = "country",
    entity_type_col: str = "entity_type",
    block_key_col: str = "block_key",
) -> pl.DataFrame:
    """Generate candidate record pairs sharing a phonetic block key, email, or primary identifier."""
    if isinstance(df, pl.LazyFrame):
        df = df.collect()

    if block_key_col not in df.columns:
        df = generate_blocking_keys_frame(
            df,
            name_col=name_col,
            country_col=country_col,
            entity_type_col=entity_type_col,
            output_col=block_key_col,
        )

    orig_cols = df.columns
    informative_df = df.filter(
        pl.col(block_key_col).is_not_null()
        & (~pl.col(block_key_col).str.starts_with("EMPTY_"))
        & (pl.col(block_key_col) != "EMPTY")
    )

    frames: list[pl.DataFrame] = []
    if informative_df.height >= 2:
        left_df = informative_df.select([pl.col(col).alias(f"{col}_a") for col in orig_cols])
        right_df = informative_df.select([pl.col(col).alias(f"{col}_b") for col in orig_cols])
        joined = left_df.join(
            right_df,
            left_on=f"{block_key_col}_a",
            right_on=f"{block_key_col}_b",
            how="inner",
        )
        primary_pairs = joined.filter(pl.col(f"{id_col}_a") < pl.col(f"{id_col}_b")).with_columns(
            pl.col(f"{block_key_col}_a").alias("block_key")
        )
        if primary_pairs.height > 0:
            frames.append(primary_pairs)

    records = df.to_dicts()
    sec_pair_indices = _collect_secondary_pair_indices(records)
    if sec_pair_indices:
        sec_rows: list[dict[str, Any]] = []
        for ia, ib, bkey in sec_pair_indices:
            rec_a, rec_b = records[ia], records[ib]
            id_a, id_b = rec_a.get(id_col), rec_b.get(id_col)
            if id_a is None or id_b is None or id_a == id_b:
                continue
            try:
                swap = id_a > id_b
            except TypeError:
                swap = str(id_a) > str(id_b)
            if swap:
                rec_a, rec_b = rec_b, rec_a
            row_dict = {f"{c}_a": rec_a.get(c) for c in orig_cols}
            for c in orig_cols:
                row_dict[f"{c}_b"] = rec_b.get(c)
            row_dict["block_key"] = bkey
            sec_rows.append(row_dict)
        if sec_rows:
            frames.append(pl.DataFrame(sec_rows))

    if not frames:
        logger.info("Not enough records with valid blocking keys to generate candidate pairs.")
        dummy_cols = [f"{c}_a" for c in orig_cols] + [f"{c}_b" for c in orig_cols] + ["block_key"]
        return pl.DataFrame(schema={c: pl.Utf8 for c in dummy_cols})

    combined = pl.concat(frames, how="diagonal_relaxed") if len(frames) > 1 else frames[0]
    candidate_pairs = combined.unique(subset=[f"{id_col}_a", f"{id_col}_b"], keep="first", maintain_order=True)

    logger.info(
        "Candidate pair generation complete — input records=%d, candidate pairs=%d",
        df.height,
        candidate_pairs.height,
    )
    return candidate_pairs


def calculate_blocking_reduction_ratio(
    total_records: int, candidate_pairs_count: int
) -> float:
    """Calculate the reduction ratio of candidate pairs compared to full O(N^2) comparison space."""
    if total_records < 2:
        return 1.0
    total_possible_pairs = total_records * (total_records - 1) // 2
    if total_possible_pairs == 0:
        return 1.0
    reduction = 1.0 - (candidate_pairs_count / total_possible_pairs)
    return max(0.0, min(1.0, reduction))
