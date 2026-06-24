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
import re
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
            "salary": [
                "$1,200.50", "€1500", "£80.00", "150.00", "$9,000",
                None, "€3,400.25", "$420", "invalid-currency", "£2,500",
            ],
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

    # ── Step 2: Casing normalization ───────────────────────────
    if "email" in df.columns:
        df = df.with_columns(pl.col("email").str.to_lowercase().alias("email"))
    if "name" in df.columns:
        df = df.with_columns(pl.col("name").str.to_titlecase().alias("name"))
    context.log.info("🧹 Step 2: Normalized casing (email to lowercase, name to title case)")

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

    # ── Step 6: Currency parsing ──────────────────────────────────────────
    if "salary" in df.columns:
        df = df.with_columns(
            pl.col("salary")
            .map_elements(
                _parse_currency_string,
                return_dtype=pl.Struct([
                    pl.Field("amount", pl.Float64),
                    pl.Field("currency", pl.String)
                ])
            )
            .alias("salary_parsed")
        ).with_columns(
            pl.col("salary_parsed").struct.field("amount").alias("salary_amount"),
            pl.col("salary_parsed").struct.field("currency").alias("salary_currency"),
        ).drop(["salary_parsed", "salary"])
    context.log.info("🧹 Step 6: Normalized currency (salary to salary_amount and salary_currency)")

    context.log.info(
        "✅ cleaned_ingestion_data: complete — %d → %d rows",
        initial_rows,
        df.height,
    )

    return df


@asset(
    name="deduplicated_ingestion_data",
    group_name="cleaning",
    description="Fuzzy and exact deduplication on cleaned records within the source batch.",
    deps=[cleaned_ingestion_data],
)
def deduplicated_ingestion_data(
    context: AssetExecutionContext,
    cleaned_ingestion_data: pl.DataFrame,
) -> pl.DataFrame:
    """
    Deduplicate records using exact email matching and recordlinkage fuzzy name matching.
    """
    import recordlinkage
    import pandas as pd

    initial_rows = cleaned_ingestion_data.height
    context.log.info("🔍 deduplicated_ingestion_data: starting with %d rows", initial_rows)

    if initial_rows == 0:
        return cleaned_ingestion_data

    # ── Step 1: Exact deduplication by email ────────────────────────────────
    df_exact = cleaned_ingestion_data
    if "email" in df_exact.columns:
        df_exact = df_exact.unique(subset=["email"], keep="first").sort("id")
    after_exact = df_exact.height
    context.log.info("🔍 Step 1 (Exact): Deduplicated by email — %d → %d rows", initial_rows, after_exact)

    if after_exact == 0:
        return df_exact

    # ── Step 2: Fuzzy deduplication by name (blocking on country) ───────────
    # Convert Polars to Pandas safely without pyarrow
    df_pd = pd.DataFrame(df_exact.to_dict(as_series=False))

    # Fill country field to ensure blocking works on non-null values
    df_pd["country"] = df_pd["country"].fillna("")
    df_pd["name"] = df_pd["name"].fillna("")

    indexer = recordlinkage.Index()
    indexer.block("country")
    candidate_links = indexer.index(df_pd)

    # Compare
    compare = recordlinkage.Compare()
    compare.string("name", "name", method="jarowinkler", threshold=0.85, label="name_score")

    features = compare.compute(candidate_links, df_pd)

    # Filter matches
    matches = features[features["name_score"] >= 0.85]

    # Identify indices to drop
    to_drop = set()
    for idx1, idx2 in matches.index:
        keep_idx = min(idx1, idx2)
        drop_idx = max(idx1, idx2)

        name_1 = df_pd.loc[keep_idx, "name"]
        name_2 = df_pd.loc[drop_idx, "name"]
        context.log.info(
            "⚠️ Fuzzy match found in same country: '%s' and '%s'. Merging...",
            name_1,
            name_2,
        )
        to_drop.add(drop_idx)

    # Drop matches
    df_dedup_pd = df_pd.drop(index=list(to_drop))

    # Convert back to Polars
    result = pl.from_pandas(df_dedup_pd)
    final_rows = result.height
    context.log.info(
        "✅ deduplicated_ingestion_data: complete — %d → %d rows (removed %d exact, %d fuzzy)",
        initial_rows,
        final_rows,
        initial_rows - after_exact,
        after_exact - final_rows,
    )

    return result


