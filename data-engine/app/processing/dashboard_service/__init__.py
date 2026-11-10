"""Dashboard analytics service package for LuminAI Data Engine."""

from __future__ import annotations

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
from app.processing.dashboard_service.service import DashboardAnalyticsService

__all__ = [
    "DashboardAnalyticsService",
    "get_pg_engine",
    "get_run_storage_path",
    "load_golden_records_df",
    "query_pg_rows",
    "query_pg_scalar",
    "query_sqlite_runs",
    "query_sqlite_scalar",
    "compute_data_quality",
    "compute_completeness",
    "compute_uniqueness",
    "compute_consistency",
    "compute_timeliness",
]
