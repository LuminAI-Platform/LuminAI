"""Health check endpoint for the LuminAI Data Engine.

GET /health  →  200 OK with service status payload.
Used by Kubernetes liveness probes and the Core Backend circuit breaker.
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.config import get_settings

router = APIRouter(tags=["Health"])


class HealthResponse(BaseModel):
    """Response payload schema for service health diagnostics."""

    status: str = Field(
        ...,
        description="The operational status of the service (typically 'ok').",
        examples=["ok"],
    )
    service: str = Field(
        ...,
        description="The name of the service.",
        examples=["LuminAI Data Engine"],
    )
    version: str = Field(
        ...,
        description="The semantic version of the running application.",
        examples=["0.1.0"],
    )


@router.get("/health", response_model=HealthResponse, summary="Liveness check")
async def health_check() -> HealthResponse:
    """Retrieve the current operational health of the Data Engine.

    ### Response Details:
    - **status**: Indicates if the service is running normally (`"ok"`).
    - **service**: The service descriptor name.
    - **version**: Active application package version.
    """
    settings = get_settings()
    return HealthResponse(
        status="ok",
        service=settings.app_name,
        version=settings.app_version,
    )

