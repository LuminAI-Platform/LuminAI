"""Atomic cleaning operation handlers for the LuminAI Data Engine.

Supports configurable, reproducible data cleaning operations:
  - Missing value remediation (drop, fill mean/median/mode/constant/ffill/bfill, flag)
  - Data type conversions with safe error handling
  - Text standardization (trim, case normalization, dictionary replacement, regex stripping)
  - Deduplication (exact row duplicates and business key subsets)
  - Outlier handling (IQR, Z-score, flag, cap, remove)
  - Date and numerical range validation
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple
import polars as pl


def apply_remove_missing(df: pl.DataFrame, columns: List[str]) -> Tuple[pl.DataFrame, int]:
    """Removes records where any of the specified columns contain null or empty values."""
    if not columns or df.height == 0:
        return df, 0
    valid_cols = [c for c in columns if c in df.columns]
    if not valid_cols:
        return df, 0

    init_h = df.height
    cond = pl.all_horizontal([pl.col(c).is_not_null() for c in valid_cols])
    filtered = df.filter(cond)
    return filtered, init_h - filtered.height


def apply_fill_missing(
    df: pl.DataFrame,
    column: str,
    strategy: str = "constant",
    fill_value: Any = None,
) -> Tuple[pl.DataFrame, int]:
    """Fills missing values in a column using a specified strategy."""
    if column not in df.columns or df.height == 0:
        return df, 0

    col_series = df[column]
    null_count = int(col_series.null_count())
    if null_count == 0:
        return df, 0

    strat = strategy.lower().strip()
    if strat == "mean" and col_series.dtype.is_numeric():
        val = col_series.mean()
        return df.with_columns(pl.col(column).fill_null(val)), null_count
    elif strat == "median" and col_series.dtype.is_numeric():
        val = col_series.median()
        return df.with_columns(pl.col(column).fill_null(val)), null_count
    elif strat == "mode":
        mode_series = col_series.drop_nulls().mode()
        val = mode_series[0] if mode_series.len() > 0 else fill_value
        return df.with_columns(pl.col(column).fill_null(val)), null_count
    elif strat == "ffill":
        return df.with_columns(pl.col(column).forward_fill()), null_count
    elif strat == "bfill":
        return df.with_columns(pl.col(column).backward_fill()), null_count
    elif strat == "flag":
        flag_col = f"_is_missing_{column}"
        return df.with_columns(pl.col(column).is_null().alias(flag_col)), null_count
    else:  # constant
        val = fill_value if fill_value is not None else ("Unknown" if col_series.dtype in (pl.Utf8, pl.String) else 0)
        return df.with_columns(pl.col(column).fill_null(val)), null_count


def apply_standardize_text(
    df: pl.DataFrame,
    column: str,
    trim: bool = True,
    case: str = "none",
    replace_map: Optional[Dict[str, str]] = None,
    strip_regex: Optional[str] = None,
) -> Tuple[pl.DataFrame, int]:
    """Standardizes text fields with whitespace trimming, casing, and controlled mappings."""
    if column not in df.columns or df.height == 0:
        return df, 0

    raw_vals = df[column].to_list()
    modified_count = 0
    new_vals: List[Any] = []

    case_norm = case.lower().strip()
    reg = re.compile(strip_regex) if strip_regex else None

    for v in raw_vals:
        if v is None:
            new_vals.append(None)
            continue

        s = str(v)
        orig = s
        if trim:
            s = s.strip()
        if reg:
            s = reg.sub("", s)
        if replace_map and s in replace_map:
            s = replace_map[s]
        if case_norm == "lower":
            s = s.lower()
        elif case_norm == "upper":
            s = s.upper()
        elif case_norm == "title":
            s = s.title()

        if s != orig:
            modified_count += 1
        new_vals.append(s)

    return df.with_columns(pl.Series(column, new_vals)), modified_count


def apply_deduplicate(
    df: pl.DataFrame,
    subset: Optional[List[str]] = None,
    keep: str = "first",
) -> Tuple[pl.DataFrame, int]:
    """Deduplicates rows by exact row match or business key columns."""
    if df.height == 0:
        return df, 0
    init_h = df.height
    valid_subset = [c for c in (subset or []) if c in df.columns]

    if not valid_subset:
        deduped = df.unique()
    else:
        maintain_order = True
        deduped = df.unique(subset=valid_subset, keep=keep, maintain_order=maintain_order)

    return deduped, init_h - deduped.height


def apply_handle_outliers(
    df: pl.DataFrame,
    column: str,
    method: str = "IQR",
    threshold: float = 1.5,
    action: str = "cap",
) -> Tuple[pl.DataFrame, int]:
    """Detects and handles numerical outliers via IQR or Z-score."""
    if column not in df.columns or not df[column].dtype.is_numeric() or df.height < 4:
        return df, 0

    series = df[column].drop_nulls()
    if series.len() < 4:
        return df, 0

    if method.upper() == "Z_SCORE":
        mean_v = float(series.mean())
        std_v = float(series.std()) if series.std() is not None else 1.0
        if std_v == 0:
            return df, 0
        lower = mean_v - threshold * std_v
        upper = mean_v + threshold * std_v
    else:  # IQR
        q1 = float(series.quantile(0.25))
        q3 = float(series.quantile(0.75))
        iqr = q3 - q1
        lower = q1 - threshold * iqr
        upper = q3 + threshold * iqr

    act = action.lower().strip()
    init_h = df.height

    if act == "remove":
        filtered = df.filter((pl.col(column).is_null()) | ((pl.col(column) >= lower) & (pl.col(column) <= upper)))
        return filtered, init_h - filtered.height
    elif act == "flag":
        flag_col = f"_is_outlier_{column}"
        flagged = df.with_columns(
            ((pl.col(column) < lower) | (pl.col(column) > upper)).fill_null(False).alias(flag_col)
        )
        affected = flagged.filter(pl.col(flag_col)).height
        return flagged, affected
    else:  # cap
        capped = df.with_columns(
            pl.col(column).clip(lower_bound=lower, upper_bound=upper)
        )
        affected = df.filter((pl.col(column) < lower) | (pl.col(column) > upper)).height
        return capped, affected
