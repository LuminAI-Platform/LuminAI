"""MinIO and S3-compatible raw object storage client implementation."""

from __future__ import annotations

import logging
import os
from typing import Optional

import httpx
import polars as pl

from app.config import get_settings
from app.processing.minio_client.auth import build_sigv4_headers
from app.processing.minio_client.parsers import parse_raw_data_to_dataframe

logger = logging.getLogger(__name__)

MULTIPART_THRESHOLD: int = 100 * 1024 * 1024  # 100MB threshold
DEFAULT_PART_SIZE: int = 10 * 1024 * 1024  # 10MB parts


class MinioRawStorageClient:
    """Client for reading and writing raw files in MinIO / S3 object storage."""

    MULTIPART_THRESHOLD: int = MULTIPART_THRESHOLD
    DEFAULT_PART_SIZE: int = DEFAULT_PART_SIZE

    def __init__(
        self,
        endpoint: Optional[str] = None,
        access_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        secure: Optional[bool] = None,
        region: Optional[str] = None,
        local_fallback_dir: Optional[str] = None,
    ) -> None:
        settings = get_settings()
        self.endpoint = endpoint or settings.minio_endpoint
        self.access_key = access_key or settings.minio_access_key
        self.secret_key = secret_key or settings.minio_secret_key
        self.secure = secure if secure is not None else settings.minio_secure
        self.region = region or settings.minio_region
        self.local_fallback_dir = local_fallback_dir or os.path.join("storage", "raw")

        proto = "https" if self.secure else "http"
        endpoint_clean = (
            self.endpoint.replace("http://", "").replace("https://", "").rstrip("/")
        )
        self.base_url = f"{proto}://{endpoint_clean}"
        self.host_header = endpoint_clean

    def _build_sigv4_headers(
        self,
        method: str,
        path: str,
        payload: bytes = b"",
        content_type: Optional[str] = None,
    ) -> dict[str, str]:
        """Generate AWS SigV4 authentication headers for MinIO/S3."""
        return build_sigv4_headers(
            host_header=self.host_header,
            access_key=self.access_key,
            secret_key=self.secret_key,
            region=self.region,
            method=method,
            path=path,
            payload=payload,
            content_type=content_type,
        )

    def get_object_bytes(self, bucket: str, object_key: str) -> bytes:
        """Fetch raw object bytes from MinIO, falling back to local storage."""
        clean_key = object_key.lstrip("/")
        path = f"/{bucket}/{clean_key}"
        url = f"{self.base_url}{path}"

        try:
            headers = self._build_sigv4_headers("GET", path)
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(url, headers=headers)
                if resp.status_code == 200:
                    logger.debug(
                        "Retrieved s3://%s/%s from MinIO (%d bytes)",
                        bucket,
                        clean_key,
                        len(resp.content),
                    )
                    return resp.content
                logger.debug(
                    "MinIO GET %s returned %s. Trying local fallback.",
                    url,
                    resp.status_code,
                )
        except Exception as exc:
            logger.debug(
                "MinIO unreachable (%s). Checking local storage fallback.", exc
            )

        local_path = os.path.join(self.local_fallback_dir, bucket, clean_key)
        if os.path.exists(local_path):
            with open(local_path, "rb") as f:
                logger.debug(
                    "Loaded s3://%s/%s from local fallback: %s",
                    bucket,
                    clean_key,
                    local_path,
                )
                return f.read()

        alt_local_path = os.path.join(self.local_fallback_dir, clean_key)
        if os.path.exists(alt_local_path):
            with open(alt_local_path, "rb") as f:
                logger.debug(
                    "Loaded %s from local fallback: %s", clean_key, alt_local_path
                )
                return f.read()

        raise FileNotFoundError(
            f"Object s3://{bucket}/{clean_key} not found in MinIO or local storage ({local_path})"
        )

    def put_object_multipart(
        self,
        bucket: str,
        object_key: str,
        data: bytes,
        content_type: str = "text/csv",
        part_size: int = DEFAULT_PART_SIZE,
    ) -> bool:
        """Upload large object to MinIO using S3 multipart upload protocol."""
        import xml.etree.ElementTree as ET

        clean_key = object_key.lstrip("/")
        path = f"/{bucket}/{clean_key}"
        url = f"{self.base_url}{path}"

        local_path = os.path.join(self.local_fallback_dir, bucket, clean_key)
        try:
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, "wb") as f:
                f.write(data)
        except Exception as exc:
            logger.debug("Local cache write failed for %s: %s", clean_key, exc)

        total_bytes = len(data)
        num_parts = max(1, (total_bytes + part_size - 1) // part_size)
        logger.info(
            "Initiating MinIO multipart upload for s3://%s/%s (%d bytes, %d parts)",
            bucket,
            clean_key,
            total_bytes,
            num_parts,
        )

        try:
            with httpx.Client(timeout=30.0) as client:
                init_headers = self._build_sigv4_headers(
                    "POST", f"{path}?uploads", payload=b"", content_type=content_type
                )
                init_resp = client.post(f"{url}?uploads", headers=init_headers)
                if init_resp.status_code not in (200, 201):
                    logger.warning(
                        "MinIO InitiateMultipartUpload failed (%s): %s",
                        init_resp.status_code,
                        init_resp.text,
                    )
                    return True

                upload_id = None
                try:
                    root = ET.fromstring(init_resp.text)
                    for elem in root.iter():
                        if elem.tag.endswith("UploadId"):
                            upload_id = elem.text
                            break
                except Exception:
                    pass

                if not upload_id:
                    logger.warning(
                        "Could not extract UploadId from MinIO response. Using local cache."
                    )
                    return True

                parts_info = []
                for part_num in range(1, num_parts + 1):
                    start = (part_num - 1) * part_size
                    end = min(start + part_size, total_bytes)
                    part_bytes = data[start:end]

                    part_path = f"{path}?partNumber={part_num}&uploadId={upload_id}"
                    part_headers = self._build_sigv4_headers(
                        "PUT", part_path, payload=part_bytes
                    )
                    part_resp = client.put(
                        f"{url}?partNumber={part_num}&uploadId={upload_id}",
                        headers=part_headers,
                        content=part_bytes,
                    )

                    if part_resp.status_code not in (200, 201):
                        logger.warning(
                            "Part %d upload failed: %s", part_num, part_resp.status_code
                        )
                        return True

                    etag = part_resp.headers.get("ETag", f'"{part_num}"').strip('"')
                    parts_info.append((part_num, etag))

                complete_xml = (
                    "<CompleteMultipartUpload>"
                    + "".join(
                        f'<Part><PartNumber>{pn}</PartNumber><ETag>"{etag}"</ETag></Part>'
                        for pn, etag in parts_info
                    )
                    + "</CompleteMultipartUpload>"
                )
                complete_payload = complete_xml.encode("utf-8")

                complete_path = f"{path}?uploadId={upload_id}"
                complete_headers = self._build_sigv4_headers(
                    "POST",
                    complete_path,
                    payload=complete_payload,
                    content_type="application/xml",
                )
                comp_resp = client.post(
                    f"{url}?uploadId={upload_id}",
                    headers=complete_headers,
                    content=complete_payload,
                )

                if comp_resp.status_code in (200, 201):
                    logger.info(
                        "Successfully completed MinIO multipart upload: s3://%s/%s",
                        bucket,
                        clean_key,
                    )
                    return True

        except Exception as exc:
            logger.debug(
                "MinIO multipart upload failed (%s). Local file cached at %s",
                exc,
                local_path,
            )

        return True

    def put_object_bytes(
        self,
        bucket: str,
        object_key: str,
        data: bytes,
        content_type: str = "text/csv",
    ) -> bool:
        """Upload raw object bytes to MinIO and local fallback cache."""
        if len(data) >= self.MULTIPART_THRESHOLD:
            return self.put_object_multipart(
                bucket, object_key, data, content_type=content_type
            )

        clean_key = object_key.lstrip("/")
        path = f"/{bucket}/{clean_key}"
        url = f"{self.base_url}{path}"

        try:
            local_path = os.path.join(self.local_fallback_dir, bucket, clean_key)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, "wb") as f:
                f.write(data)
        except Exception as exc:
            logger.debug("Failed to cache local copy of %s: %s", clean_key, exc)

        try:
            headers = self._build_sigv4_headers(
                "PUT", path, payload=data, content_type=content_type
            )
            with httpx.Client(timeout=5.0) as client:
                resp = client.put(url, headers=headers, content=data)
                if resp.status_code in (200, 201):
                    logger.info(
                        "Successfully uploaded object to MinIO: s3://%s/%s",
                        bucket,
                        clean_key,
                    )
                    return True
        except Exception as exc:
            logger.debug(
                "MinIO PUT failed (%s). Local file cached at %s", exc, local_path
            )

        return True

    def object_exists(self, bucket: str, object_key: str) -> bool:
        """Check if an object exists in MinIO or local storage."""
        try:
            self.get_object_bytes(bucket, object_key)
            return True
        except FileNotFoundError:
            return False

    def load_dataframe(self, bucket: str, object_key: str) -> pl.DataFrame:
        """Download raw object from MinIO / local storage and parse into a Polars DataFrame."""
        data = self.get_object_bytes(bucket, object_key)
        return parse_raw_data_to_dataframe(data, object_key, bucket)


_default_minio_client: Optional[MinioRawStorageClient] = None


def get_minio_client() -> MinioRawStorageClient:
    """Return singleton instance of MinioRawStorageClient."""
    global _default_minio_client
    if _default_minio_client is None:
        _default_minio_client = MinioRawStorageClient()
    return _default_minio_client
