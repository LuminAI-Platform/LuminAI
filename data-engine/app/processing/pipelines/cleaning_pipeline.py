"""
app/processing/pipelines/cleaning_pipeline.py
----------------------------------------------
Dagster asset pipeline for ingestion data cleaning using Polars lazy frames.

Cleaning rules applied:
  1. Null substitution — replace nulls with type-appropriate defaults
  2. String trimming — strip whitespace and normalize unicode
  3. Case normalization — lowercase name/email fields
  4. Type coercion — cast columns to expected data types
  5. Timestamp parsing — parse common date formats to ISO timestamps
  6. Deduplication — remove exact duplicate rows by key columns

Pipeline flow:
  raw_ingestion_data → cleaned_ingestion_data → validated_ingestion_data

Pulled forward from Sprint 2 to Sprint 1.
"""

import logging
from datetime import datetime, timezone

import polars as pl
from dagster import AssetExecutionContext, asset

logger = logging.getLogger(__name__)

# ── Column type defaults for null substitution ─────────────────────────────
NULL_DEFAULTS: dict[type, object] = {
    pl.Utf8: "",
    pl.String: "",
    pl.Int64: 0,
    pl.Int32: 0,
    pl.Float64: 0.0,
    pl.Float32: 0.0,
    pl.Boolean: False,
}

# ── Common date formats for timestamp parsing ──────────────────────────────
DATE_FORMATS = [
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%dT%H:%M:%S%z",
    "%d/%m/%Y",
    "%m/%d/%Y",
    "%Y-%m-%d",
    "%d-%m-%Y",
]


@asset(
    name="raw_ingestion_data",
    group_name="cleaning",
    description=(
        "Reads raw ingestion data from the staging area. "
        "In production, this reads from MinIO/S3 raw zone. "
        "For Sprint 1, generates synthetic data for pipeline testing."
    ),
)
def raw_ingestion_data(context: AssetExecutionContext) -> pl.DataFrame:
    """
    Load raw records from the ingestion staging area.

    Sprint 1: Generates a realistic synthetic dataset that exercises
    all cleaning rules (nulls, mixed case, duplicates, bad dates, etc.).
    """
    context.log.info("📥 raw_ingestion_data: loading raw records from staging…")

    # Synthetic dataset that exercises all cleaning rules
    df = pl.DataFrame(
        {
            "id": [
                "rec-001", "rec-002", "rec-003", "rec-004", "rec-005",
                "rec-006", "rec-007", "rec-008", "rec-009", "rec-010",
            ],
            "name": [
                "  Alice Smith  ", "alice smith", "Bob Jones", "  Bobby Jones",
                "Carol White", None, "David Brown", "david brown  ",
                "Eve Wilson", "Frank Taylor",
            ],
            "email": [
                "Alice@Example.COM", "alice@example.com", "bob@example.com",
                "bobby@example.com", "carol@example.com", "unknown@test.com",
                "david@example.com", "david@example.com",
                "eve@example.com", "  frank@example.com  ",
            ],
            "age": [34, 34, 28, None, 45, 29, None, 31, 55, 42],
            "country": [
                "UK", "uk", "US", "US", "CA", "za", None, "DE", "FR", "  AU  ",
            ],
            "joined_at": [
                "2024-01-15", "2024-01-15", "15/03/2024", "2024-04-20T10:30:00Z",
                "2024-05-01", None, "01/06/2024", "2024-07-10 14:22:00",
                "2024-08-15", "invalid-date",
            ],
            "score": [0.85, 0.85, 0.72, 0.68, None, 0.91, 0.77, 0.65, 0.88, 0.73],
        }
    )

    context.log.info(
        "📥 raw_ingestion_data: loaded %d rows, %d columns — %s",
        df.height,
        df.width,
        df.columns,
    )

    return df


