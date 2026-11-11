"""Dashboard analytics service for the LuminAI Data Engine."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Tuple

import duckdb
import polars as pl

from app.config import get_settings
from app.processing.dashboard_service.data_loader import (
    get_pg_engine,
    get_run_storage_path,
    load_golden_records_df,
    query_pg_rows,
    query_pg_scalar,
    query_sqlite_runs,
    query_sqlite_scalar,
)
from app.processing.dashboard_service.quality_calculator import (
    compute_completeness,
    compute_consistency,
    compute_data_quality,
    compute_timeliness,
    compute_uniqueness,
)

logger = logging.getLogger(__name__)


class DashboardAnalyticsService:
    """Computes dashboard metrics from PostgreSQL / SQLite / in-memory data."""

    def __init__(self) -> None:
        self.settings = get_settings()

    def _get_pg_engine(self):
        """Return the shared SQLAlchemy PostgreSQL engine."""
        return get_pg_engine()

    def _query_pg_scalar(self, sql: str, params: Dict[str, Any]) -> Any:
        """Execute a parameterized scalar query against PostgreSQL."""
        return query_pg_scalar(sql, params)

    def _query_pg_rows(self, sql: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Execute a parameterized query and return all rows as dicts."""
        return query_pg_rows(sql, params)

    def _get_run_storage_path(self) -> str:
        """Return the path to the SQLite run-storage database."""
        return get_run_storage_path()

    def _query_sqlite_runs(self, sql: str, params: Tuple[Any, ...]):
        """Execute a parameterized read query against the SQLite run tracker DB."""
        return query_sqlite_runs(sql, params)

    def _query_sqlite_scalar(self, sql: str, params: Tuple[Any, ...]) -> Any:
        """Execute a parameterized scalar query against SQLite run storage."""
        return query_sqlite_scalar(sql, params)

    def _load_golden_records_df(self, tenant_id: str) -> pl.DataFrame:
        """Load golden records for the tenant into a Polars DataFrame."""
        return load_golden_records_df(tenant_id)

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

    def _compute_completeness(self, df: pl.DataFrame, total_rows: int) -> float:
        return compute_completeness(df, total_rows)

    def _compute_uniqueness(self, df: pl.DataFrame, total_rows: int) -> float:
        return compute_uniqueness(df, total_rows)

    def _compute_consistency(self, df: pl.DataFrame, total_rows: int) -> float:
        return compute_consistency(df, total_rows)

    def _compute_timeliness(self, df: pl.DataFrame, total_rows: int) -> float:
        return compute_timeliness(df, total_rows)

    def get_pipeline_stats(self, tenant_id: str) -> Dict[str, Any]:
        """Aggregate pipeline execution metrics for the given tenant."""
        total_runs = self._query_sqlite_scalar(
            "SELECT COUNT(*) FROM pipeline_runs WHERE tenant_id = ?",
            (tenant_id,),
        )
        total_runs = int(total_runs) if total_runs else 0

        completed_runs = self._query_sqlite_scalar(
            "SELECT COUNT(*) FROM pipeline_runs WHERE tenant_id = ? AND status = ?",
            (tenant_id, "completed"),
        )
        completed_runs = int(completed_runs) if completed_runs else 0

        success_rate = (
            round((completed_runs / total_runs) * 100, 1) if total_runs > 0 else 0.0
        )

        avg_duration_seconds = self._compute_avg_duration(tenant_id)

        last_run_at = self._query_sqlite_scalar(
            """
            SELECT MAX(COALESCE(completed_at, started_at))
            FROM pipeline_runs
            WHERE tenant_id = ?
            """,
            (tenant_id,),
        )

        records_processed = self._count_processed_records(tenant_id)

        return {
            "totalRuns": total_runs,
            "successRate": success_rate,
            "avgDuration": avg_duration_seconds,
            "recordsProcessed": records_processed,
            "lastRunAt": last_run_at,
        }

    def get_data_quality(self, tenant_id: str) -> Dict[str, Any]:
        """Compute data quality metrics for the given tenant."""
        df = self._load_golden_records_df(tenant_id)
        return compute_data_quality(df)

    def get_entity_stats(self, tenant_id: str) -> Dict[str, Any]:
        """Aggregate entity counts and type breakdowns for the given tenant."""
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

        entity_type_breakdown = self._compute_entity_type_breakdown(tenant_id)

        return {
            "totalGoldenRecords": total_golden,
            "totalStagingRecords": total_staging,
            "pendingERCandidates": pending_er,
            "entityTypeBreakdown": entity_type_breakdown,
        }

    def _compute_entity_type_breakdown(self, tenant_id: str) -> Dict[str, int]:
        """Count golden records grouped by entity_type from JSON attributes."""
        df = self._load_golden_records_df(tenant_id)
        if len(df) == 0:
            return {}

        con = duckdb.connect()
        try:
            con.execute("PRAGMA threads=4")
            con.execute("PRAGMA preserve_insertion_order=false")
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
