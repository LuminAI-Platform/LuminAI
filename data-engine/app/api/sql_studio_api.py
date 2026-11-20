"""SQL Studio API endpoint powered by DuckDB in-memory analytical query engine.

Allows Data Analysts and Engineers to execute interactive, read-only SQL queries
over registered datasets, parquet tables, or inline sample tables.
"""

from __future__ import annotations

import re
import time
from typing import Any, Dict, List, Optional

import duckdb
from fastapi import APIRouter, HTTPException, status
import polars as pl
from pydantic import BaseModel, Field

router = APIRouter(prefix="/analytics/sql", tags=["sql-studio"])

# Forbidden SQL statements to enforce safe read-only query semantics
DISALLOWED_PATTERNS = [
    r"\bDROP\b",
    r"\bDELETE\b",
    r"\bUPDATE\b",
    r"\bINSERT\b",
    r"\bALTER\b",
    r"\bTRUNCATE\b",
    r"\bCREATE\b",
    r"\bGRANT\b",
    r"\bREVOKE\b",
    r"\bCOPY\b",
    r"\bATTACH\b",
    r"\bDETACH\b",
    r"\bINSTALL\b",
    r"\bLOAD\b",
    r"\bPRAGMA\b",
]
DISALLOWED_REGEX = re.compile("|".join(DISALLOWED_PATTERNS), re.IGNORECASE)


class SqlQueryRequest(BaseModel):
    query: str = Field(..., description="Read-only SQL query to execute.")
    tenant_id: str = Field(default="acme", description="Tenant context.")
    tables: Optional[Dict[str, List[Dict[str, Any]]]] = Field(
        default=None,
        description="Optional dictionary mapping table names to row records.",
    )
    limit: int = Field(default=500, ge=1, le=5000, description="Max rows to return.")


class SqlColumnInfo(BaseModel):
    name: str
    data_type: str


class SqlQueryResponse(BaseModel):
    columns: List[SqlColumnInfo]
    rows: List[Dict[str, Any]]
    row_count: int
    total_count: int
    execution_time_ms: float
    query: str


def validate_read_only(query: str) -> None:
    """Enforces that only non-mutating SELECT / WITH statements are run."""
    cleaned = query.strip()
    if not cleaned:
        raise ValueError("Query cannot be empty.")

    # Remove comments and strings before regex check to prevent bypass
    cleaned_no_comments = re.sub(r"--.*$", "", cleaned, flags=re.MULTILINE)
    cleaned_no_comments = re.sub(r"/\*.*?\*/", "", cleaned_no_comments, flags=re.DOTALL)

    if DISALLOWED_REGEX.search(cleaned_no_comments):
        raise ValueError("Only read-only SELECT queries are permitted in SQL Studio.")

    # Must start with SELECT, WITH, or EXPLAIN
    first_word = cleaned_no_comments.strip().split()[0].upper()
    if first_word not in ("SELECT", "WITH", "EXPLAIN", "DESCRIBE", "SHOW"):
        raise ValueError(f"Disallowed initial statement '{first_word}'. Only SELECT queries are permitted.")


@router.post("/execute", response_model=SqlQueryResponse, summary="Execute interactive analytical SQL query")
async def execute_sql_query(request: SqlQueryRequest) -> SqlQueryResponse:
    """Executes a validated read-only SQL query against in-memory DuckDB tables."""
    try:
        validate_read_only(request.query)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    start_time = time.perf_counter()
    conn = duckdb.connect(":memory:")

    try:
        # Register in-memory tables if supplied
        if request.tables:
            for table_name, rows in request.tables.items():
                # Sanitize table identifier
                if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", table_name):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid table identifier '{table_name}'.",
                    )
                if rows:
                    df = pl.DataFrame(rows)
                    arrow_table = df.to_arrow()
                    conn.register(table_name, arrow_table)
                else:
                    # Register empty table schema
                    conn.execute(f"CREATE TABLE {table_name} AS SELECT 1 AS id WHERE 1=0")

        # Execute query
        rel = conn.sql(request.query)
        if rel is None:
            return SqlQueryResponse(
                columns=[],
                rows=[],
                row_count=0,
                total_count=0,
                execution_time_ms=round((time.perf_counter() - start_time) * 1000.0, 2),
                query=request.query,
            )

        col_names = rel.columns
        col_types = [str(t) for t in rel.types]
        columns = [SqlColumnInfo(name=name, data_type=dtype) for name, dtype in zip(col_names, col_types)]

        # Fetch limited results
        fetched_df = rel.limit(request.limit).pl()
        rows = fetched_df.to_dicts()
        row_count = len(rows)

        # Count total
        try:
            total_count = conn.sql(f"SELECT COUNT(*) FROM ({request.query}) AS _subq").fetchone()[0]
        except Exception:
            total_count = row_count

        execution_time_ms = round((time.perf_counter() - start_time) * 1000.0, 2)

        return SqlQueryResponse(
            columns=columns,
            rows=rows,
            row_count=row_count,
            total_count=total_count,
            execution_time_ms=execution_time_ms,
            query=request.query,
        )

    except duckdb.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"DuckDB execution error: {str(exc)}",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected query error: {str(exc)}",
        )
    finally:
        conn.close()
