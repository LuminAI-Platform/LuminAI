"""Canonical Golden Record retrieval, version history, and rollback endpoints.

Endpoints:
  GET  /golden-records/{golden_id}          → Fetch current canonical state and attributes.
  GET  /golden-records/{golden_id}/history  → Fetch version audit history and point-in-time snapshots.
  POST /golden-records/{golden_id}/rollback → Revert Golden Record to a prior historical version.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.processing.models import (
    GoldenRecordHistoryItem,
    GoldenRecordHistoryResponse,
    GoldenRecordResponse,
    RollbackRequest,
    RollbackResponse,
)
from app.security import AuthIdentity, get_current_identity, resolve_effective_tenant

router = APIRouter()


@router.get(
    "/golden-records/{golden_id}",
    response_model=GoldenRecordResponse,
    summary="Get current state of a Golden Record",
)
def get_golden_record_endpoint(
    golden_id: str,
    tenant_id: Optional[str] = Query(
        default=None, description="Optional tenant scoping filter"
    ),
    identity: AuthIdentity = Depends(get_current_identity),
) -> GoldenRecordResponse:
    """Retrieve the current state, version, and attributes of a canonical Golden Record."""
    from app.processing.er.golden_record import get_golden_record

    effective_tenant = resolve_effective_tenant(identity, tenant_id)
    record = get_golden_record(golden_id, tenant_id=effective_tenant)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Golden record '{golden_id}' not found",
        )
    return GoldenRecordResponse(**record)


@router.get(
    "/golden-records/{golden_id}/history",
    response_model=GoldenRecordHistoryResponse,
    summary="Get version history of a Golden Record",
)
def get_golden_record_history_endpoint(
    golden_id: str,
    tenant_id: Optional[str] = Query(
        default=None, description="Optional tenant scoping filter"
    ),
    identity: AuthIdentity = Depends(get_current_identity),
) -> GoldenRecordHistoryResponse:
    """Retrieve complete historical audit trail and point-in-time snapshots for a Golden Record."""
    from app.processing.er.golden_record import get_golden_record_history

    effective_tenant = resolve_effective_tenant(identity, tenant_id)
    history = get_golden_record_history(golden_id, tenant_id=effective_tenant)
    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No history found for golden record '{golden_id}'",
        )
    return GoldenRecordHistoryResponse(
        golden_id=golden_id,
        total_versions=len(history),
        history=[GoldenRecordHistoryItem(**item) for item in history],
    )


@router.post(
    "/golden-records/{golden_id}/rollback",
    response_model=RollbackResponse,
    summary="Rollback Golden Record to a prior version",
)
def rollback_golden_record_endpoint(
    golden_id: str,
    request: RollbackRequest,
    tenant_id: Optional[str] = Query(
        default=None, description="Optional tenant scoping filter"
    ),
    identity: AuthIdentity = Depends(get_current_identity),
) -> RollbackResponse:
    """Restore a Golden Record to a prior historical version snapshot."""
    from app.processing.er.golden_record import rollback_golden_record

    effective_tenant = resolve_effective_tenant(identity, tenant_id)
    try:
        restored = rollback_golden_record(
            golden_id=golden_id,
            target_version=request.target_version,
            tenant_id=effective_tenant,
        )
        return RollbackResponse(
            message=f"Golden record '{golden_id}' successfully rolled back to version {request.target_version} (new version: {restored.get('version')}).",
            golden_record=GoldenRecordResponse(**restored),
        )
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        )
