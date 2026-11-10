"""Dead-Letter Queue (DLQ) and Quarantine management endpoints.

Endpoints:
  POST /quarantine         → List quarantined messages with filter payload.
  GET  /quarantine         → List quarantined messages via query parameters.
  POST /quarantine/replay  → Replay selected quarantined messages to ingest.raw.
  POST /quarantine/discard → Discard selected quarantined messages without reprocessing.
"""

from typing import Optional
from fastapi import APIRouter

from app.api.processing.models import (
    QuarantineActionResponse,
    QuarantineDiscardRequest,
    QuarantineListRequest,
    QuarantineListResponse,
    QuarantineReplayRequest,
    QuarantinedMessageSchema,
)
import app.api.processing as proc

router = APIRouter()


@router.post(
    "/quarantine",
    response_model=QuarantineListResponse,
    summary="List quarantined messages with filters",
)
async def list_quarantine_post(
    request: QuarantineListRequest = QuarantineListRequest(),
) -> QuarantineListResponse:
    """Query and filter quarantined messages from the Dead-Letter Queue."""
    manager = proc.get_quarantine_manager()
    items, total = manager.list_messages(
        tenant_id=request.tenant_id,
        status=request.status,
        limit=request.limit,
        offset=request.offset,
    )
    return QuarantineListResponse(
        total=total,
        limit=request.limit,
        offset=request.offset,
        items=[QuarantinedMessageSchema(**msg.model_dump()) for msg in items],
    )


@router.get(
    "/quarantine",
    response_model=QuarantineListResponse,
    summary="List quarantined messages (GET convenience)",
)
async def list_quarantine_get(
    tenant_id: Optional[str] = None,
    status: Optional[str] = "quarantined",
    limit: int = 50,
    offset: int = 0,
) -> QuarantineListResponse:
    """Retrieve quarantined messages via query parameters."""
    manager = proc.get_quarantine_manager()
    items, total = manager.list_messages(
        tenant_id=tenant_id,
        status=status,
        limit=limit,
        offset=offset,
    )
    return QuarantineListResponse(
        total=total,
        limit=limit,
        offset=offset,
        items=[QuarantinedMessageSchema(**msg.model_dump()) for msg in items],
    )


@router.post(
    "/quarantine/replay",
    response_model=QuarantineActionResponse,
    summary="Replay quarantined messages back to ingest.raw",
)
async def replay_quarantined_messages(
    request: QuarantineReplayRequest,
) -> QuarantineActionResponse:
    """Re-publish quarantined messages back into the ingest.raw stream for reprocessing."""
    manager = proc.get_quarantine_manager()
    replayed = manager.replay_messages(request.message_ids)
    return QuarantineActionResponse(
        action="replay",
        processed_count=len(replayed),
        message_ids=[m.message_id for m in replayed],
        message=f"Successfully replayed {len(replayed)} messages to ingest.raw.",
    )


@router.post(
    "/quarantine/discard",
    response_model=QuarantineActionResponse,
    summary="Discard quarantined messages",
)
async def discard_quarantined_messages(
    request: QuarantineDiscardRequest,
) -> QuarantineActionResponse:
    """Discard quarantined messages without reprocessing."""
    manager = proc.get_quarantine_manager()
    discarded = manager.discard_messages(request.message_ids)
    return QuarantineActionResponse(
        action="discard",
        processed_count=len(discarded),
        message_ids=[m.message_id for m in discarded],
        message=f"Successfully discarded {len(discarded)} quarantined messages.",
    )