@asset(
    name="cleaned_ingestion_data",
    group_name="cleaning",
    description=(
        "Applies cleaning rules to raw ingestion data: null substitution, "
        "string trimming, case normalization, type coercion, timestamp "
        "parsing, and deduplication."
    ),
    deps=[raw_ingestion_data],
)
def cleaned_ingestion_data(
    context: AssetExecutionContext,
    raw_ingestion_data: pl.DataFrame,
) -> pl.DataFrame:
    """
    Clean and normalize raw ingestion data using Polars expressions.

    Operations applied in order:
      1. Strip whitespace from all string columns
      2. Lowercase name and email fields
      3. Substitute nulls with type-appropriate defaults
      4. Normalize country codes to uppercase
      5. Parse timestamp strings into ISO format
      6. Remove duplicate rows (by email)
    """
    initial_rows = raw_ingestion_data.height
    context.log.info("🧹 cleaned_ingestion_data: starting — %d input rows", initial_rows)

    # ── Step 1: Strip whitespace from all string columns ──────────────────
    string_cols = [
        col for col, dtype in zip(
            raw_ingestion_data.columns, raw_ingestion_data.dtypes
        )
        if dtype == pl.Utf8 or dtype == pl.String
    ]

    strip_exprs = [
        pl.col(col).str.strip_chars().alias(col) for col in string_cols
    ]
    df = raw_ingestion_data.with_columns(strip_exprs) if strip_exprs else raw_ingestion_data
    context.log.info("🧹 Step 1: Stripped whitespace from %d string columns", len(string_cols))

    # ── Step 2: Lowercase name and email fields ───────────────────────────
    lowercase_cols = [c for c in ["name", "email"] if c in df.columns]
    if lowercase_cols:
        df = df.with_columns(
            [pl.col(c).str.to_lowercase().alias(c) for c in lowercase_cols]
        )
    context.log.info("🧹 Step 2: Lowercased columns: %s", lowercase_cols)

    # ── Step 3: Substitute nulls ──────────────────────────────────────────
    null_fill_exprs = []
    for col_name, dtype in zip(df.columns, df.dtypes):
        if dtype in (pl.Utf8, pl.String):
            null_fill_exprs.append(pl.col(col_name).fill_null("").alias(col_name))
        elif dtype in (pl.Int64, pl.Int32, pl.Int16, pl.Int8):
            null_fill_exprs.append(pl.col(col_name).fill_null(0).alias(col_name))
        elif dtype in (pl.Float64, pl.Float32):
            null_fill_exprs.append(pl.col(col_name).fill_null(0.0).alias(col_name))

    if null_fill_exprs:
        df = df.with_columns(null_fill_exprs)

    null_count = raw_ingestion_data.null_count().sum_horizontal()[0]
    context.log.info("🧹 Step 3: Filled %d null values", null_count)

    # ── Step 4: Normalize country codes to uppercase ──────────────────────
    if "country" in df.columns:
        df = df.with_columns(pl.col("country").str.to_uppercase().alias("country"))
    context.log.info("🧹 Step 4: Normalized country codes to uppercase")

    # ── Step 5: Parse timestamps ──────────────────────────────────────────
    if "joined_at" in df.columns:
        df = df.with_columns(
            pl.col("joined_at").map_elements(
                _parse_date_string, return_dtype=pl.Utf8
            ).alias("joined_at")
        )
    context.log.info("🧹 Step 5: Parsed timestamp strings")

    # ── Step 6: Deduplicate by email ──────────────────────────────────────
    if "email" in df.columns:
        before_dedup = df.height
        df = df.unique(subset=["email"], keep="first").sort("id")
        after_dedup = df.height
        context.log.info(
            "🧹 Step 6: Deduplicated — %d → %d rows (removed %d duplicates)",
            before_dedup,
            after_dedup,
            before_dedup - after_dedup,
        )

    context.log.info(
        "✅ cleaned_ingestion_data: complete — %d → %d rows",
        initial_rows,
        df.height,
    )

    return df


@asset(
    name="validated_ingestion_data",
    group_name="cleaning",
    description=(
        "Validates cleaned data for schema conformance. Flags rows with "
        "missing required fields or out-of-range values. Good rows pass "
        "through; bad rows are logged for review."
    ),
    deps=[cleaned_ingestion_data],
)
def validated_ingestion_data(
    context: AssetExecutionContext,
    cleaned_ingestion_data: pl.DataFrame,
) -> pl.DataFrame:
    """
    Validate cleaned data and separate good rows from bad rows.

    Validation rules:
      - ``id`` must not be empty
      - ``name`` must not be empty
      - ``email`` must contain '@'
    """
    context.log.info(
        "✔️  validated_ingestion_data: validating %d rows…",
        cleaned_ingestion_data.height,
    )

    # Apply validation flags
    df = cleaned_ingestion_data.with_columns(
        [
            (pl.col("id").str.len_chars() > 0).alias("_valid_id"),
            (pl.col("name").str.len_chars() > 0).alias("_valid_name"),
            (pl.col("email").str.contains("@")).alias("_valid_email"),
        ]
    )

    # Compute overall validity
    df = df.with_columns(
        (
            pl.col("_valid_id") & pl.col("_valid_name") & pl.col("_valid_email")
        ).alias("_is_valid")
    )

    valid_rows = df.filter(pl.col("_is_valid"))
    invalid_rows = df.filter(~pl.col("_is_valid"))

    context.log.info(
        "✔️  Validation complete — %d valid, %d invalid (flagged for review)",
        valid_rows.height,
        invalid_rows.height,
    )

    if invalid_rows.height > 0:
        context.log.warning("⚠️  Invalid rows:\n%s", invalid_rows.select(["id", "name", "email"]))

    # Return valid rows, dropping internal validation columns
    result = valid_rows.drop(
        ["_valid_id", "_valid_name", "_valid_email", "_is_valid"]
    )

    context.log.info(
        "✅ validated_ingestion_data: outputting %d clean, validated rows",
        result.height,
    )

    return result


# ── Helpers ──────────────────────────────────────────────────────────────────

def _parse_date_string(value: str | None) -> str:
    """
    Attempt to parse a date string using common formats.

    Returns ISO format string on success, or the original value
    (or empty string) if parsing fails.
    """
    if not value or not isinstance(value, str) or value.strip() == "":
        return ""

    value = value.strip()

    for fmt in DATE_FORMATS:
        try:
            parsed = datetime.strptime(value, fmt)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.isoformat()
        except ValueError:
            continue

    logger.debug("Could not parse date string: '%s'", value)
    return value
