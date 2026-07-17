"""Dagster asset definitions for the LuminAI ingest pipeline.

These assets demonstrate the pipeline layout and verify that Polars 
DataFrames can be created and manipulated within Dagster's execution context.

Pipeline flow:
  raw_data_placeholder  →  cleaned_data_placeholder
"""

import polars as pl
from dagster import AssetExecutionContext, Definitions, asset

from app.processing.pipelines.cleaning_pipeline import (
    cleaned_ingestion_data,
    deduplicated_ingestion_data,
    raw_ingestion_data as cleaning_raw,
    validated_ingestion_data,
    staged_ingestion_data,
)


@asset(
    name="raw_data_placeholder",
    group_name="ingest",
    description=(
        "Simulates loading raw records from MinIO after "
        "the Core Backend publishes to the `ingest.raw` Kafka topic. "
        "This asset is triggered by a Kafka event consumer."
    ),
)
def raw_data_placeholder(context: AssetExecutionContext) -> pl.DataFrame:
    """
    Load raw ingestion data.

    Creates a synthetic Polars DataFrame to verify the Polars library 
    is installed and constructs DataFrames correctly inside the
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
        "Applies basic cleaning transforms to the raw DataFrame. "
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

    Operations applied:
      - Lowercase the `name` field.
      - Strip leading/trailing whitespace from strings.
      - Drop exact duplicate rows.
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


def_or_node = None # just to verify
defs = Definitions(
    assets=[
        # Mock/placeholder assets kept for testing
        raw_data_placeholder,
        cleaned_data_placeholder,
        # Core cleaning pipeline assets
        cleaning_raw,
        cleaned_ingestion_data,
        deduplicated_ingestion_data,
        validated_ingestion_data,
        staged_ingestion_data,
    ],
)

