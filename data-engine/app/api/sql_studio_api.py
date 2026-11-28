"""SQL Studio API endpoint powered by DuckDB in-memory analytical query engine.

Allows Data Analysts and Engineers to execute interactive, read-only SQL queries
over registered datasets, parquet tables, or inline sample tables.
"""

from __future__ import annotations

import re
import time
from typing import Any, Dict, List, Optional

import duckdb
from fastapi import APIRouter, Depends, HTTPException, status
import polars as pl
from pydantic import BaseModel, Field

from app.security import AuthIdentity, get_current_identity

router = APIRouter(prefix="/analytics/sql", tags=["sql-studio"])

# Forbidden SQL statements to enforce safe read-only query semantics
# Block mutating DDL/DML and file/system-access DuckDB statements and functions
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
    r"\bCALL\b",
    r"\bSET\b",
    r"\bRESET\b",
    r"\bEXPORT\b",
    r"\bIMPORT\b",
    r"\bUSE\b",
    r"\bVACUUM\b",
    r"\bCHECKPOINT\b",
    r"\bREAD_CSV\b",
    r"\bREAD_CSV_AUTO\b",
    r"\bREAD_PARQUET\b",
    r"\bPARQUET_SCAN\b",
    r"\bREAD_JSON\b",
    r"\bREAD_JSON_AUTO\b",
    r"\bREAD_NDJSON\b",
    r"\bREAD_NDJSON_AUTO\b",
    r"\bREAD_TEXT\b",
    r"\bREAD_BLOB\b",
    r"\bSCAN_PARQUET\b",
    r"\bSCAN_CSV\b",
    r"\bPOSTGRES_SCAN\b",
    r"\bSQLITE_SCAN\b",
    r"\bGLOB\b",
    r"\bGETENV\b",
]
DISALLOWED_REGEX = re.compile("|".join(DISALLOWED_PATTERNS), re.IGNORECASE)


class SqlQueryRequest(BaseModel):
    query: str = Field(..., description="Read-only SQL query to execute.")
    tenant_id: Optional[str] = Field(default=None, description="Tenant context.")
    dataset_id: Optional[str] = Field(default=None, description="Optional dataset ID.")
    storage_location: Optional[str] = Field(
        default=None,
        description="Optional tenant-scoped MinIO object key to bind as the 'dataset' table.",
    )
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


def _strip_comments_and_literals(query: str) -> str:
    """Strip SQL comments and replace single-quoted string literals with placeholders."""
    no_line_comments = re.sub(r"--.*$", "", query, flags=re.MULTILINE)
    no_comments = re.sub(r"/\*.*?\*/", "", no_line_comments, flags=re.DOTALL)
    return re.sub(r"'(?:''|[^'])*'", "''", no_comments)


def validate_read_only(query: str) -> str:
    """Validate that only a single non-mutating read-only statement is run.

    Returns the normalized query with any single trailing semicolon stripped.
    """
    cleaned = query.strip()
    if not cleaned:
        raise ValueError("Query cannot be empty.")

    inspected = _strip_comments_and_literals(cleaned).strip()
    if not inspected:
        raise ValueError("Query cannot be empty.")

    if inspected.endswith(";"):
        inspected = inspected[:-1].rstrip()
        cleaned = cleaned[:-1].rstrip()

    if ";" in inspected:
        raise ValueError("Multi-statement SQL queries are prohibited in SQL Studio.")

    if DISALLOWED_REGEX.search(inspected):
        raise ValueError("Only read-only SELECT queries are permitted in SQL Studio.")

    tokens = inspected.split()
    first_word = tokens[0].upper() if tokens else ""
    if first_word not in ("SELECT", "WITH", "EXPLAIN", "DESCRIBE", "SHOW"):
        raise ValueError(f"Disallowed initial statement '{first_word}'. Only SELECT queries are permitted.")

    return cleaned


@router.post("/execute", response_model=SqlQueryResponse, summary="Execute interactive analytical SQL query")
def execute_sql_query(
    request: SqlQueryRequest,
    identity: AuthIdentity = Depends(get_current_identity),
) -> SqlQueryResponse:
    """Executes a validated read-only SQL query against in-memory DuckDB tables."""
    from app.api.dataset_input import load_dataframe_from_storage, resolve_tenant_context

    needs_storage = (bool(request.storage_location) or bool(request.dataset_id)) and (
        not request.tables or "dataset" not in request.tables
    )
    effective_tenant = resolve_tenant_context(
        identity, request.tenant_id, require_tenant=needs_storage
    )
    try:
        normalized_query = validate_read_only(request.query)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    start_time = time.perf_counter()
    conn = duckdb.connect(":memory:", config={"enable_external_access": False})
    try:
        conn.execute("SET enable_external_access = false;")
    except Exception:
        pass

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
                    try:
                        df = pl.DataFrame(rows, infer_schema_length=None)
                    except Exception:
                        import pandas as pd
                        df = pl.from_pandas(pd.DataFrame(rows))
                    arrow_table = df.to_arrow()
                    conn.register(table_name, arrow_table)
                else:
                    # Register empty table schema
                    conn.execute(f"CREATE TABLE {table_name} AS SELECT 1 AS id WHERE 1=0")

        # Load 'dataset' table from storage_location or legacy {tenant}/raw/{dataset_id} when not supplied inline
        if (request.storage_location or request.dataset_id) and (
            not request.tables or "dataset" not in request.tables
        ):
            if request.storage_location and request.storage_location.strip():
                ds_df = load_dataframe_from_storage(
                    request.storage_location, effective_tenant
                )
                conn.register("dataset", ds_df.to_arrow())
            elif request.dataset_id:
                from app.processing.minio_client import get_minio_client

                m_client = get_minio_client()
                ds_key = f"{effective_tenant}/raw/{request.dataset_id}"
                try:
                    ds_df = m_client.load_dataframe("luminai-raw", ds_key)
                    conn.register("dataset", ds_df.to_arrow())
                except Exception as load_exc:
                    if not request.tables:
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"Failed to load dataset '{request.dataset_id}' for tenant '{effective_tenant}': {load_exc}",
                        ) from load_exc

        # Execute query
        rel = conn.sql(normalized_query)
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

        # Count total rows for selectable queries
        inspected_head = _strip_comments_and_literals(normalized_query).strip().split()[0].upper()
        if inspected_head in ("SELECT", "WITH"):
            try:
                total_count = int(conn.sql(f"SELECT COUNT(*) FROM ({normalized_query}) AS _subq").fetchone()[0])
            except Exception:
                total_count = int(conn.sql(normalized_query).pl().height)
        else:
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
