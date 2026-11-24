"""Ingest schema auto-detection and pre-flight data quality validation endpoints.

Endpoints:
  POST /validate-schema        → Validate schema & sniff column types via payload (content/key/path).
  POST /validate-schema/upload → Direct multipart file upload for schema auto-detection.
"""

from typing import Optional
from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status

from app.api.processing.models import (
    SchemaValidationRequest,
    SchemaValidationResponse,
)

router = APIRouter()


@router.post(
    "/validate-schema",
    response_model=SchemaValidationResponse,
    summary="Validate ingest schema, auto-detect column types, and suggest ontology mappings",
)
async def validate_schema_endpoint(
    request: SchemaValidationRequest,
) -> SchemaValidationResponse:
    """
    Perform pre-flight schema auto-detection and data quality validation.

    Auto-detects column types ('string', 'number', 'date', 'boolean', 'email', 'phone'),
    calculates null percentages, unique value counts, type distributions, suggests
    fuzzy ontology property mappings, and rejects files with >50% null columns.
    """
    from app.processing.minio_client import get_minio_client
    from app.processing.schema_detector import get_schema_detector

    detector = get_schema_detector()
    data_bytes: Optional[bytes] = None
    file_name = request.file_name or "upload.csv"

    if request.content is not None:
        data_bytes = request.content.encode("utf-8")
    elif request.object_key is not None:
        clean_key = request.object_key.lstrip("/").replace("\\", "/")
        if ".." in clean_key or clean_key.startswith("/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid object_key format (directory traversal disallowed).",
            )
        bucket = request.bucket or "luminai-raw"
        file_name = clean_key
        try:
            client = get_minio_client()
            data_bytes = client.get_object_bytes(bucket, clean_key)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Could not retrieve object '{clean_key}' from bucket '{bucket}': {exc}",
            )
    elif request.file_path is not None:
        import tempfile
        from pathlib import Path

        file_path_obj = Path(request.file_path).resolve()
        allowed_bases = [
            Path(tempfile.gettempdir()).resolve(),
            Path("storage").resolve(),
            Path("data").resolve(),
        ]
        is_safe = any(file_path_obj.is_relative_to(base) for base in allowed_bases)
        if not is_safe or not file_path_obj.is_file():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="file_path must point to an existing file within authorized storage or temp upload directories.",
            )
        file_name = file_path_obj.name
        try:
            with open(file_path_obj, "rb") as f:
                data_bytes = f.read()
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Could not read file at '{file_path_obj}': {exc}",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide one of 'content', 'object_key', or 'file_path' for validation.",
        )

    report = detector.validate_file_bytes(
        data_bytes, file_name=file_name, max_null_pct=request.max_null_pct
    )
    if request.reject_on_violation and not report.is_valid:
        raise HTTPException(
            status_code=422,
            detail=report.error_message,
        )

    return SchemaValidationResponse(**report.to_dict())


@router.post(
    "/validate-schema/upload",
    response_model=SchemaValidationResponse,
    summary="Direct file upload for schema auto-detection and validation",
)
async def validate_schema_upload_endpoint(
    file: UploadFile = File(...),
    reject_on_violation: bool = Query(
        default=True, description="Whether to reject with 422 if nulls exceed threshold"
    ),
    max_null_pct: Optional[float] = Query(
        default=None,
        ge=0.0,
        le=100.0,
        description="Optional override for maximum allowable null percentage threshold",
    ),
) -> SchemaValidationResponse:
    """
    Direct file upload endpoint for schema auto-detection and pre-flight validation.
    """
    from app.processing.schema_detector import get_schema_detector

    detector = get_schema_detector()
    data_bytes = await file.read()
    report = detector.validate_file_bytes(
        data_bytes, file_name=file.filename or "upload.csv", max_null_pct=max_null_pct
    )

    if reject_on_violation and not report.is_valid:
        raise HTTPException(
            status_code=422,
            detail=report.error_message,
        )

    return SchemaValidationResponse(**report.to_dict())
