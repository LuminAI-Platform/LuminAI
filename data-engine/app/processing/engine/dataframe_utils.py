"""Shared Polars DataFrame construction and resilient CSV ingestion helpers."""

from __future__ import annotations

import io
import logging
from typing import Any, Dict, List, Tuple

import polars as pl

logger = logging.getLogger(__name__)


def parse_csv_bytes_with_fallback(
    data: bytes,
    separator: str = ",",
    infer_schema_length: int = 10000,
) -> Tuple[pl.DataFrame, List[str]]:
    """Parse CSV/TSV bytes trying strict UTF-8 first, then encoding/lenient fallbacks.

    Returns ``(dataframe, warnings)`` so callers never silently drop malformed rows
    or corrupt encodings without diagnostic visibility.
    """
    if not data or not data.strip():
        return pl.DataFrame(), ["CSV input payload is empty."]

    warnings: List[str] = []
    payload = data

    # Strip UTF-8 BOM if present
    if payload.startswith(b"\xef\xbb\xbf"):
        payload = payload[3:]

    # 1. Decode bytes safely (UTF-8 strict -> cp1252 fallback)
    try:
        payload.decode("utf-8")
    except UnicodeDecodeError:
        decoded = payload.decode("cp1252", errors="replace")
        payload = decoded.encode("utf-8")
        msg = "Input CSV was not valid UTF-8; transcoded via cp1252 fallback."
        warnings.append(msg)
        logger.warning(msg)

    # 2. Try strict CSV parsing first (full schema inference on fallback)
    try:
        df = pl.read_csv(
            io.BytesIO(payload),
            separator=separator,
            infer_schema_length=infer_schema_length,
        )
        return df, warnings
    except Exception as strict_exc:
        logger.debug("Strict CSV parse failed (%s); retrying full-schema / lenient mode.", strict_exc)

    try:
        df = pl.read_csv(
            io.BytesIO(payload),
            separator=separator,
            infer_schema_length=None,
        )
        return df, warnings
    except Exception as wide_exc:
        # 3. Lenient fallback with explicit diagnostic warning
        raw_lines = [ln for ln in payload.decode("utf-8", errors="replace").splitlines() if ln.strip()]
        expected_data_rows = max(0, len(raw_lines) - 1)
        df = pl.read_csv(
            io.BytesIO(payload),
            separator=separator,
            infer_schema_length=infer_schema_length,
            ignore_errors=True,
            truncate_ragged_lines=True,
        )
        warn_msg = (
            f"CSV required lenient parsing due to malformed/ragged rows ({wide_exc}); "
            f"parsed {df.height} rows (expected ~{expected_data_rows} non-empty data lines)."
        )
        warnings.append(warn_msg)
        logger.warning(warn_msg)
        return df, warnings


def records_to_polars_df(records: List[Dict[str, Any]]) -> pl.DataFrame:
    """Construct a Polars DataFrame from JSON-like dicts, tolerating mixed-type columns."""
    if not records:
        return pl.DataFrame()

    try:
        return pl.DataFrame(records, infer_schema_length=None)
    except Exception:
        import pandas as pd

        pdf = pd.DataFrame(records)
        # Convert mixed object columns that Arrow cannot represent directly
        for col in pdf.columns:
            if pdf[col].dtype == object:
                non_null_types = {type(v) for v in pdf[col].dropna()}
                if len(non_null_types) > 1 and non_null_types - {int, float}:
                    pdf[col] = pdf[col].map(lambda v: None if v is None or (isinstance(v, float) and v != v) else str(v))
        return pl.from_pandas(pdf)
