"""OLAP analytics query engine implementation powered by DuckDB."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import duckdb
import polars as pl

from app.config import get_settings
from app.processing.analytics_engine.constants import (
    GOLDEN_COLUMNS,
    IDENTIFIER_RE,
    INTERVAL_MAP,
    STAGING_COLUMNS,
)
from app.processing.analytics_engine.data_loader import (
    get_pg_engine,
    load_table_dataframe as _load_table_df,
    normalize_dataframe,
)
from app.processing.analytics_engine.query_builder import (
    build_aggregation_expressions,
    build_where_clause,
)
from app.processing.engine.stats_utils import compute_numeric_histogram

logger = logging.getLogger(__name__)


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
        return get_pg_engine()

    def _normalize_dataframe(self, df: pl.DataFrame, target_table: str) -> pl.DataFrame:
        """Normalize dataframe columns across PostgreSQL and SQLite schema variations."""
        return normalize_dataframe(df, target_table)

    def load_table_dataframe(self, table_name: str, tenant_id: str) -> pl.DataFrame:
        """Load records for the requested tenant from PostgreSQL or SQLite fallback."""
        return _load_table_df(table_name, tenant_id, self.override_df)

    def _build_where_clause(
        self,
        table_name: str,
        tenant_id: str,
        entity_type: str,
        filters: Dict[str, Any],
        df_columns: Optional[List[str]] = None,
    ) -> Tuple[str, List[Any]]:
        """Construct WHERE clause and parameter list safely."""
        return build_where_clause(
            table_name=table_name,
            tenant_id=tenant_id,
            entity_type=entity_type,
            filters=filters,
            df_columns=df_columns,
        )

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
        if not aggregations:
            aggregations = ["count"]

        select_exprs, res_keys = build_aggregation_expressions(aggregations, table_name)

        df = self.load_table_dataframe(table_name, tenant_id)
        df = self._normalize_dataframe(df, table_name)

        # Create isolated in-memory DuckDB connection with optimized thread & memory settings
        con = duckdb.connect()
        try:
            con.execute("PRAGMA threads=4")
            con.execute("PRAGMA preserve_insertion_order=false")
            con.register("source_table", df)

            # Build sanitized WHERE clause
            where_clause, params = self._build_where_clause(
                table_name=table_name,
                tenant_id=tenant_id,
                entity_type=entity_type,
                filters=filters,
                df_columns=df.columns,
            )

            # Calculate matching row count
            count_query = (
                f"SELECT COUNT(*) as row_count FROM source_table {where_clause}"
            )
            count_res = con.execute(count_query, params).fetchone()
            row_count = int(count_res[0]) if count_res else 0

            if row_count == 0:
                empty_result: Dict[str, Any] = {}
                for key in res_keys:
                    if (
                        key == "count"
                        or key.startswith("sum_")
                        or key.startswith("distinct_")
                    ):
                        empty_result[key] = 0
                    else:
                        empty_result[key] = None
                return empty_result, 0

            agg_sql = (
                f"SELECT {', '.join(select_exprs)} FROM source_table {where_clause}"
            )
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

    def explain_query(
        self,
        tenant_id: str,
        entity_type: str,
        aggregations: List[str],
        filters: Optional[Dict[str, Any]] = None,
        table_name: str = "golden_records",
    ) -> str:
        """Inspect the DuckDB physical query execution plan for profiling and optimization."""
        filters = filters or {}
        if not aggregations:
            aggregations = ["count"]

        is_golden = "golden" in table_name.lower()
        json_col = "attributes" if is_golden else "data"
        known_cols = GOLDEN_COLUMNS if is_golden else STAGING_COLUMNS

        select_exprs = ["COUNT(*) as count"]
        for agg in aggregations:
            agg_clean = agg.strip()
            if agg_clean.lower() not in {"count", "count(*)"} and ":" in agg_clean:
                op, field = agg_clean.split(":", 1)
                target_ref = (
                    field
                    if field in known_cols
                    else f"json_extract({json_col}, '$.{field}')"
                )
                if op == "avg":
                    select_exprs.append(
                        f"AVG(TRY_CAST({target_ref} AS DOUBLE)) as avg_{field}"
                    )
                elif op == "sum":
                    select_exprs.append(
                        f"SUM(TRY_CAST({target_ref} AS DOUBLE)) as sum_{field}"
                    )

        df = self.load_table_dataframe(table_name, tenant_id)
        df = self._normalize_dataframe(df, table_name)
        con = duckdb.connect()
        try:
            con.execute("PRAGMA threads=4")
            con.execute("PRAGMA preserve_insertion_order=false")
            con.register("source_table", df)
            where_clause, params = self._build_where_clause(
                table_name=table_name,
                tenant_id=tenant_id,
                entity_type=entity_type,
                filters=filters,
                df_columns=df.columns,
            )
            agg_sql = f"EXPLAIN SELECT {', '.join(select_exprs)} FROM source_table {where_clause}"
            rows = con.execute(agg_sql, params).fetchall()
            return "\n".join(str(r[1]) for r in rows)
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
        df = self._normalize_dataframe(df, table_name)

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
            con.execute("PRAGMA threads=4")
            con.execute("PRAGMA preserve_insertion_order=false")
            con.register("source_table", df)

            is_golden = "golden" in table_name.lower()
            json_col = "attributes" if is_golden else "data"
            known_cols = GOLDEN_COLUMNS if is_golden else STAGING_COLUMNS

            if time_field in known_cols:
                ts_expr = f"TRY_CAST({time_field} AS TIMESTAMP)"
            else:
                ts_expr = f"TRY_CAST(json_extract_string({json_col}, '$.{time_field}') AS TIMESTAMP)"

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
                    raise ValueError(
                        f"Unsupported metric operation '{m_op}'. Supported: count, sum, avg, min, max"
                    )
            else:
                raise ValueError(
                    f"Invalid metric specification '{metric}'. Use 'count' or 'op:field'"
                )

            where_clause, params = self._build_where_clause(
                table_name=table_name,
                tenant_id=tenant_id,
                entity_type=entity_type,
                filters=filters,
                df_columns=df.columns,
            )

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

    def export_data(
        self,
        tenant_id: str,
        entity_type: str = "*",
        table_name: str = "golden_records",
        filters: Optional[Dict[str, Any]] = None,
        columns: Optional[List[str]] = None,
        limit: Optional[int] = 10000,
    ) -> pl.DataFrame:
        """Export filtered analytical records as a clean Polars DataFrame."""
        filters = filters or {}
        if columns:
            for c in columns:
                if not IDENTIFIER_RE.match(c):
                    raise ValueError(f"Invalid column name '{c}' for export.")

        df = self.load_table_dataframe(table_name, tenant_id)
        df = self._normalize_dataframe(df, table_name)

        if df.is_empty():
            return df

        con = duckdb.connect(":memory:")
        try:
            con.register("source_table", df)

            where_clause, params = self._build_where_clause(
                table_name=table_name,
                tenant_id=tenant_id,
                entity_type=entity_type,
                filters=filters,
                df_columns=df.columns,
            )

            if columns:
                select_items = []
                for c in columns:
                    if not IDENTIFIER_RE.match(c):
                        raise ValueError(f"Invalid column name '{c}' for export.")
                    if c in df.columns:
                        select_items.append(c)
                    elif "attributes" in df.columns:
                        select_items.append(
                            f"json_extract_string(attributes, '$.{c}') AS {c}"
                        )
                    elif "data" in df.columns:
                        select_items.append(
                            f"json_extract_string(data, '$.{c}') AS {c}"
                        )
                projection = ", ".join(select_items) if select_items else "*"
            else:
                projection = "*"

            limit_clause = f" LIMIT {int(limit)}" if limit and limit > 0 else ""
            export_sql = (
                f"SELECT {projection} FROM source_table {where_clause}{limit_clause}"
            )

            res_df = con.execute(export_sql, params).pl()
            return res_df
        finally:
            con.close()

    def execute_distribution(
        self,
        tenant_id: str,
        field: str,
        entity_type: str = "*",
        table_name: str = "golden_records",
        mode: str = "auto",
        bins: int = 10,
        limit: int = 15,
        filters: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Compute categorical breakdowns (bar/pie) or binned numeric histograms via DuckDB."""
        if not field or not IDENTIFIER_RE.match(field):
            raise ValueError(
                f"Invalid field '{field}'. Must be a valid alphanumeric identifier."
            )

        norm_mode = (mode or "auto").strip().lower()
        if norm_mode not in {"auto", "categorical", "histogram"}:
            raise ValueError(
                f"Unsupported distribution mode '{mode}'. Supported: auto, categorical, histogram"
            )

        safe_bins = max(1, min(int(bins), 50))
        safe_limit = max(1, min(int(limit), 100))
        filters = filters or {}

        df = self.load_table_dataframe(table_name, tenant_id)
        df = self._normalize_dataframe(df, table_name)
        empty_mode = "histogram" if norm_mode == "histogram" else "categorical"
        if df.is_empty():
            return {
                "field": field,
                "mode": empty_mode,
                "total_count": 0,
                "buckets": [],
                "other_count": 0,
            }

        is_golden = "golden" in table_name.lower()
        json_col = "attributes" if is_golden else "data"
        known_cols = GOLDEN_COLUMNS if is_golden else STAGING_COLUMNS

        if field == "entity_type" and "entity_type" in df.columns and json_col in df.columns:
            val_expr = (
                f"COALESCE(NULLIF(TRY_CAST(entity_type AS VARCHAR), ''), "
                f"json_extract_string({json_col}, '$.entity_type'))"
            )
        elif field in known_cols and field in df.columns:
            val_expr = f"TRY_CAST({field} AS VARCHAR)"
        elif json_col in df.columns:
            val_expr = f"json_extract_string({json_col}, '$.{field}')"
        else:
            return {
                "field": field,
                "mode": empty_mode,
                "total_count": 0,
                "buckets": [],
                "other_count": 0,
            }

        con = duckdb.connect(":memory:")
        try:
            con.register("source_table", df)
            where_clause, params = self._build_where_clause(
                table_name=table_name,
                tenant_id=tenant_id,
                entity_type=entity_type,
                filters=filters,
                df_columns=df.columns,
            )
            sql = f"SELECT {val_expr} AS raw_val FROM source_table {where_clause}"
            raw_rows = con.execute(sql, params).fetchall()
        finally:
            con.close()

        non_empty: List[str] = []
        for (raw_val,) in raw_rows:
            if raw_val is None:
                continue
            s_val = str(raw_val).strip()
            if s_val == "":
                continue
            non_empty.append(s_val)

        if not non_empty:
            return {
                "field": field,
                "mode": empty_mode,
                "total_count": 0,
                "buckets": [],
                "other_count": 0,
            }

        import math

        numeric_vals: List[float] = []
        for s_val in non_empty:
            if s_val.lower() in {"true", "false"}:
                continue
            try:
                f_val = float(s_val)
                if math.isfinite(f_val):
                    numeric_vals.append(f_val)
            except ValueError:
                continue

        resolved_mode = norm_mode
        if norm_mode == "auto":
            numeric_ratio = len(numeric_vals) / len(non_empty)
            is_known_metric = field in {"confidence_score", "cluster_size", "source_count"}
            if numeric_ratio >= 0.85 and (len(set(numeric_vals)) > 6 or is_known_metric):
                resolved_mode = "histogram"
            else:
                resolved_mode = "categorical"

        if resolved_mode == "histogram":
            if not numeric_vals:
                return {
                    "field": field,
                    "mode": "histogram",
                    "total_count": 0,
                    "buckets": [],
                    "other_count": 0,
                }
            buckets = compute_numeric_histogram(numeric_vals, bins=safe_bins)
            return {
                "field": field,
                "mode": "histogram",
                "total_count": len(numeric_vals),
                "buckets": buckets,
                "other_count": 0,
            }

        counts: Dict[str, int] = {}
        for item in non_empty:
            counts[item] = counts.get(item, 0) + 1
        sorted_items = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
        total = len(non_empty)
        top_items = sorted_items[:safe_limit]
        shown = sum(cnt for _, cnt in top_items)
        buckets = [
            {
                "label": lbl,
                "count": cnt,
                "percentage": round((cnt / total) * 100.0, 2),
            }
            for lbl, cnt in top_items
        ]
        return {
            "field": field,
            "mode": "categorical",
            "total_count": total,
            "buckets": buckets,
            "other_count": max(0, total - shown),
        }
