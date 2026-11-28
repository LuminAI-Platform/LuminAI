"""Shared tenant-validated dataset input loaders for Data Engine API endpoints."""

from __future__ import annotations

from pathlib import PurePosixPath
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
import polars as pl

from app.processing.engine.dataframe_utils import records_to_polars_df
from app.processing.minio_client import get_minio_client
from app.security import AuthIdentity, resolve_effective_tenant


def resolve_tenant_context(
    identity: AuthIdentity,
    requested_tenant_id: Optional[str],
    *,
    require_tenant: bool = False,
) -> Optional[str]:
    """Resolve and enforce tenant context without falling back to a hardcoded tenant slug."""
    effective = resolve_effective_tenant(identity, requested_tenant_id)
    cleaned = effective.strip() if isinstance(effective, str) else None
    cleaned = cleaned or None
    if not cleaned and identity.tenant_id:
        cleaned = identity.tenant_id.strip() or None
    if require_tenant and not cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tenant_id is required when loading dataset artifacts from storage.",
        )
    return cleaned


def validate_tenant_storage_key(storage_location: str, effective_tenant: str) -> str:
    """Validate that a MinIO object key is non-empty, traversal-free, and scoped to effective_tenant."""
    raw_key = (storage_location or "").strip()
    if not raw_key or raw_key.startswith("/") or "\\" in raw_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid storage_location path.",
        )
    parts = PurePosixPath(raw_key).parts
    if not parts or ".." in parts or "." in parts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid storage_location path traversal segment.",
        )
    if parts[0] != effective_tenant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: storage_location does not belong to tenant '{effective_tenant}'.",
        )
    return raw_key


def load_dataframe_from_storage(
    storage_location: str,
    effective_tenant: Optional[str],
    *,
    bucket: str = "luminai-raw",
) -> pl.DataFrame:
    """Load a Polars DataFrame from a tenant-validated MinIO object key."""
    if not effective_tenant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tenant_id is required when loading dataset artifacts from storage.",
        )
    validated_key = validate_tenant_storage_key(storage_location, effective_tenant)
    try:
        minio_client = get_minio_client()
        return minio_client.load_dataframe(bucket, validated_key)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Failed to load dataset storage object '{validated_key}': {exc}",
        ) from exc


def load_dataframe_from_records_or_storage(
    records: Optional[List[Dict[str, Any]]],
    storage_location: Optional[str],
    effective_tenant: Optional[str],
    *,
    empty_detail: str = "Cannot process an empty dataset.",
    bucket: str = "luminai-raw",
) -> pl.DataFrame:
    """Build a Polars DataFrame from inline records or fall back to tenant-scoped MinIO storage."""
    if records:
        df = records_to_polars_df(records)
        if df.height == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=empty_detail)
        return df

    if storage_location and storage_location.strip():
        df = load_dataframe_from_storage(storage_location, effective_tenant, bucket=bucket)
        if df.height == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=empty_detail)
        return df

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=empty_detail)
