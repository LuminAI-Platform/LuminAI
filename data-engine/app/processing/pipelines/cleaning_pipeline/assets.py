"""Dagster asset definitions for ingestion data cleaning."""

import logging
import uuid
import polars as pl
from dagster import AssetExecutionContext, asset

import app.processing.pipelines.cleaning_pipeline as cp
from app.processing.checkpoint import get_checkpoint_manager
from app.processing.pipelines.cleaning_pipeline.cleaning_ops import (
    clean_records,
    validate_and_quarantine_records,
)
from app.processing.pipelines.cleaning_pipeline.deduplication import deduplicate_dataset
from app.processing.pipelines.cleaning_pipeline.helpers import (
    DEFAULT_RETRY_POLICY,
    _extract_run_tags,
    _generate_synthetic_raw_data,
)
from app.processing.pipelines.cleaning_pipeline.staging_ops import stage_records

logger = logging.getLogger(__name__)


@asset(
    name="raw_ingestion_data",
    group_name="cleaning",
    description=(
        "Reads raw ingestion data from MinIO/S3 object storage staging area. "
        "Loads uploaded CSV, Parquet, JSON, or Excel files scoping by tenant/source. "
        "Generates realistic synthetic data when offline or in unit tests."
    ),
    retry_policy=DEFAULT_RETRY_POLICY,
)
def raw_ingestion_data(context: AssetExecutionContext) -> pl.DataFrame:
    """
    Load raw records from the ingestion staging area.
    Fetches dataset from MinIO/S3 object storage or falls back to synthetic dataset.
    """
    tags = _extract_run_tags(context)
    run_id = tags.get("luminai_run_id") or tags.get("dagster/run_id")
    cp_mgr = get_checkpoint_manager()
    if run_id:
        cached = cp_mgr.load_checkpoint(run_id, "raw_ingestion_data")
        if cached is not None:
            context.log.info(
                "⏩ Reusing checkpoint for raw_ingestion_data (%d rows)", cached.height
            )
            return cached

    context.log.info("📥 raw_ingestion_data: loading raw records from staging…")
    object_key = (
        tags.get("object_key")
        or tags.get("file_path")
        or tags.get("s3_key")
        or tags.get("source_path")
        or tags.get("filePath")
        or tags.get("key")
    )
    bucket = (
        tags.get("bucket") or tags.get("s3_bucket") or cp.get_settings().minio_bucket_raw
    )

    if object_key:
        context.log.info(
            "📥 raw_ingestion_data: retrieving raw data from s3://%s/%s",
            bucket,
            object_key,
        )
        try:
            client = cp.get_minio_client()
            df = client.load_dataframe(bucket=bucket, object_key=object_key)
            context.log.info(
                "📥 raw_ingestion_data: successfully loaded %d rows, %d cols from s3://%s/%s",
                df.height,
                df.width,
                bucket,
                object_key,
            )

            if df.height == 0:
                raise ValueError(f"File s3://{bucket}/{object_key} is empty (0 rows).")

            from app.processing.schema_detector import get_schema_detector

            detector = get_schema_detector()
            preflight = detector.validate_dataframe(df)
            if not preflight.is_valid:
                context.log.warning(
                    "⚠️ Pre-flight quality advisory for file s3://%s/%s: %s. Proceeding with data cleaning and normalization.",
                    bucket,
                    object_key,
                    preflight.error_message,
                )
            else:
                context.log.info(
                    "✅ Pre-flight validation passed for s3://%s/%s (suggested entity: %s)",
                    bucket,
                    object_key,
                    preflight.suggested_entity_type or "Unknown",
                )

            return df
        except Exception as exc:
            context.log.error(
                "❌ Failed to load raw data from MinIO (s3://%s/%s): %s",
                bucket,
                object_key,
                exc,
            )
            settings = cp.get_settings()
            if not settings.synthetic_data_allowed:
                context.log.error(
                    "❌ Cleaning pipeline failure: Raw ingestion data could not be retrieved from MinIO (bucket: %s, key: %s) and synthetic fallback is disabled.",
                    bucket,
                    object_key,
                )
                raise RuntimeError(
                    f"Production safety violation: Unable to load raw dataset from s3://{bucket}/{object_key or '<missing>'} "
                    "and synthetic data fallback is prohibited in production mode."
                ) from exc
            context.log.warning(
                "⚠️ Failed to load raw data from MinIO (s3://%s/%s) in non-production mode; falling back to synthetic dataset: %s",
                bucket,
                object_key,
                exc,
            )

    settings = cp.get_settings()
    if not settings.synthetic_data_allowed:
        context.log.error(
            "❌ Cleaning pipeline failure: Raw ingestion data could not be retrieved from MinIO (bucket: %s, key: %s) and synthetic fallback is disabled.",
            bucket,
            object_key,
        )
        raise RuntimeError(
            f"Production safety violation: Unable to load raw dataset from s3://{bucket}/{object_key or '<missing>'} "
            "and synthetic data fallback is prohibited in production mode."
        )

    context.log.info(
        "📥 raw_ingestion_data: using synthetic dataset for cleaning pipeline."
    )
    df = _generate_synthetic_raw_data()

    context.log.info(
        "📥 raw_ingestion_data: loaded %d rows, %d columns — %s",
        df.height,
        df.width,
        df.columns,
    )

    if run_id:
        cp_mgr.save_checkpoint(run_id, "raw_ingestion_data", df)

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
    retry_policy=DEFAULT_RETRY_POLICY,
)
def cleaned_ingestion_data(
    context: AssetExecutionContext,
    raw_ingestion_data: pl.DataFrame,
) -> pl.DataFrame:
    """Clean and normalize raw ingestion data using Polars expressions."""
    run_tags = _extract_run_tags(context)
    tenant_id = run_tags.get("tenant_id", "acme")
    entity_type = run_tags.get("entity_type") or "Person"
    run_id = run_tags.get("luminai_run_id") or run_tags.get("dagster/run_id")
    cp_mgr = get_checkpoint_manager()
    if run_id:
        cached = cp_mgr.load_checkpoint(run_id, "cleaned_ingestion_data")
        if cached is not None:
            context.log.info(
                "⏩ Reusing checkpoint for cleaned_ingestion_data (%d rows)",
                cached.height,
            )
            return cached

    df = clean_records(
        context=context,
        raw_df=raw_ingestion_data,
        tenant_id=tenant_id,
        entity_type=entity_type,
    )

    if run_id:
        cp_mgr.save_checkpoint(run_id, "cleaned_ingestion_data", df)

    return df


