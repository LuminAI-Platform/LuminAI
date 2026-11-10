"""DuckDB OLAP Analytics Engine for LuminAI Data Engine.

Provides high-performance analytical queries and time-series rollups over
golden records (canonical entities) and staging records.
"""

from __future__ import annotations

from app.processing.analytics_engine.constants import (
    GOLDEN_COLUMNS,
    IDENTIFIER_RE,
    INTERVAL_MAP,
    STAGING_COLUMNS,
)
from app.processing.analytics_engine.data_loader import (
    get_pg_engine,
    load_table_dataframe,
    normalize_dataframe,
)
from app.processing.analytics_engine.engine import DuckDBAnalyticsEngine
from app.processing.analytics_engine.query_builder import (
    build_aggregation_expressions,
    build_where_clause,
)

__all__ = [
    "DuckDBAnalyticsEngine",
    "IDENTIFIER_RE",
    "INTERVAL_MAP",
    "GOLDEN_COLUMNS",
    "STAGING_COLUMNS",
    "load_table_dataframe",
    "normalize_dataframe",
    "build_where_clause",
    "build_aggregation_expressions",
    "get_pg_engine",
]
