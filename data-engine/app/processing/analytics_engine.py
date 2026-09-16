"""DuckDB OLAP Analytics Engine for LuminAI Data Engine.

Provides high-performance analytical queries and time-series rollups over
golden records (canonical entities) and staging records, querying PostgreSQL
with transparent fallback to local SQLite storage or in-memory Polars DataFrames.
"""

from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import duckdb
import polars as pl
from sqlalchemy import text

from app.config import get_settings

logger = logging.getLogger(__name__)

# Valid identifier pattern to prevent SQL injection in dynamic column names
IDENTIFIER_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")

INTERVAL_MAP = {
    "1h": "hour",
    "hour": "hour",
    "hourly": "hour",
    "1d": "day",
    "d": "day",
    "day": "day",
    "daily": "day",
    "1w": "week",
    "w": "week",
    "week": "week",
    "weekly": "week",
    "1m": "month",
    "1month": "month",
    "month": "month",
    "monthly": "month",
    "1y": "year",
    "year": "year",
    "yearly": "year",
}

GOLDEN_COLUMNS = {"golden_id", "tenant_id", "cluster_size", "source_record_ids", "attributes", "created_at"}
STAGING_COLUMNS = {"id", "tenant_id", "source_id", "raw_id", "data", "staged_at"}


class DuckDBAnalyticsEngine:
    """OLAP analytics query engine powered by DuckDB."""

    def __init__(self, override_df: Optional[pl.DataFrame] = None) -> None:
        """Initialise engine.

        :param override_df: Optional Polars DataFrame to query in-memory
            (useful for isolated unit testing without database access).
        """
        self.settings = get_settings()
        self.override_df = override_df

    def _get_pg_engine(self):
        """Return pooled SQLAlchemy engine for PostgreSQL."""
        from app.db import get_engine
        return get_engine()

    def load_table_dataframe(self, table_name: str, tenant_id: str) -> pl.DataFrame:
        """Load records for the requested tenant from PostgreSQL or SQLite fallback."""
        if self.override_df is not None:
            return self.override_df

        target_table = "golden_records" if "golden" in table_name.lower() else "staging_records"
        records: List[Dict[str, Any]] = []

        # 1. Try PostgreSQL
        try:
            engine = self._get_pg_engine()
            with engine.connect() as conn:
                query = text(f"SELECT * FROM {target_table} WHERE tenant_id = :tenant_id")
                result = conn.execute(query, {"tenant_id": tenant_id})
                for row in result.mappings():
                    records.append(dict(row))
            if records:
                logger.debug("Loaded %d rows for tenant %s from PostgreSQL %s", len(records), tenant_id, target_table)
                return pl.DataFrame(records)
        except Exception as exc:
            logger.debug("PostgreSQL query failed (%s). Checking SQLite fallback.", exc)

        # 2. Try SQLite Fallback
        from app.db import get_sqlite_engine
        sqlite_candidates = (
            [
                os.path.join("storage", "sqlite", "er_staging.db"),
                os.path.join("storage", "sqlite", "staging.db"),
            ]
            if target_table == "golden_records"
            else [
                os.path.join("storage", "sqlite", "staging.db"),
                os.path.join("storage", "sqlite", "er_staging.db"),
            ]
        )

        for sqlite_path in sqlite_candidates:
            if os.path.exists(sqlite_path):
                try:
                    sqlite_engine = get_sqlite_engine(sqlite_path)
                    with sqlite_engine.connect() as conn:
                        query = text(f"SELECT * FROM {target_table} WHERE tenant_id = :tenant_id")
                        result = conn.execute(query, {"tenant_id": tenant_id})
                        for row in result.mappings():
                            records.append(dict(row))
                    if records:
                        logger.debug("Loaded %d rows for tenant %s from SQLite %s", len(records), tenant_id, sqlite_path)
                        return pl.DataFrame(records)
                except Exception as sqle:
                    logger.debug("SQLite check failed for %s: %s", sqlite_path, sqle)

        # If no records found, return an empty DataFrame with expected schema
        if target_table == "golden_records":
            return pl.DataFrame(
                schema={
                    "golden_id": pl.Utf8,
                    "tenant_id": pl.Utf8,
                    "cluster_size": pl.Int64,
                    "source_record_ids": pl.Utf8,
                    "attributes": pl.Utf8,
                    "created_at": pl.Datetime,
                }
            )
        else:
            return pl.DataFrame(
                schema={
                    "id": pl.Utf8,
                    "tenant_id": pl.Utf8,
                    "source_id": pl.Utf8,
                    "raw_id": pl.Utf8,
                    "data": pl.Utf8,
                    "staged_at": pl.Datetime,
                }
            )

    def _build_where_clause(
        self,
        table_name: str,
        tenant_id: str,
        entity_type: str,
        filters: Dict[str, Any],
    ) -> Tuple[str, List[Any]]:
        """Construct WHERE clause and parameter list safely.

        Sanitizes all column names and JSON keys to prevent SQL injection.
        """
        is_golden = "golden" in table_name.lower()
        json_col = "attributes" if is_golden else "data"
        known_cols = GOLDEN_COLUMNS if is_golden else STAGING_COLUMNS

        conditions = ["tenant_id = ?"]
        params: List[Any] = [tenant_id]

        # Entity type filter (skip if wildcard or ALL)
        if entity_type and entity_type.upper() not in {"*", "ALL"}:
            conditions.append(f"json_extract_string({json_col}, '$.entity_type') = ?")
            params.append(entity_type)

        # Dynamic filters
        for key, val in filters.items():
            if not IDENTIFIER_RE.match(key):
                raise ValueError(f"Invalid filter field name: '{key}'. Must be alphanumeric identifier.")

            if key in known_cols:
                # Top level table column
                conditions.append(f"{key} = ?")
                params.append(val)
            else:
                # Nested JSON field
                if isinstance(val, bool):
                    conditions.append(f"TRY_CAST(json_extract({json_col}, '$.{key}') AS BOOLEAN) = ?")
                    params.append(True if val else False)
                elif isinstance(val, (int, float)):
                    conditions.append(f"TRY_CAST(json_extract({json_col}, '$.{key}') AS DOUBLE) = ?")
                    params.append(float(val))
                else:
                    conditions.append(f"json_extract_string({json_col}, '$.{key}') = ?")
                    params.append(str(val))


        where_clause = " WHERE " + " AND ".join(conditions)
        return where_clause, params

    def execute_query(
        self,
        tenant_id: str,
        entity_type: str,
        aggregations: List[str],
        filters: Optional[Dict[str, Any]] = None,
        table_name: str = "golden_records",
    ) -> Tuple[Dict[str, Any], int]:
        """Execute an ad-hoc analytical query using DuckDB.

        :return: (result_dict, total_matching_row_count)
        """
        filters = filters or {}
        df = self.load_table_dataframe(table_name, tenant_id)

        # Create isolated in-memory DuckDB connection
        con = duckdb.connect()
        try:
            con.register("source_table", df)

            # Build sanitized WHERE clause
            where_clause, params = self._build_where_clause(
                table_name=table_name,
                tenant_id=tenant_id,
                entity_type=entity_type,
                filters=filters,
            )

            # 1. Calculate matching row count
            count_query = f"SELECT COUNT(*) as row_count FROM source_table {where_clause}"
            count_res = con.execute(count_query, params).fetchone()
            row_count = int(count_res[0]) if count_res else 0

            if row_count == 0:
                # If no matching rows, return zero/empty aggregation payload
                empty_result: Dict[str, Any] = {"count": 0}
                for agg in aggregations:
                    agg_lower = agg.lower().strip()
                    if agg_lower in {"count", "count(*)"}:
                        empty_result["count"] = 0
                    elif ":" in agg_lower:
                        op, field = agg_lower.split(":", 1)
                        empty_result[f"{op}_{field}"] = 0 if op in {"sum", "count"} else None
                return empty_result, 0

            # 2. Build aggregation expressions
            is_golden = "golden" in table_name.lower()
            json_col = "attributes" if is_golden else "data"
            known_cols = GOLDEN_COLUMNS if is_golden else STAGING_COLUMNS

            select_exprs = ["COUNT(*) as count"]
            res_keys = ["count"]

            if not aggregations:
                aggregations = ["count"]

            for agg in aggregations:
                agg_clean = agg.strip()
                if agg_clean.lower() in {"count", "count(*)"}:
                    if "count" not in res_keys:
                        select_exprs.append("COUNT(*) as count")
                        res_keys.append("count")
                    continue

                if ":" not in agg_clean:
                    raise ValueError(
                        f"Unsupported aggregation format: '{agg_clean}'. Expected 'operation:field' e.g. 'avg:age'"
                    )

                op, field = agg_clean.split(":", 1)
                op = op.lower().strip()
                field = field.strip()

                if not IDENTIFIER_RE.match(field):
                    raise ValueError(f"Invalid field name '{field}' in aggregation '{agg_clean}'.")

                target_ref = (
                    field
                    if field in known_cols
                    else (
                        f"json_extract_string({json_col}, '$.{field}')"
                        if op in {"distinct", "count_distinct"}
                        else f"json_extract({json_col}, '$.{field}')"
                    )
                )


                if op == "avg":
                    select_exprs.append(f"AVG(TRY_CAST({target_ref} AS DOUBLE)) as avg_{field}")
                    res_keys.append(f"avg_{field}")
                elif op == "sum":
                    select_exprs.append(f"SUM(TRY_CAST({target_ref} AS DOUBLE)) as sum_{field}")
                    res_keys.append(f"sum_{field}")
                elif op == "min":
                    select_exprs.append(f"MIN(TRY_CAST({target_ref} AS DOUBLE)) as min_{field}")
                    res_keys.append(f"min_{field}")
                elif op == "max":
                    select_exprs.append(f"MAX(TRY_CAST({target_ref} AS DOUBLE)) as max_{field}")
                    res_keys.append(f"max_{field}")
                elif op in {"distinct", "count_distinct"}:
                    select_exprs.append(f"COUNT(DISTINCT {target_ref}) as distinct_{field}")
                    res_keys.append(f"distinct_{field}")
                else:
                    raise ValueError(f"Unsupported aggregation operation '{op}'. Supported: avg, sum, min, max, count, distinct.")

            agg_sql = f"SELECT {', '.join(select_exprs)} FROM source_table {where_clause}"
            agg_row = con.execute(agg_sql, params).fetchone()

            result_payload: Dict[str, Any] = {}
            if agg_row:
                for key, val in zip(res_keys, agg_row):
                    if isinstance(val, float):
                        result_payload[key] = round(val, 2)
                    else:
                        result_payload[key] = val

            return result_payload, row_count
        finally:
            con.close()

    def execute_timeseries(
        self,
        tenant_id: str,
        entity_type: str,
        time_field: str,
        interval: str,
        metric: str = "count",
        filters: Optional[Dict[str, Any]] = None,
        table_name: str = "golden_records",
    ) -> List[Dict[str, Any]]:
        """Compute time-series rollups over a time-stamped entity field using DuckDB.

        :return: List of {"timestamp": ISO-8601 string, "value": float/int}
        """
        filters = filters or {}
        df = self.load_table_dataframe(table_name, tenant_id)

        # Map interval
        norm_interval = interval.lower().strip()
        duckdb_interval = INTERVAL_MAP.get(norm_interval)
        if not duckdb_interval:
            raise ValueError(
                f"Unsupported interval '{interval}'. Supported intervals: 1h, 1d, 1w, 1month, 1y"
            )

        if not IDENTIFIER_RE.match(time_field):
            raise ValueError(f"Invalid time_field '{time_field}'.")

        con = duckdb.connect()
        try:
            con.register("source_table", df)

            is_golden = "golden" in table_name.lower()
            json_col = "attributes" if is_golden else "data"
            known_cols = GOLDEN_COLUMNS if is_golden else STAGING_COLUMNS

            # Determine timestamp expression
            if time_field in known_cols:
                ts_expr = f"TRY_CAST({time_field} AS TIMESTAMP)"
            else:
                ts_expr = f"TRY_CAST(json_extract_string({json_col}, '$.{time_field}') AS TIMESTAMP)"

            # Metric expression
            metric_clean = metric.strip().lower()
            if metric_clean in {"count", "count(*)"}:
                metric_sql = "COUNT(*)"
            elif ":" in metric_clean:
                m_op, m_field = metric_clean.split(":", 1)
                if not IDENTIFIER_RE.match(m_field):
                    raise ValueError(f"Invalid metric field '{m_field}'.")
                val_ref = (
                    m_field
                    if m_field in known_cols
                    else f"json_extract({json_col}, '$.{m_field}')"
                )
                if m_op == "sum":
                    metric_sql = f"SUM(TRY_CAST({val_ref} AS DOUBLE))"
                elif m_op == "avg":
                    metric_sql = f"AVG(TRY_CAST({val_ref} AS DOUBLE))"
                elif m_op == "min":
                    metric_sql = f"MIN(TRY_CAST({val_ref} AS DOUBLE))"
                elif m_op == "max":
                    metric_sql = f"MAX(TRY_CAST({val_ref} AS DOUBLE))"
                else:
                    raise ValueError(f"Unsupported metric operation '{m_op}'. Supported: count, sum, avg, min, max")
            else:
                raise ValueError(f"Invalid metric specification '{metric}'. Use 'count' or 'op:field'")

            where_clause, params = self._build_where_clause(
                table_name=table_name,
                tenant_id=tenant_id,
                entity_type=entity_type,
                filters=filters,
            )

            # Add timestamp NOT NULL requirement
            where_clause += f" AND {ts_expr} IS NOT NULL"

            ts_sql = f"""
            SELECT 
                date_trunc('{duckdb_interval}', {ts_expr}) AS bucket,
                {metric_sql} AS metric_value
            FROM source_table
            {where_clause}
            GROUP BY 1
            ORDER BY 1 ASC
            """

            rows = con.execute(ts_sql, params).fetchall()
            series: List[Dict[str, Any]] = []

            for row in rows:
                bucket_dt, val = row[0], row[1]
                if isinstance(bucket_dt, datetime):
                    iso_str = bucket_dt.replace(tzinfo=timezone.utc).isoformat()
                else:
                    iso_str = str(bucket_dt)

                num_val = round(val, 2) if isinstance(val, float) else val
                series.append({"timestamp": iso_str, "value": num_val})

            return series
        finally:
            con.close()
