"""Shared multi-tenant PostgreSQL schema resolution and Flyway/Alembic compatibility helpers."""

from __future__ import annotations

import logging
import re
import uuid
from typing import Any, Dict, Iterable, Optional, Set, Tuple

from sqlalchemy import Connection, inspect, text

logger = logging.getLogger(__name__)


def safe_schema_name(tenant_id: str) -> str:
    """Sanitize a tenant slug/identifier into a safe ``tenant_{slug}`` schema name."""
    cleaned = str(tenant_id or "default").replace("-", "_").strip()
    if not cleaned or not re.match(r"^[a-zA-Z0-9_]+$", cleaned):
        raise ValueError(f"Invalid tenant identifier: {tenant_id}")
    return cleaned if cleaned.startswith("tenant_") else f"tenant_{cleaned}"


def to_uuid_str(
    val: Any,
    default: str = "00000000-0000-0000-0000-000000000001",
) -> str:
    """Deterministically coerce an arbitrary ID or tenant slug into an RFC-4122 UUID string."""
    if not val:
        return default
    s = str(val).strip()
    if s.startswith("gr-"):
        try:
            return str(uuid.UUID(s[3:]))
        except (ValueError, AttributeError):
            pass
    try:
        return str(uuid.UUID(s))
    except (ValueError, AttributeError):
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, s))


def is_postgres_conn(conn: Connection) -> bool:
    """Return True when the SQLAlchemy connection is backed by PostgreSQL."""
    return conn.dialect.name == "postgresql"


def set_pg_search_path(conn: Connection, schema_name: Optional[str]) -> None:
    """Safely configure PostgreSQL ``search_path`` for a tenant or shared schema."""
    if not is_postgres_conn(conn) or not schema_name:
        return
    cleaned = str(schema_name).replace("-", "_").strip()
    if cleaned == "public":
        conn.execute(text("SET search_path TO public, tenant_default;"))
        return
    validated = safe_schema_name(schema_name)
    conn.execute(text(f'SET search_path TO "{validated}", tenant_default, public;'))


def reset_pg_search_path(conn: Connection) -> None:
    """Reset PostgreSQL ``search_path`` back to database defaults."""
    if not is_postgres_conn(conn):
        return
    try:
        conn.execute(text("RESET search_path;"))
    except Exception:
        pass


def resolve_tenant_pg_context(conn: Connection, tenant_id: str) -> Dict[str, str]:
    """Resolve ``schema_name``, ``tenant_slug``, and ``tenant_uuid`` from ``public.tenants`` when available."""
    raw = str(tenant_id or "acme").strip()
    tenant_slug = raw
    tenant_uuid = to_uuid_str(raw)

    if is_postgres_conn(conn):
        try:
            row = (
                conn.execute(
                    text(
                        "SELECT id::text AS id, slug FROM public.tenants "
                        "WHERE slug = :raw OR id::text = :raw LIMIT 1"
                    ),
                    {"raw": raw},
                )
                .mappings()
                .first()
            )
            if row:
                tenant_uuid = str(row["id"])
                tenant_slug = str(row["slug"])
        except Exception as exc:
            logger.debug("public.tenants lookup skipped (%s); using slug '%s'", exc, raw)

    try:
        schema_name = safe_schema_name(tenant_slug)
    except ValueError:
        schema_name = "tenant_default"

    return {
        "schema_name": schema_name,
        "tenant_slug": tenant_slug,
        "tenant_uuid": tenant_uuid,
        "tenant_raw": raw,
    }


def resolve_table_schema(
    conn: Connection,
    table_name: str,
    preferred_schemas: Iterable[str] = ("tenant_default", "public"),
) -> Tuple[Optional[str], Set[str]]:
    """Inspect column names for ``table_name`` across candidate PostgreSQL schemas or SQLite."""
    inspector = inspect(conn)
    if not is_postgres_conn(conn):
        try:
            cols = {c["name"] for c in inspector.get_columns(table_name)}
            return None, cols
        except Exception:
            return None, set()

    seen: Set[str] = set()
    for schema in list(preferred_schemas) + ["tenant_default", "public"]:
        if not schema or schema in seen:
            continue
        seen.add(schema)
        try:
            cols = {c["name"] for c in inspector.get_columns(table_name, schema=schema)}
            if cols:
                return schema, cols
        except Exception:
            continue

    try:
        cols = {c["name"] for c in inspector.get_columns(table_name)}
        return None, cols
    except Exception:
        return None, set()
