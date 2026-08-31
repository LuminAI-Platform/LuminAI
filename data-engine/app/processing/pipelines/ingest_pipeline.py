"""Dagster asset definitions for the LuminAI data pipelines.

Includes:
  - Ingestion & cleaning pipeline assets
  - Entity Resolution (ER) & Golden Record assets
  - Automated recurring processing schedules
"""

import polars as pl
from dagster import AssetExecutionContext, Definitions, asset

from app.processing.pipelines.cleaning_pipeline import (
    cleaned_ingestion_data,
    deduplicated_ingestion_data,
    raw_ingestion_data as cleaning_raw,
    staged_ingestion_data,
    validated_ingestion_data,
)
from app.processing.pipelines.er_pipeline import (
    er_blocked_pairs,
    er_classified_pairs,
    er_golden_records,
    er_scored_pairs,
    staged_records_for_er,
)
from app.processing.schedules import (
    daily_er_schedule,
    hourly_cleaning_schedule,
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
    """Load raw ingestion data."""
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

    context.log.info("🔵 raw_data_placeholder: loaded DataFrame — shape=%s", df.shape)
    return df


@asset(
    name="cleaned_data_placeholder",
    group_name="ingest",
    description=(
        "Applies basic cleaning transforms to the raw DataFrame. "
        "Demonstrates Polars chained expressions and asset dependency."
    ),
    deps=[raw_data_placeholder],
)
def cleaned_data_placeholder(
    context: AssetExecutionContext,
    raw_data_placeholder: pl.DataFrame,
) -> pl.DataFrame:
    """Clean and normalise the raw ingestion DataFrame."""
    context.log.info("🟢 cleaned_data_placeholder: cleaning DataFrame…")

    cleaned = (
        raw_data_placeholder
        .with_columns(
            pl.col("name").str.to_lowercase().str.strip_chars().alias("name"),
            pl.col("email").str.to_lowercase().str.strip_chars().alias("email"),
        )
        .unique(subset=["email"])
        .sort("id")
    )

    context.log.info("🟢 cleaned_data_placeholder: complete — rows=%d", len(cleaned))
    return cleaned


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
        # Entity Resolution (ER) pipeline assets
        staged_records_for_er,
        er_blocked_pairs,
        er_scored_pairs,
        er_classified_pairs,
        er_golden_records,
    ],
    schedules=[
        hourly_cleaning_schedule,
        daily_er_schedule,
    ],
)