@asset(
    name="validated_ingestion_data",
    group_name="cleaning",
    description=(
        "Validates cleaned data for schema conformance. Flags rows with "
        "missing required fields or out-of-range values. Good rows pass "
        "through; bad rows are logged for review."
    ),
    deps=[deduplicated_ingestion_data],
)
def validated_ingestion_data(
    context: AssetExecutionContext,
    deduplicated_ingestion_data: pl.DataFrame,
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
        deduplicated_ingestion_data.height,
    )

    # Apply validation flags
    df = deduplicated_ingestion_data.with_columns(
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


@asset(
    name="staged_ingestion_data",
    group_name="cleaning",
    description="Stages validated data to MinIO/local storage (Parquet) and PostgreSQL/local SQLite database.",
    deps=[validated_ingestion_data],
)
def staged_ingestion_data(
    context: AssetExecutionContext,
    validated_ingestion_data: pl.DataFrame,
) -> pl.DataFrame:
    """
    Write validated data to Parquet storage and a database staging table.
    Also notifies Kafka topic ingest.valid.
    """
    import json
    import os
    import uuid
    from sqlalchemy import create_engine, text
    from app.config import get_settings
    from app.kafka.producers import IngestValidProducer

    settings = get_settings()

    # Fetch run tags or use defaults for local/manual testing
    run_tags = context.run.tags if context.run else {}
    tenant_id = run_tags.get("tenant_id", "acme")
    source_id = run_tags.get("source_id", "default-source")
    batch_id = run_tags.get("dagster/run_id", context.run_id if context.run else str(uuid.uuid4()))

    context.log.info("💾 staged_ingestion_data: starting staging for tenant=%s, source=%s, batch=%s", tenant_id, source_id, batch_id)

    # ── Step 1: Write to Local Parquet + MinIO Staging ──────────────────────
    # Always save locally first (serves as a local cache/fallback)
    local_staging_dir = os.path.join("storage", "minio", "staging", tenant_id, source_id)
    os.makedirs(local_staging_dir, exist_ok=True)
    local_file_path = os.path.join(local_staging_dir, f"{batch_id}.parquet")
    validated_ingestion_data.write_parquet(local_file_path)
    context.log.info("💾 Saved Parquet locally to %s", local_file_path)

    minio_url = f"s3://{tenant_id}-staging/{source_id}/{batch_id}.parquet"
    s3_options = {
        "key": settings.minio_access_key,
        "secret": settings.minio_secret_key,
        "client_kwargs": {
            "endpoint_url": f"http://{settings.minio_endpoint}"
        }
    }

    staging_path = local_file_path
    try:
        validated_ingestion_data.write_parquet(minio_url, storage_options=s3_options)
        staging_path = minio_url
        context.log.info("💾 Successfully uploaded Parquet to MinIO at %s", minio_url)
    except Exception as e:
        context.log.warning("⚠️ Could not write to MinIO (is it running?): %s. Using local fallback.", e)

    # ── Step 2: Write to PostgreSQL / SQLite Database Staging ──────────────
    db_url = f"postgresql+pg8000://{settings.postgres_user}:{settings.postgres_password}@{settings.postgres_host}:{settings.postgres_port}/{settings.postgres_db}"
    engine = create_engine(db_url)

    create_table_sql = """
    CREATE TABLE IF NOT EXISTS staging_records (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(255),
        source_id VARCHAR(255),
        raw_id VARCHAR(255),
        data TEXT,
        staged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """
    insert_sql = """
    INSERT INTO staging_records (id, tenant_id, source_id, raw_id, data, staged_at)
    VALUES (:id, :tenant_id, :source_id, :raw_id, :data, :staged_at);
    """

    db_success = False
    # Try PostgreSQL first
    try:
        # Check connection before running queries
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        
        with engine.begin() as conn:
            conn.execute(text(create_table_sql))
            params = []
            for row in validated_ingestion_data.iter_rows(named=True):
                params.append({
                    "id": str(uuid.uuid4()),
                    "tenant_id": tenant_id,
                    "source_id": source_id,
                    "raw_id": str(row.get("id", "")),
                    "data": json.dumps(row),
                    "staged_at": datetime.now(timezone.utc)
                })
            if params:
                conn.execute(text(insert_sql), params)
        context.log.info("💾 Successfully wrote %d records to PostgreSQL staging_records table", len(params))
        db_success = True
    except Exception as e:
        context.log.warning("⚠️ Could not write to PostgreSQL (is it running?): %s. Falling back to SQLite.", e)

    # SQLite fallback
    if not db_success:
        try:
            os.makedirs(os.path.join("storage", "sqlite"), exist_ok=True)
            sqlite_db_path = os.path.join("storage", "sqlite", "staging.db")
            sqlite_engine = create_engine(f"sqlite:///{sqlite_db_path}")
            with sqlite_engine.begin() as conn:
                conn.execute(text(create_table_sql))
                params = []
                for row in validated_ingestion_data.iter_rows(named=True):
                    params.append({
                        "id": str(uuid.uuid4()),
                        "tenant_id": tenant_id,
                        "source_id": source_id,
                        "raw_id": str(row.get("id", "")),
                        "data": json.dumps(row),
                        "staged_at": datetime.now(timezone.utc)
                    })
                if params:
                    conn.execute(text(insert_sql), params)
            context.log.info("💾 Successfully wrote %d records to SQLite staging_records table at %s", len(params), sqlite_db_path)
        except Exception as sqle:
            context.log.error("❌ Failed to write to SQLite fallback: %s", sqle)

    # ── Step 3: Publish ingest.valid Kafka Event ────────────────────────────
    try:
        producer = IngestValidProducer()
        producer.publish(
            tenant_id=tenant_id,
            entity_type="Person",
            payload={
                "tenant_id": tenant_id,
                "source_id": source_id,
                "batch_id": batch_id,
                "status": "valid",
                "staging_path": staging_path,
                "record_count": validated_ingestion_data.height,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )
    except Exception as ke:
        context.log.error("❌ Failed to publish Kafka ingest.valid event: %s", ke)

    return validated_ingestion_data


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


def _parse_currency_string(value: str | None) -> dict[str, object]:
    """
    Parses currency string to extract float amount and ISO currency code.
    Defaults to 0.0 and 'USD'.
    """
    if not value or not isinstance(value, str) or value.strip() == "":
        return {"amount": 0.0, "currency": "USD"}

    value = value.strip().replace(",", "")

    symbol_map = {
        "$": "USD",
        "€": "EUR",
        "£": "GBP",
        "¥": "JPY",
    }

    currency_code = "USD"
    for sym, code in symbol_map.items():
        if value.startswith(sym):
            currency_code = code
            value = value[len(sym):].strip()
            break
        elif value.endswith(sym):
            currency_code = code
            value = value[:-len(sym)].strip()
            break

    try:
        match = re.search(r"[-+]?\d*\.\d+|[-+]?\d+", value)
        if match:
            amount = float(match.group())
        else:
            amount = 0.0
    except ValueError:
        amount = 0.0

    return {"amount": amount, "currency": currency_code}

