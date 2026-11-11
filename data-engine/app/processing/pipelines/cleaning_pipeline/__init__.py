"""Cleaning pipeline package.

Decomposed into:
  - helpers.py       → Date/currency parsers, synthetic test data, constants
  - cleaning_ops.py  → Casing normalization, null fill, currency/date transforms, quality validation
  - deduplication.py → Exact email and fuzzy recordlinkage deduplication
  - staging_ops.py   → Parquet writing, MinIO/PostgreSQL staging, Kafka ingest.valid events
  - assets.py        → Dagster asset definitions and checkpoint management

All assets, helpers, and test patch targets are re-exported here for 100% backward compatibility.
"""

from app.config import get_settings
from app.processing.minio_client import get_minio_client
from app.processing.pipelines.cleaning_pipeline.assets import (
    cleaned_ingestion_data,
    deduplicated_ingestion_data,
    raw_ingestion_data,
    staged_ingestion_data,
    validated_ingestion_data,
)
from app.processing.pipelines.cleaning_pipeline.cleaning_ops import (
    clean_records,
    validate_and_quarantine_records,
)
from app.processing.pipelines.cleaning_pipeline.deduplication import deduplicate_dataset
from app.processing.pipelines.cleaning_pipeline.helpers import (
    DATE_FORMATS,
    DEFAULT_RETRY_POLICY,
    NULL_DEFAULTS,
    _extract_run_tags,
    _generate_synthetic_raw_data,
    _parse_currency_string,
    _parse_date_string,
)
from app.processing.pipelines.cleaning_pipeline.staging_ops import stage_records
from app.telemetry import record_records_processed

__all__ = [
    # Assets
    "raw_ingestion_data",
    "cleaned_ingestion_data",
    "deduplicated_ingestion_data",
    "validated_ingestion_data",
    "staged_ingestion_data",
    # Pipeline operations
    "clean_records",
    "validate_and_quarantine_records",
    "deduplicate_dataset",
    "stage_records",
    # Helpers and constants
    "_extract_run_tags",
    "_generate_synthetic_raw_data",
    "_parse_date_string",
    "_parse_currency_string",
    "DEFAULT_RETRY_POLICY",
    "NULL_DEFAULTS",
    "DATE_FORMATS",
    # Backward compatible patch hooks
    "get_minio_client",
    "get_settings",
    "record_records_processed",
]
