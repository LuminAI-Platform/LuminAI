"""Staging operations: Parquet writing, MinIO/S3 upload, PostgreSQL/SQLite staging, and Kafka event publishing."""

import io
import json
import logging
import os
import uuid
from datetime import datetime, timezone

import polars as pl
from dagster import AssetExecutionContext
from sqlalchemy import text

from app.db.tenant import (
    reset_pg_search_path,
    resolve_table_schema,
    resolve_tenant_pg_context,
    set_pg_search_path,
)
from app.kafka.producers import IngestValidProducer
import app.processing.pipelines.cleaning_pipeline as cp
from app.telemetry import trace_span

logger = logging.getLogger(__name__)


def _replace_and_insert_staging_rows(
    engine,
    insert_sql: str,
    validated_df: pl.DataFrame,
    tenant_id: str,
    source_id: str,
    batch_size: int = 500,
    entity_type: str | None = None,
    source_name: str | None = None,
    connection_id: str | None = None,
) -> int:
    """Replace prior staged snapshot for (tenant, source_id) and insert rows in fixed-size batches."""
    inserted = 0
    batch: list[dict] = []
    now_ts = datetime.now(timezone.utc)

    with engine.begin() as conn:
        tenant_keys = {str(tenant_id)}
        target_schema = None
        if conn.dialect.name == "postgresql":
            ctx = resolve_tenant_pg_context(conn, tenant_id)
            tenant_keys.update({ctx["tenant_slug"], ctx["tenant_uuid"]})
            target_schema, _ = resolve_table_schema(
                conn,
                "staging_records",
                preferred_schemas=[ctx["schema_name"], "tenant_default", "public"],
            )
            set_pg_search_path(conn, target_schema)

        try:
            if source_id:
                placeholders = ", ".join(f":t_{i}" for i in range(len(tenant_keys)))
                del_params = {f"t_{i}": val for i, val in enumerate(sorted(tenant_keys))}
                del_params["source_id"] = source_id
                conn.execute(
                    text(
                        f"DELETE FROM staging_records WHERE source_id = :source_id AND tenant_id IN ({placeholders});"
                    ),
                    del_params,
                )

            for idx, row in enumerate(validated_df.iter_rows(named=True)):
                row_payload = dict(row)
                if entity_type and not row_payload.get("entity_type"):
                    row_payload["_entity_type"] = entity_type
                if source_name and not row_payload.get("_source_name"):
                    row_payload["_source_name"] = source_name
                if connection_id and not row_payload.get("_connection_id"):
                    row_payload["_connection_id"] = connection_id
                raw_id = str(row_payload.get("id") or row_payload.get("record_id") or "")
                det_id = str(
                    uuid.uuid5(
                        uuid.NAMESPACE_DNS,
                        f"{tenant_id}:{source_id}:{idx}:{raw_id}",
                    )
                )
                batch.append(
                    {
                        "id": det_id,
                        "tenant_id": tenant_id,
                        "source_id": source_id,
                        "raw_id": raw_id,
                        "data": json.dumps(row_payload, default=str),
                        "staged_at": now_ts,
                    }
                )
                if len(batch) >= batch_size:
                    conn.execute(text(insert_sql), batch)
                    inserted += len(batch)
                    batch.clear()
            if batch:
                conn.execute(text(insert_sql), batch)
                inserted += len(batch)
        finally:
            if conn.dialect.name == "postgresql":
                reset_pg_search_path(conn)
    return inserted


