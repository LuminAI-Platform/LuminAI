"""Entity Resolution (ER) Blocking Engine.

Implements candidate pair blocking to reduce pairwise comparison complexity from O(N^2) to O(N).
Groups records into candidate blocks using phonetic encoding (Metaphone/Soundex) combined with
country and entity type attributes.
"""

from __future__ import annotations

import logging
import re
from typing import Any

import jellyfish
import polars as pl

logger = logging.getLogger(__name__)


def generate_blocking_key(
    name: str | None,
    country: str | None = None,
    entity_type: str | None = None,
) -> str:
    """Generate a blocking key for a single record.

    Format: ``{Metaphone(Name)}_{Country}_{EntityType}``

    Handles edge cases like null values, special characters, whitespace, and numbers.
    """
    # 1. Clean and normalize name
    if not name or not isinstance(name, str):
        meta_code = "EMPTY"
    else:
        # Strip non-alphabetic characters except spaces for phonetic processing
        cleaned_name = re.sub(r"[^a-zA-Z\s]", "", name).strip()
        if not cleaned_name:
            meta_code = "EMPTY"
        else:
            try:
                meta_code = jellyfish.metaphone(cleaned_name)
                if not meta_code:
                    meta_code = "EMPTY"
            except Exception:
                meta_code = "EMPTY"

    # 2. Normalize country
    if not country or not isinstance(country, str) or not country.strip():
        norm_country = "GLOBAL"
    else:
        norm_country = country.strip().upper()

    # 3. Normalize entity_type
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
    """Add a blocking key column to a Polars DataFrame using map_elements or expressions."""
    if isinstance(df, pl.LazyFrame):
        df = df.collect()

    cols = df.columns

    # Fill missing optional columns if not in DataFrame
    if name_col not in cols:
        df = df.with_columns(pl.lit(None).alias(name_col))
    if country_col not in cols:
        df = df.with_columns(pl.lit("GLOBAL").alias(country_col))
    if entity_type_col not in cols:
        df = df.with_columns(pl.lit("DEFAULT").alias(entity_type_col))

    def _row_blocking_key(struct_row: dict[str, Any]) -> str:
        return generate_blocking_key(
            name=struct_row.get(name_col),
            country=struct_row.get(country_col),
            entity_type=struct_row.get(entity_type_col),
        )

    block_keys = [
        generate_blocking_key(
            name=row.get(name_col),
            country=row.get(country_col),
            entity_type=row.get(entity_type_col),
        )
        for row in df.iter_rows(named=True)
    ]

    return df.with_columns(pl.Series(output_col, block_keys))


def generate_candidate_pairs(
    df: pl.DataFrame | pl.LazyFrame,
    id_col: str = "id",
    name_col: str = "name",
    country_col: str = "country",
    entity_type_col: str = "entity_type",
    block_key_col: str = "block_key",
) -> pl.DataFrame:
    """Generate candidate record pairs sharing at least one blocking key.

    Returns a Polars DataFrame with columns ``id_a``, ``id_b``, ``block_key``,
    and associated attribute pairs for comparison. Only pairs where ``id_a < id_b``
    are returned to prevent self-matching and duplicate symmetric pairs.
    """
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

    # Perform self-join on block_key
    left_df = df.select([pl.col(col).alias(f"{col}_a") for col in df.columns])
    right_df = df.select([pl.col(col).alias(f"{col}_b") for col in df.columns])

    # Join where block_key_a == block_key_b and id_a < id_b
    joined = left_df.join(
        right_df,
        left_on=f"{block_key_col}_a",
        right_on=f"{block_key_col}_b",
        how="inner",
    )

    candidate_pairs = joined.filter(pl.col(f"{id_col}_a") < pl.col(f"{id_col}_b"))
    candidate_pairs = candidate_pairs.with_columns(
        pl.col(f"{block_key_col}_a").alias("block_key")
    )

    logger.info(
        "Candidate pair generation complete — input records=%d, candidate pairs=%d",
        df.height,
        candidate_pairs.height,
    )

    return candidate_pairs


def calculate_blocking_reduction_ratio(total_records: int, candidate_pairs_count: int) -> float:
    """Calculate the reduction ratio of candidate pairs compared to full O(N^2) comparison space.

    Total possible pairs: N * (N - 1) / 2
    Reduction ratio: 1 - (candidate_pairs / total_possible_pairs)
    """
    if total_records < 2:
        return 1.0
    total_possible_pairs = total_records * (total_records - 1) // 2
    if total_possible_pairs == 0:
        return 1.0
    reduction = 1.0 - (candidate_pairs_count / total_possible_pairs)
    return max(0.0, min(1.0, reduction))
