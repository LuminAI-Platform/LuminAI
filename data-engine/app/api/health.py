"""
app/api/health.py
-----------------
Health check endpoint for the LuminAI Data Engine.

GET /health  →  200 OK with service status payload.
Used by Kubernetes liveness probes and the Core Backend circuit breaker.
"""

from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(tags=["Health"])


@router.get("/health", summary="Liveness check")
async def health_check() -> dict:
    """
    Returns the current service health status.

    - **status**: `"ok"` when the service is running normally.
    - **service**: service name.
    - **version**: current application version.
    """
    settings = get_settings()
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
    }