def stage_records(
    context: AssetExecutionContext,
    validated_df: pl.DataFrame,
    tenant_id: str,
    source_id: str,
    batch_id: str,
    entity_type: str = "Person",
    source_name: str | None = None,
    connection_id: str | None = None,
) -> pl.DataFrame:
    """Write validated data to Parquet storage and a database staging table, then emit ingest.valid."""
    context.log.info(
        "💾 staged_ingestion_data: starting staging for tenant=%s, source=%s, batch=%s",
        tenant_id,
        source_id,
        batch_id,
    )

    with trace_span(
        "pipeline.stage",
        attributes={
            "tenant.id": str(tenant_id),
            "source.id": str(source_id),
            "batch.id": str(batch_id),
            "records.staged_count": int(validated_df.height),
        },
    ):
        cp.record_records_processed(
            tenant_id=tenant_id,
            stage="stage",
            count=validated_df.height,
            status="success",
            entity_type=entity_type,
        )

        # Step 1: Write to Local Parquet + MinIO Staging
        local_staging_dir = os.path.join(
            "storage", "minio", "staging", tenant_id, source_id
        )
        os.makedirs(local_staging_dir, exist_ok=True)
        local_file_path = os.path.join(local_staging_dir, f"{batch_id}.parquet")
        validated_df.write_parquet(local_file_path)
        context.log.info("💾 Saved Parquet locally to %s", local_file_path)

        staging_bucket = f"{tenant_id}-staging"
        staging_object_key = f"{source_id}/{batch_id}.parquet"
        staging_path = local_file_path

        try:
            buf = io.BytesIO()
            validated_df.write_parquet(buf)
            parquet_bytes = buf.getvalue()
            minio_client = cp.get_minio_client()
            minio_client.put_object_bytes(
                bucket=staging_bucket,
                object_key=staging_object_key,
                data=parquet_bytes,
                content_type="application/vnd.apache.parquet",
            )
            staging_path = f"s3://{staging_bucket}/{staging_object_key}"
            context.log.info(
                "💾 Successfully uploaded Parquet to MinIO at %s", staging_path
            )
        except Exception as e:
            context.log.warning(
                "⚠️ Could not write to MinIO (is it running?): %s. Using local fallback.",
                e,
            )

        # Step 2: Write to PostgreSQL / SQLite Database Staging
        from app.db import ensure_tables_exist, get_engine, get_sqlite_engine

        engine = get_engine()
        insert_sql = """
        INSERT INTO staging_records (id, tenant_id, source_id, raw_id, data, staged_at)
        VALUES (:id, :tenant_id, :source_id, :raw_id, :data, :staged_at);
        """

        db_success = False
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))

            ensure_tables_exist(engine)
            inserted_cnt = _replace_and_insert_staging_rows(
                engine,
                insert_sql,
                validated_df,
                tenant_id,
                source_id,
                entity_type=entity_type,
                source_name=source_name,
                connection_id=connection_id,
            )
            context.log.info(
                "💾 Successfully wrote %d records to PostgreSQL staging_records table",
                inserted_cnt,
            )
            db_success = True
        except Exception as e:
            context.log.warning(
                "⚠️ Could not write to PostgreSQL (is it running?): %s. Falling back to SQLite.",
                e,
            )

        if not db_success:
            try:
                os.makedirs(os.path.join("storage", "sqlite"), exist_ok=True)
                sqlite_db_path = os.path.join("storage", "sqlite", "staging.db")
                sqlite_engine = get_sqlite_engine(sqlite_db_path)
                ensure_tables_exist(sqlite_engine)
                inserted_cnt = _replace_and_insert_staging_rows(
                    sqlite_engine,
                    insert_sql,
                    validated_df,
                    tenant_id,
                    source_id,
                    entity_type=entity_type,
                    source_name=source_name,
                    connection_id=connection_id,
                )
                context.log.info(
                    "💾 Successfully wrote %d records to SQLite staging_records table at %s",
                    inserted_cnt,
                    sqlite_db_path,
                )
            except Exception as sqle:
                context.log.error("❌ Failed to write to SQLite fallback: %s", sqle)

        # Step 3: Publish ingest.valid Kafka Event
        try:
            producer = IngestValidProducer()
            producer.publish(
                tenant_id=tenant_id,
                entity_type=entity_type,
                payload={
                    "tenant_id": tenant_id,
                    "tenantId": tenant_id,
                    "source_id": source_id,
                    "connectionId": source_id,
                    "entity_type": entity_type,
                    "batch_id": batch_id,
                    "status": "VALIDATED",
                    "staging_path": staging_path,
                    "record_count": validated_df.height,
                    "recordsOutput": validated_df.height,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )
        except Exception as ke:
            context.log.error("❌ Failed to publish Kafka ingest.valid event: %s", ke)

        return validated_df
