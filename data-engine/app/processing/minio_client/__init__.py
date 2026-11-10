"""MinIO and S3-compatible raw object storage client."""

from __future__ import annotations

from app.processing.minio_client.auth import (
    build_sigv4_headers,
    get_signature_key,
)
from app.processing.minio_client.client import (
    DEFAULT_PART_SIZE,
    MULTIPART_THRESHOLD,
    MinioRawStorageClient,
    get_minio_client,
)
from app.processing.minio_client.parsers import parse_raw_data_to_dataframe

__all__ = [
    "MinioRawStorageClient",
    "MULTIPART_THRESHOLD",
    "DEFAULT_PART_SIZE",
    "get_minio_client",
    "get_signature_key",
    "build_sigv4_headers",
    "parse_raw_data_to_dataframe",
]