@asset(
    name="deduplicated_ingestion_data",
    group_name="cleaning",
    description="Fuzzy and exact deduplication on cleaned records within the source batch.",
    deps=[cleaned_ingestion_data],
    retry_policy=DEFAULT_RETRY_POLICY,
)
def deduplicated_ingestion_data(
    context: AssetExecutionContext,
    cleaned_ingestion_data: pl.DataFrame,
) -> pl.DataFrame:
    """Deduplicate records using exact email matching and recordlinkage fuzzy name matching."""
    run_tags = _extract_run_tags(context)
    run_id = run_tags.get("luminai_run_id") or run_tags.get("dagster/run_id")
    cp_mgr = get_checkpoint_manager()
    if run_id:
        cached = cp_mgr.load_checkpoint(run_id, "deduplicated_ingestion_data")
        if cached is not None:
            context.log.info(
                "⏩ Reusing checkpoint for deduplicated_ingestion_data (%d rows)",
                cached.height,
            )
            return cached

    result = deduplicate_dataset(context=context, cleaned_df=cleaned_ingestion_data)

    if run_id:
        cp_mgr.save_checkpoint(run_id, "deduplicated_ingestion_data", result)

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
    retry_policy=DEFAULT_RETRY_POLICY,
)
def validated_ingestion_data(
    context: AssetExecutionContext,
    deduplicated_ingestion_data: pl.DataFrame,
) -> pl.DataFrame:
    """Validate cleaned data and separate good rows from bad rows."""
    run_tags = _extract_run_tags(context)
    run_id = run_tags.get("luminai_run_id") or run_tags.get("dagster/run_id")
    tenant_id = run_tags.get("tenant_id", "acme")
    source_id = run_tags.get("source_id", "default-source")
    cp_mgr = get_checkpoint_manager()
    if run_id:
        cached = cp_mgr.load_checkpoint(run_id, "validated_ingestion_data")
        if cached is not None:
            context.log.info(
                "⏩ Reusing checkpoint for validated_ingestion_data (%d rows)",
                cached.height,
            )
            return cached

    result = validate_and_quarantine_records(
        context=context,
        df=deduplicated_ingestion_data,
        tenant_id=tenant_id,
        source_id=source_id,
    )

    if run_id:
        cp_mgr.save_checkpoint(run_id, "validated_ingestion_data", result)

    return result


@asset(
    name="staged_ingestion_data",
    group_name="cleaning",
    description="Stages validated data to MinIO/local storage (Parquet) and PostgreSQL/local SQLite database.",
    deps=[validated_ingestion_data],
    retry_policy=DEFAULT_RETRY_POLICY,
)
def staged_ingestion_data(
    context: AssetExecutionContext,
    validated_ingestion_data: pl.DataFrame,
) -> pl.DataFrame:
    """Write validated data to Parquet storage and a database staging table."""
    run_tags = _extract_run_tags(context)
    tenant_id = run_tags.get("tenant_id", "acme")
    source_id = run_tags.get("source_id", "default-source")
    batch_id = (
        run_tags.get("dagster/run_id")
        or run_tags.get("luminai_run_id")
        or str(uuid.uuid4())
    )
    entity_type = run_tags.get("entity_type") or "Person"
    run_id = run_tags.get("luminai_run_id") or run_tags.get("dagster/run_id")
    cp_mgr = get_checkpoint_manager()
    if run_id:
        cached = cp_mgr.load_checkpoint(run_id, "staged_ingestion_data")
        if cached is not None:
            context.log.info(
                "⏩ Reusing checkpoint for staged_ingestion_data (%d rows)",
                cached.height,
            )
            return cached

    result = stage_records(
        context=context,
        validated_df=validated_ingestion_data,
        tenant_id=tenant_id,
        source_id=source_id,
        batch_id=batch_id,
        entity_type=entity_type,
    )

    if run_id:
        cp_mgr.save_checkpoint(run_id, "staged_ingestion_data", result)

    return result
