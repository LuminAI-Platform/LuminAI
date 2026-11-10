"""Data parsing helpers for converting raw file payloads into Polars DataFrames."""

from __future__ import annotations

import io
import logging
import os

import polars as pl

logger = logging.getLogger(__name__)


def parse_raw_data_to_dataframe(
    data: bytes, object_key: str, bucket: str
) -> pl.DataFrame:
    """Download raw object from MinIO / local storage and parse into a Polars DataFrame.

    Supports:
      - CSV / TSV (.csv, .tsv, .txt)
      - Parquet (.parquet)
      - JSON / NDJSON (.json, .ndjson, .jsonl)
      - Excel (.xlsx, .xls)
    """
    ext = os.path.splitext(object_key)[1].lower()
    bio = io.BytesIO(data)

    if ext in (".parquet", ".pq"):
        df = pl.read_parquet(bio)
    elif ext in (".json", ".jsonl", ".ndjson"):
        try:
            df = pl.read_json(bio)
        except Exception:
            bio.seek(0)
            df = pl.read_ndjson(bio)
    elif ext in (".xlsx", ".xls"):
        df = pl.read_excel(bio)
    else:
        separator = "\t" if ext == ".tsv" else ","
        df = pl.read_csv(
            bio,
            separator=separator,
            infer_schema_length=10000,
            ignore_errors=True,
            truncate_ragged_lines=True,
        )

    # Clean column names (strip whitespace)
    clean_cols = [c.strip() for c in df.columns]
    df = df.rename(dict(zip(df.columns, clean_cols)))

    # Ensure 'id' column exists for downstream pipelines
    cols_lower = [c.lower() for c in df.columns]
    if "id" not in cols_lower and "rec_id" not in cols_lower:
        record_ids = [f"rec-{i + 1:04d}" for i in range(df.height)]
        df = df.with_columns(pl.Series("id", record_ids))

    logger.info(
        "Parsed %d rows from s3://%s/%s (format: %s, cols: %s)",
        df.height,
        bucket,
        object_key,
        ext or "csv",
        df.columns,
    )
    return df
