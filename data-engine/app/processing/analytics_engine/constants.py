"""Constants and regex patterns for the DuckDB Analytics Engine."""

from __future__ import annotations

import re

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

GOLDEN_COLUMNS = {
    "golden_id",
    "id",
    "tenant_id",
    "cluster_size",
    "source_record_ids",
    "source_count",
    "attributes",
    "properties",
    "entity_type",
    "canonical_name",
    "confidence_score",
    "version",
    "created_at",
    "updated_at",
}

STAGING_COLUMNS = {"id", "tenant_id", "source_id", "raw_id", "data", "staged_at"}
