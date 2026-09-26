"""Dashboard analytics service for the LuminAI Data Engine.

Provides aggregated metrics consumed by the frontend dashboard:
  - Pipeline execution stats (runs, success rate, duration)
  - Data quality scores (completeness, uniqueness, consistency, timeliness)
  - Entity stats (golden records, staging records, ER candidates, type breakdown)

All queries are tenant-scoped and use parameterized statements to prevent
SQL injection.  PostgreSQL is the primary store with transparent fallback
to SQLite run storage for pipeline metrics.
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import duckdb
import polars as pl
from sqlalchemy import text

from app.config import get_settings

logger = logging.getLogger(__name__)


class DashboardAnalyticsService:
    """Computes dashboard metrics from PostgreSQL / SQLite / in-memory data."""

    def __init__(self) -> None:
        self.settings = get_settings()

    # ------------------------------------------------------------------
    # Internal: database access helpers
    # ------------------------------------------------------------------

    def _get_pg_engine(self):
        """Return the shared SQLAlchemy PostgreSQL engine."""
        from app.db import get_engine
        return get_engine()

    def _query_pg_scalar(self, sql: str, params: Dict[str, Any]) -> Any:
        """Execute a parameterized scalar query against PostgreSQL.

        Returns the first column of the first row, or ``None`` on failure.
        """
        try:
            engine = self._get_pg_engine()
            with engine.connect() as conn:
                result = conn.execute(text(sql), params)
                row = result.fetchone()
                return row[0] if row else None
        except Exception as exc:
            logger.debug("PostgreSQL scalar query failed: %s", exc)
            return None

    def _query_pg_rows(
        self, sql: str, params: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Execute a parameterized query and return all rows as dicts."""
        try:
            engine = self._get_pg_engine()
            with engine.connect() as conn:
                result = conn.execute(text(sql), params)
                return [dict(row._mapping) for row in result]
        except Exception as exc:
            logger.debug("PostgreSQL row query failed: %s", exc)
            return []

    def _get_run_storage_path(self) -> str:
        """Return the path to the SQLite run-storage database."""
        return os.path.join("storage", "sqlite", "run_storage.db")

    def _query_sqlite_runs(self, sql: str, params: Tuple[Any, ...]) -> List[sqlite3.Row]:
        """Execute a parameterized read query against the SQLite run tracker DB."""
        db_path = self._get_run_storage_path()
        if not os.path.exists(db_path):
            return []
        try:
            with sqlite3.connect(db_path) as conn:
                conn.row_factory = sqlite3.Row
                cur = conn.execute(sql, params)
                return cur.fetchall()
        except Exception as exc:
            logger.debug("SQLite run query failed: %s", exc)
            return []

    def _query_sqlite_scalar(self, sql: str, params: Tuple[Any, ...]) -> Any:
        """Execute a parameterized scalar query against SQLite run storage."""
        db_path = self._get_run_storage_path()
        if not os.path.exists(db_path):
            return None
        try:
            with sqlite3.connect(db_path) as conn:
                cur = conn.execute(sql, params)
                row = cur.fetchone()
                return row[0] if row else None
        except Exception as exc:
            logger.debug("SQLite scalar query failed: %s", exc)
            return None

    # ------------------------------------------------------------------
    # 1. Pipeline Stats
    # ------------------------------------------------------------------

    def get_pipeline_stats(self, tenant_id: str) -> Dict[str, Any]:
        """Aggregate pipeline execution metrics for the given tenant.

        Queries the SQLite-backed ``pipeline_runs`` table managed by
        :class:`~app.processing.run_tracker.PipelineRunTracker`.

        Returns:
            Dictionary with ``totalRuns``, ``successRate``, ``avgDuration``,
            ``recordsProcessed``, and ``lastRunAt``.
        """
        # Total runs for this tenant
        total_runs = self._query_sqlite_scalar(
            "SELECT COUNT(*) FROM pipeline_runs WHERE tenant_id = ?",
            (tenant_id,),
        )
        total_runs = int(total_runs) if total_runs else 0

        # Completed (successful) runs
        completed_runs = self._query_sqlite_scalar(
            "SELECT COUNT(*) FROM pipeline_runs WHERE tenant_id = ? AND status = ?",
            (tenant_id, "completed"),
        )
        completed_runs = int(completed_runs) if completed_runs else 0

        # Success rate (percentage, 0-100)
        success_rate = (
            round((completed_runs / total_runs) * 100, 1)
            if total_runs > 0
            else 0.0
        )

        # Average duration of completed runs (seconds)
        avg_duration_seconds = self._compute_avg_duration(tenant_id)

        # Last run timestamp
        last_run_at = self._query_sqlite_scalar(
            """
            SELECT MAX(COALESCE(completed_at, started_at))
            FROM pipeline_runs
            WHERE tenant_id = ?
            """,
            (tenant_id,),
        )

        # Records processed — sum of golden + staging records for the tenant
        records_processed = self._count_processed_records(tenant_id)

        return {
            "totalRuns": total_runs,
            "successRate": success_rate,
            "avgDuration": avg_duration_seconds,
            "recordsProcessed": records_processed,
            "lastRunAt": last_run_at,
        }

    def _compute_avg_duration(self, tenant_id: str) -> float:
        """Calculate the average run duration in seconds for completed runs."""
        rows = self._query_sqlite_runs(
            """
            SELECT started_at, completed_at
            FROM pipeline_runs
            WHERE tenant_id = ? AND status = ? AND started_at IS NOT NULL AND completed_at IS NOT NULL
            """,
            (tenant_id, "completed"),
        )
        if not rows:
            return 0.0

        durations: List[float] = []
        for row in rows:
            try:
                start = datetime.fromisoformat(row["started_at"])
                end = datetime.fromisoformat(row["completed_at"])
                durations.append((end - start).total_seconds())
            except (ValueError, TypeError):
                continue

        return round(sum(durations) / len(durations), 2) if durations else 0.0

    def _count_processed_records(self, tenant_id: str) -> int:
        """Count total processed records (golden + staging) for a tenant."""
        golden_count = self._query_pg_scalar(
            "SELECT COUNT(*) FROM golden_records WHERE tenant_id = :tenant_id",
            {"tenant_id": tenant_id},
        )
        staging_count = self._query_pg_scalar(
            "SELECT COUNT(*) FROM staging_records WHERE tenant_id = :tenant_id",
            {"tenant_id": tenant_id},
        )
        golden_count = int(golden_count) if golden_count else 0
        staging_count = int(staging_count) if staging_count else 0
        return golden_count + staging_count

    # ------------------------------------------------------------------
    # 2. Data Quality
    # ------------------------------------------------------------------

    def get_data_quality(self, tenant_id: str) -> Dict[str, Any]:
        """Compute data quality metrics for the given tenant.

        Loads golden records for the tenant and analyses the JSON
        ``attributes`` column via DuckDB for completeness, uniqueness,
        consistency, and timeliness scoring.

        Returns:
            Dictionary with ``overallScore``, ``completeness``,
            ``uniqueness``, ``consistency``, and ``timeliness``.
        """
        df = self._load_golden_records_df(tenant_id)
        total_rows = len(df)

        if total_rows == 0:
            return {
                "overallScore": 0.0,
                "completeness": 0.0,
                "uniqueness": 0.0,
                "consistency": 0.0,
                "timeliness": 0.0,
            }

        completeness = self._compute_completeness(df, total_rows)
        uniqueness = self._compute_uniqueness(df, total_rows)
        consistency = self._compute_consistency(df, total_rows)
        timeliness = self._compute_timeliness(df, total_rows)

        # Overall score: weighted average
        overall = round(
            (completeness * 0.30)
            + (uniqueness * 0.30)
            + (consistency * 0.20)
            + (timeliness * 0.20),
            1,
        )

        return {
            "overallScore": overall,
            "completeness": completeness,
            "uniqueness": uniqueness,
            "consistency": consistency,
            "timeliness": timeliness,
        }

    def _load_golden_records_df(self, tenant_id: str) -> pl.DataFrame:
        """Load golden records for the tenant into a Polars DataFrame."""
        records: List[Dict[str, Any]] = []

        # Try PostgreSQL first
        try:
            engine = self._get_pg_engine()
            with engine.connect() as conn:
                result = conn.execute(
                    text("SELECT * FROM golden_records WHERE tenant_id = :tenant_id"),
                    {"tenant_id": tenant_id},
                )
                for row in result.mappings():
                    records.append(dict(row))
        except Exception as exc:
            logger.debug("PostgreSQL golden records query failed: %s", exc)

        # Fallback to SQLite
        if not records:
            from app.db import get_sqlite_engine

            for path in (
                os.path.join("storage", "sqlite", "er_staging.db"),
                os.path.join("storage", "sqlite", "staging.db"),
            ):
                if os.path.exists(path):
                    try:
                        sqlite_engine = get_sqlite_engine(path)
                        with sqlite_engine.connect() as conn:
                            result = conn.execute(
                                text("SELECT * FROM golden_records WHERE tenant_id = :tenant_id"),
                                {"tenant_id": tenant_id},
                            )
                            for row in result.mappings():
                                records.append(dict(row))
                        if records:
                            break
                    except Exception as exc:
                        logger.debug("SQLite fallback failed for %s: %s", path, exc)

        if not records:
            return pl.DataFrame(
                schema={
                    "golden_id": pl.Utf8,
                    "tenant_id": pl.Utf8,
                    "cluster_size": pl.Int64,
                    "source_record_ids": pl.Utf8,
                    "attributes": pl.Utf8,
                    "created_at": pl.Utf8,
                    "updated_at": pl.Utf8,
                }
            )

        # Normalize rows to ensure uniform datatypes (especially timestamp fields and JSON blobs)
        normalized: List[Dict[str, Any]] = []
        for r in records:
            row = dict(r)
            for k, v in row.items():
                if isinstance(v, datetime):
                    row[k] = v.isoformat()
                elif isinstance(v, (dict, list)):
                    row[k] = json.dumps(v)
            normalized.append(row)

        return pl.DataFrame(
            normalized,
            infer_schema_length=None,
            schema_overrides={
                "updated_at": pl.Utf8,
                "created_at": pl.Utf8,
            },
        )

    def _compute_completeness(self, df: pl.DataFrame, total_rows: int) -> float:
        """Completeness: percentage of golden records with non-empty attributes."""
        if total_rows == 0:
            return 0.0

        con = duckdb.connect()
        try:
            con.register("golden", df)
            result = con.execute(
                """
                SELECT COUNT(*) FROM golden
                WHERE attributes IS NOT NULL
                  AND LENGTH(TRIM(attributes)) > 2
                """
            ).fetchone()
            non_empty = int(result[0]) if result else 0
            return round((non_empty / total_rows) * 100, 1)
        finally:
            con.close()

    def _compute_uniqueness(self, df: pl.DataFrame, total_rows: int) -> float:
        """Uniqueness: percentage of distinct golden_id values (detecting duplicates)."""
        if total_rows == 0:
            return 0.0

        con = duckdb.connect()
        try:
            con.register("golden", df)
            result = con.execute(
                "SELECT COUNT(DISTINCT golden_id) FROM golden"
            ).fetchone()
            distinct = int(result[0]) if result else 0
            return round((distinct / total_rows) * 100, 1)
        finally:
            con.close()

    def _compute_consistency(self, df: pl.DataFrame, total_rows: int) -> float:
        """Consistency: percentage of records with valid, parseable JSON attributes."""
        if total_rows == 0:
            return 0.0

        valid_count = 0
        attrs_col = "attributes"
        if attrs_col in df.columns:
            for val in df[attrs_col].to_list():
                if val and isinstance(val, str):
                    try:
                        parsed = json.loads(val)
                        if isinstance(parsed, dict) and len(parsed) > 0:
                            valid_count += 1
                    except (json.JSONDecodeError, TypeError):
                        continue
                elif isinstance(val, dict) and len(val) > 0:
                    valid_count += 1

        return round((valid_count / total_rows) * 100, 1)

    def _compute_timeliness(self, df: pl.DataFrame, total_rows: int) -> float:
        """Timeliness: percentage of records updated within the last 30 days."""
        if total_rows == 0:
            return 0.0

        now = datetime.now(timezone.utc)
        timely_count = 0

        # Prefer updated_at, fallback to created_at
        ts_col = "updated_at" if "updated_at" in df.columns else "created_at"
        if ts_col not in df.columns:
            return 100.0  # If no timestamp column, assume current

        for val in df[ts_col].to_list():
            if val is None:
                continue
            try:
                if isinstance(val, datetime):
                    ts = val if val.tzinfo else val.replace(tzinfo=timezone.utc)
                elif isinstance(val, str):
                    ts = datetime.fromisoformat(val)
                    if ts.tzinfo is None:
                        ts = ts.replace(tzinfo=timezone.utc)
                else:
                    continue
                delta = (now - ts).days
                if delta <= 30:
                    timely_count += 1
            except (ValueError, TypeError):
                continue

        return round((timely_count / total_rows) * 100, 1)

    # ------------------------------------------------------------------
    # 3. Entity Stats
    # ------------------------------------------------------------------

    def get_entity_stats(self, tenant_id: str) -> Dict[str, Any]:
        """Aggregate entity counts and type breakdowns for the given tenant.

        Returns:
            Dictionary with ``totalGoldenRecords``, ``totalStagingRecords``,
            ``pendingERCandidates``, and ``entityTypeBreakdown``.
        """
        total_golden = self._query_pg_scalar(
            "SELECT COUNT(*) FROM golden_records WHERE tenant_id = :tenant_id",
            {"tenant_id": tenant_id},
        )
        total_golden = int(total_golden) if total_golden else 0

        total_staging = self._query_pg_scalar(
            "SELECT COUNT(*) FROM staging_records WHERE tenant_id = :tenant_id",
            {"tenant_id": tenant_id},
        )
        total_staging = int(total_staging) if total_staging else 0

        pending_er = self._query_pg_scalar(
            "SELECT COUNT(*) FROM er_candidates WHERE tenant_id = :tenant_id AND status = :status",
            {"tenant_id": tenant_id, "status": "PENDING"},
        )
        pending_er = int(pending_er) if pending_er else 0

        # Entity type breakdown from golden records JSON attributes
        entity_type_breakdown = self._compute_entity_type_breakdown(tenant_id)

        return {
            "totalGoldenRecords": total_golden,
            "totalStagingRecords": total_staging,
            "pendingERCandidates": pending_er,
            "entityTypeBreakdown": entity_type_breakdown,
        }

    def _compute_entity_type_breakdown(self, tenant_id: str) -> Dict[str, int]:
        """Count golden records grouped by entity_type from JSON attributes.

        Uses DuckDB for fast JSON extraction and aggregation.
        """
        df = self._load_golden_records_df(tenant_id)
        if len(df) == 0:
            return {}

        con = duckdb.connect()
        try:
            con.register("golden", df)
            rows = con.execute(
                """
                SELECT
                    json_extract_string(attributes, '$.entity_type') AS entity_type,
                    COUNT(*) AS cnt
                FROM golden
                WHERE json_extract_string(attributes, '$.entity_type') IS NOT NULL
                GROUP BY 1
                ORDER BY cnt DESC
                """
            ).fetchall()
            return {row[0]: int(row[1]) for row in rows if row[0]}
        finally:
            con.close()
