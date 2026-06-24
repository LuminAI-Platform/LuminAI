"""
app/processing/pipelines/ingest_pipeline.py
--------------------------------------------
Dagster asset definitions for the LuminAI ingest pipeline.

Sprint 0: No-op / mock assets that demonstrate the pipeline layout and
          prove that Polars DataFrames can be created and manipulated
          within Dagster's execution context.

Pipeline flow:
  raw_data_placeholder  →  cleaned_data_placeholder

Full pipeline (Sprint 1+):
  raw_data_placeholder  →  normalise  →  dedup  →  entity_resolution  →  publish
"""

import polars as pl
from dagster import AssetExecutionContext, Definitions, asset

from app.processing.pipelines.cleaning_pipeline import (
    cleaned_ingestion_data,
    raw_ingestion_data as cleaning_raw,
    validated_ingestion_data,
)


@asset(
    name="raw_data_placeholder",
    group_name="ingest",
    description=(
        "Sprint 0 stub: Simulates loading raw records from MinIO after "
        "the Core Backend publishes to the `ingest.raw` Kafka topic. "
        "In Sprint 1 this asset will be triggered by a Kafka sensor."
    ),
)
def raw_data_placeholder(context: AssetExecutionContext) -> pl.DataFrame:
    """
    Load raw ingestion data.

    Sprint 0: Creates a synthetic Polars DataFrame to prove the Polars
    library is correctly installed and can build DataFrames inside the
    Dagster execution context.
    """
    context.log.info("🔵 raw_data_placeholder: generating synthetic raw dataset…")

    df = pl.DataFrame(
        {
            "id": ["rec-001", "rec-002", "rec-003", "rec-004", "rec-005"],
            "name": ["Alice Smith", "alice smith", "Bob Jones", "Bobby Jones", "Carol White"],
            "email": [
                "alice@example.com",
                "alice@example.com",
                "bob@example.com",
                "bobby@example.com",
                "carol@example.com",
            ],
            "age": [34, 34, 28, 28, 45],
            "country": ["UK", "UK", "US", "US", "CA"],
        }
    )

    context.log.info(
        "🔵 raw_data_placeholder: loaded DataFrame — shape=%s, columns=%s",
        df.shape,
        df.columns,
    )
    context.log.info("🔵 raw_data_placeholder: preview:\n%s", df)

    return df


@asset(
    name="cleaned_data_placeholder",
    group_name="ingest",
    description=(
        "Sprint 0 stub: Applies basic cleaning transforms to the raw DataFrame. "
        "Demonstrates Polars chained expressions and asset dependency on "
        "`raw_data_placeholder`."
    ),
    deps=[raw_data_placeholder],
)
def cleaned_data_placeholder(
    context: AssetExecutionContext,
    raw_data_placeholder: pl.DataFrame,
) -> pl.DataFrame:
    """
    Clean and normalise the raw ingestion DataFrame.

    Sprint 0 operations:
      - Lowercase the `name` field.
      - Strip leading/trailing whitespace from strings.
      - Drop exact duplicate rows.

    Sprint 1+: Full cleaning, normalisation, and deduplication pipeline.
    """
    context.log.info(
        "🟢 cleaned_data_placeholder: received upstream DataFrame — rows=%d",
        len(raw_data_placeholder),
    )

    cleaned = (
        raw_data_placeholder
        .with_columns(
            pl.col("name").str.to_lowercase().str.strip_chars().alias("name"),
            pl.col("email").str.to_lowercase().str.strip_chars().alias("email"),
        )
        .unique(subset=["email"])
        .sort("id")
    )

    context.log.info(
        "🟢 cleaned_data_placeholder: cleaning complete — "
        "before=%d rows, after=%d rows (deduped by email)",
        len(raw_data_placeholder),
        len(cleaned),
    )
    context.log.info("🟢 cleaned_data_placeholder: result:\n%s", cleaned)

    return cleaned


# ── Dagster Definitions ────────────────────────────────────────────────────
# Exposes all assets to the Dagster web UI (Launchpad + Asset Graph).

defs = Definitions(
    assets=[
        # Sprint 0 placeholder assets (kept for reference/testing)
        raw_data_placeholder,
        cleaned_data_placeholder,
        # Sprint 1 cleaning pipeline assets
        cleaning_raw,
        cleaned_ingestion_data,
        validated_ingestion_data,
    ],
)

