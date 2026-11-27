"""Staging data loader operations for Entity Resolution pipeline."""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

import polars as pl
from dagster import AssetExecutionContext
from sqlalchemy import text

from app.db.tenant import (
    reset_pg_search_path,
    resolve_table_schema,
    resolve_tenant_pg_context,
    set_pg_search_path,
)
import app.processing.pipelines.er_pipeline as er_pipe
from app.processing.pipelines.er_pipeline.helpers import (
    _extract_run_tags,
    get_synthetic_er_records,
)

logger = logging.getLogger(__name__)


def _records_to_df(records: List[Dict[str, Any]]) -> pl.DataFrame:
    try:
        return pl.DataFrame(records, infer_schema_length=None)
    except Exception:
        import pandas as pd

        return pl.from_pandas(pd.DataFrame(records))


def _load_records_from_conn(conn, tenant_id: Optional[str], safe_limit: Optional[int]) -> List[Dict[str, Any]]:
    params: Dict[str, Any] = {}
    is_pg = getattr(getattr(conn, "dialect", None), "name", None) == "postgresql"
    if tenant_id:
        tenant_keys = {str(tenant_id)}
        if is_pg:
            ctx = resolve_tenant_pg_context(conn, tenant_id)
            tenant_keys.update({ctx["tenant_slug"], ctx["tenant_uuid"]})
            found_schema, _ = resolve_table_schema(
                conn,
                "staging_records",
                preferred_schemas=[ctx["schema_name"], "tenant_default", "public"],
            )
            set_pg_search_path(conn, found_schema)
        ordered_keys = sorted(tenant_keys)
        placeholders = ", ".join(f":t_{i}" for i in range(len(ordered_keys)))
        for i, val in enumerate(ordered_keys):
            params[f"t_{i}"] = val
        sql = f"SELECT id, tenant_id, source_id, raw_id, data FROM staging_records WHERE tenant_id IN ({placeholders})"
    else:
        sql = "SELECT id, tenant_id, source_id, raw_id, data FROM staging_records"

    if safe_limit:
        sql += " LIMIT :limit_val"
        params["limit_val"] = safe_limit
    sql += ";"

    records: List[Dict[str, Any]] = []
    try:
        res = conn.execute(text(sql), params)
        for row in res:
            data_dict = json.loads(row.data) if isinstance(row.data, str) else dict(row.data)
            data_dict["id"] = str(row.id)
            data_dict["raw_id"] = str(row.raw_id)
            data_dict["source_id"] = str(row.source_id)
            data_dict["tenant_id"] = str(row.tenant_id)
            if not data_dict.get("entity_type") and data_dict.get("_entity_type"):
                data_dict["entity_type"] = data_dict["_entity_type"]
            records.append(data_dict)
    finally:
        if is_pg and tenant_id:
            reset_pg_search_path(conn)
    return records


def fetch_staged_records(context: AssetExecutionContext) -> pl.DataFrame:
    """Load staged records for ER processing from database or fallback dataset."""
    tags = _extract_run_tags(context)
    tenant_id = tags.get("tenant_id")
    run_id = tags.get("luminai_run_id") or tags.get("dagster/run_id")
    cp_mgr = er_pipe.get_checkpoint_manager()
    if run_id:
        cached = cp_mgr.load_checkpoint(run_id, "staged_records_for_er")
        if cached is not None:
            context.log.info(
                "⏩ Reusing checkpoint for staged_records_for_er (%d rows)",
                cached.height,
            )
            return cached

    context.log.info("🔍 staged_records_for_er: fetching staged records for ER…")

    from app.db import get_engine, get_sqlite_engine

    limit_val = tags.get("max_rows") or tags.get("limit")
    safe_limit: Optional[int] = None
    if limit_val is not None:
        try:
            val_int = int(str(limit_val).strip())
            if val_int > 0:
                safe_limit = val_int
        except (ValueError, TypeError):
            safe_limit = None

    # Attempt to load from PostgreSQL first
    try:
        engine = get_engine()
        with engine.connect() as conn:
            records = _load_records_from_conn(conn, tenant_id, safe_limit)
        if records:
            context.log.info(
                "Loaded %d staged records from PostgreSQL (tenant: %s)",
                len(records),
                tenant_id or "all",
            )
            res_df = _records_to_df(records)
            if run_id:
                cp_mgr.save_checkpoint(run_id, "staged_records_for_er", res_df)
            return res_df
    except Exception as exc:
        context.log.debug(
            "PostgreSQL staging unavailable (%s). Checking SQLite or synthetic fallback.",
            exc,
        )

    # Check SQLite fallback
    sqlite_path = os.path.join("storage", "sqlite", "staging.db")
    if os.path.exists(sqlite_path):
        try:
            sqlite_engine = get_sqlite_engine(sqlite_path)
            with sqlite_engine.connect() as conn:
                records = _load_records_from_conn(conn, tenant_id, safe_limit)
            if records:
                context.log.info(
                    "Loaded %d staged records from SQLite staging (tenant: %s)",
                    len(records),
                    tenant_id or "all",
                )
                res_df = _records_to_df(records)
                if run_id:
                    cp_mgr.save_checkpoint(run_id, "staged_records_for_er", res_df)
                return res_df
        except Exception as sqle:
            context.log.debug("SQLite staging error: %s", sqle)

    settings = er_pipe.get_settings()
    if not settings.synthetic_data_allowed:
        context.log.error(
            "❌ ER pipeline failure: No staged records found for tenant '%s' and synthetic data fallback is disabled in this environment.",
            tenant_id or "all",
        )
        raise RuntimeError(
            f"Production safety violation: Staging store returned no records for tenant '{tenant_id or 'all'}' "
            "and synthetic data fallback is prohibited in production mode."
        )

    synthetic_records = get_synthetic_er_records(tenant_id)
    active_tenant = tenant_id or "acme"

    context.log.info(
        "staged_records_for_er: loaded %d records for ER analysis (tenant: %s)",
        len(synthetic_records),
        active_tenant,
    )
    res_df = pl.DataFrame(synthetic_records)
    if run_id:
        cp_mgr.save_checkpoint(run_id, "staged_records_for_er", res_df)
    return res_df
