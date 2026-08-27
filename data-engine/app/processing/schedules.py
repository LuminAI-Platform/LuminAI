"""Dagster schedule definitions for automated background processing.

Configures:
  1. hourly_cleaning_schedule — Triggers data cleaning & validation pipeline every hour.
  2. daily_er_schedule — Triggers Entity Resolution clustering & golden record synthesis daily at midnight.
  3. daily_reconciliation_schedule — Triggers Cross-Store Data Reconciliation drift verification daily at 01:00 UTC.
"""

from dagster import AssetSelection, ScheduleDefinition, define_asset_job

# Define jobs targeting specific asset selections
cleaning_pipeline_job = define_asset_job(
    name="hourly_cleaning_pipeline_job",
    selection=AssetSelection.assets(
        "cleaning_raw",
        "cleaned_ingestion_data",
        "deduplicated_ingestion_data",
        "validated_ingestion_data",
        "staged_ingestion_data",
    ),
    description="Automated hourly run for raw ingestion data cleaning, deduplication, and staging.",
)

er_clustering_job = define_asset_job(
    name="daily_er_clustering_job",
    selection=AssetSelection.assets(
        "staged_records_for_er",
        "er_blocked_pairs",
        "er_scored_pairs",
        "er_classified_pairs",
        "er_golden_records",
    ),
    description="Automated daily run for full entity resolution clustering and golden record synthesis.",
)

# Define cron schedules
hourly_cleaning_schedule = ScheduleDefinition(
    name="hourly_cleaning_schedule",
    job=cleaning_pipeline_job,
    cron_schedule="0 * * * *",
    execution_timezone="UTC",
)

daily_er_schedule = ScheduleDefinition(
    name="daily_er_schedule",
    job=er_clustering_job,
    cron_schedule="0 0 * * *",
    execution_timezone="UTC",
)
