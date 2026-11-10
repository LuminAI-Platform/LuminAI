"""SQL query construction and aggregation parsing for DuckDB Analytics Engine."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from app.processing.analytics_engine.constants import (
    GOLDEN_COLUMNS,
    IDENTIFIER_RE,
    STAGING_COLUMNS,
)


def build_where_clause(
    table_name: str,
    tenant_id: str,
    entity_type: str,
    filters: Dict[str, Any],
    df_columns: Optional[List[str]] = None,
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
        has_entity_type_col = df_columns is not None and "entity_type" in df_columns
        has_json_col = df_columns is not None and json_col in df_columns
        if df_columns is None:
            conditions.append(
                f"(COALESCE(NULLIF(TRY_CAST(entity_type AS VARCHAR), ''), json_extract_string({json_col}, '$.entity_type')) = ?)"
            )
        elif has_entity_type_col and has_json_col:
            conditions.append(
                f"(COALESCE(NULLIF(TRY_CAST(entity_type AS VARCHAR), ''), json_extract_string({json_col}, '$.entity_type')) = ?)"
            )
        elif has_entity_type_col:
            conditions.append("TRY_CAST(entity_type AS VARCHAR) = ?")
        elif has_json_col:
            conditions.append(f"json_extract_string({json_col}, '$.entity_type') = ?")
        else:
            conditions.append("1 = 0")
        params.append(entity_type)

    # Dynamic filters
    for key, val in filters.items():
        if not IDENTIFIER_RE.match(key):
            raise ValueError(
                f"Invalid filter field name: '{key}'. Must be alphanumeric identifier."
            )

        if key in known_cols and (df_columns is None or key in df_columns):
            # Top level table column
            conditions.append(f"{key} = ?")
            params.append(val)
        elif df_columns is None or json_col in df_columns:
            # Nested JSON field
            if isinstance(val, bool):
                conditions.append(
                    f"TRY_CAST(json_extract({json_col}, '$.{key}') AS BOOLEAN) = ?"
                )
                params.append(True if val else False)
            elif isinstance(val, (int, float)):
                conditions.append(
                    f"TRY_CAST(json_extract({json_col}, '$.{key}') AS DOUBLE) = ?"
                )
                params.append(float(val))
            else:
                conditions.append(f"json_extract_string({json_col}, '$.{key}') = ?")
                params.append(str(val))
        else:
            conditions.append("1 = 0")

    where_clause = " WHERE " + " AND ".join(conditions)
    return where_clause, params


def build_aggregation_expressions(
    aggregations: List[str],
    table_name: str,
) -> Tuple[List[str], List[str]]:
    """Build SQL select expressions and result keys from aggregation specifications."""
    is_golden = "golden" in table_name.lower()
    json_col = "attributes" if is_golden else "data"
    known_cols = GOLDEN_COLUMNS if is_golden else STAGING_COLUMNS

    select_exprs = ["COUNT(*) as count"]
    res_keys = ["count"]

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
            raise ValueError(
                f"Invalid field name '{field}' in aggregation '{agg_clean}'."
            )

        if op not in {"avg", "sum", "min", "max", "distinct", "count_distinct"}:
            raise ValueError(
                f"Unsupported aggregation operation '{op}'. Supported: avg, sum, min, max, count, distinct."
            )

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

    return select_exprs, res_keys
