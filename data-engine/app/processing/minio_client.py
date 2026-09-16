"""MinIO and S3-compatible raw object storage client.

Provides authenticated object retrieval (AWS SigV4), multi-format parsing
(CSV, Parquet, JSON, NDJSON, Excel) into Polars DataFrames, and transparent
local filesystem fallback for development and testing.
"""

from __future__ import annotations

import hashlib
import hmac
import io
import logging
import os
import urllib.parse
from datetime import datetime, timezone
from typing import Optional

import httpx
import polars as pl

from app.config import get_settings

logger = logging.getLogger(__name__)


def _sign(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def get_signature_key(key: str, date_stamp: str, region_name: str, service_name: str) -> bytes:
    k_date = _sign(("AWS4" + key).encode("utf-8"), date_stamp)
    k_region = _sign(k_date, region_name)
    k_service = _sign(k_region, service_name)
    k_signing = _sign(k_service, "aws4_request")
    return k_signing


class MinioRawStorageClient:
    """Client for reading and writing raw files in MinIO / S3 object storage."""

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
        endpoint_clean = self.endpoint.replace("http://", "").replace("https://", "").rstrip("/")
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
        now = datetime.now(timezone.utc)
        amz_date = now.strftime("%Y%m%dT%H%M%SZ")
        date_stamp = now.strftime("%Y%m%d")

        payload_hash = hashlib.sha256(payload).hexdigest()

        headers_to_sign = {
            "host": self.host_header,
            "x-amz-date": amz_date,
            "x-amz-content-sha256": payload_hash,
        }
        if content_type:
            headers_to_sign["content-type"] = content_type

        signed_headers = ";".join(sorted(headers_to_sign.keys()))
        canonical_headers = "".join(f"{k}:{headers_to_sign[k]}\n" for k in sorted(headers_to_sign.keys()))

        # Clean canonical URI
        encoded_path = urllib.parse.quote(path, safe="/-_.~")
        canonical_request = (
            f"{method.upper()}\n"
            f"{encoded_path}\n"
            f"\n"
            f"{canonical_headers}\n"
            f"{signed_headers}\n"
            f"{payload_hash}"
        )

        credential_scope = f"{date_stamp}/{self.region}/s3/aws4_request"
        string_to_sign = (
            f"AWS4-HMAC-SHA256\n"
            f"{amz_date}\n"
            f"{credential_scope}\n"
            f"{hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}"
        )

        signing_key = get_signature_key(self.secret_key, date_stamp, self.region, "s3")
        signature = hmac.new(signing_key, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()

        authorization_header = (
            f"AWS4-HMAC-SHA256 "
            f"Credential={self.access_key}/{credential_scope}, "
            f"SignedHeaders={signed_headers}, "
            f"Signature={signature}"
        )

        final_headers = {
            "Host": self.host_header,
            "x-amz-date": amz_date,
            "x-amz-content-sha256": payload_hash,
            "Authorization": authorization_header,
        }
        if content_type:
            final_headers["Content-Type"] = content_type

        return final_headers

    def get_object_bytes(self, bucket: str, object_key: str) -> bytes:
        """Fetch raw object bytes from MinIO or fallback local storage."""
        clean_key = object_key.lstrip("/")
        path = f"/{bucket}/{clean_key}"
        url = f"{self.base_url}{path}"

        # 1. Attempt MinIO HTTP request
        try:
            headers = self._build_sigv4_headers("GET", path)
            with httpx.Client(timeout=5.0) as client:
                resp = client.get(url, headers=headers)
                if resp.status_code == 200:
                    logger.debug("Successfully fetched %d bytes from MinIO: s3://%s/%s", len(resp.content), bucket, clean_key)
                    return resp.content
                elif resp.status_code != 404:
                    logger.debug("MinIO returned status %d for %s", resp.status_code, url)
        except Exception as exc:
            logger.debug("Could not reach MinIO at %s (%s). Checking local storage fallback.", url, exc)

        # 2. Check local storage fallbacks
        candidates = [
            os.path.join(self.local_fallback_dir, bucket, clean_key),
            os.path.join(self.local_fallback_dir, clean_key),
            clean_key,
        ]

        for cand in candidates:
            if os.path.isfile(cand):
                logger.debug("Found local raw file at: %s", cand)
                with open(cand, "rb") as f:
                    return f.read()

        raise FileNotFoundError(
            f"Raw object '{clean_key}' was not found in MinIO (bucket: {bucket}) or local fallback paths: {candidates}"
        )

    def put_object_bytes(
        self,
        bucket: str,
        object_key: str,
        data: bytes,
        content_type: str = "text/csv",
    ) -> bool:
        """Upload raw object bytes to MinIO and local fallback cache."""
        clean_key = object_key.lstrip("/")
        path = f"/{bucket}/{clean_key}"
        url = f"{self.base_url}{path}"

        # 1. Save to local fallback cache
        try:
            local_path = os.path.join(self.local_fallback_dir, bucket, clean_key)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, "wb") as f:
                f.write(data)
        except Exception as exc:
            logger.debug("Failed to cache local copy of %s: %s", clean_key, exc)

        # 2. Try MinIO HTTP PUT
        try:
            headers = self._build_sigv4_headers("PUT", path, payload=data, content_type=content_type)
            with httpx.Client(timeout=5.0) as client:
                resp = client.put(url, headers=headers, content=data)
                if resp.status_code in (200, 201):
                    logger.info("Successfully uploaded object to MinIO: s3://%s/%s", bucket, clean_key)
                    return True
        except Exception as exc:
            logger.debug("MinIO PUT failed (%s). Local file cached at %s", exc, local_path)

        return True

    def object_exists(self, bucket: str, object_key: str) -> bool:
        """Check if an object exists in MinIO or local storage."""
        try:
            self.get_object_bytes(bucket, object_key)
            return True
        except FileNotFoundError:
            return False

    def load_dataframe(self, bucket: str, object_key: str) -> pl.DataFrame:
        """Download raw object from MinIO / local storage and parse into a Polars DataFrame.

        Supports:
          - CSV / TSV (.csv, .tsv, .txt)
          - Parquet (.parquet)
          - JSON / NDJSON (.json, .ndjson, .jsonl)
          - Excel (.xlsx, .xls)
        """
        data = self.get_object_bytes(bucket, object_key)
        ext = os.path.splitext(object_key)[1].lower()

        df: pl.DataFrame
        bio = io.BytesIO(data)

        if ext in (".parquet", ".pq"):
            df = pl.read_parquet(bio)
        elif ext in (".json", ".jsonl", ".ndjson"):
            try:
                df = pl.read_json(bio)
            except Exception:
                bio.seek(0)
                df = pl.read_ndjson(bio)
        elif ext in (".xlsx", ".xls"):
            df = pl.read_excel(bio)
        else:
            # Default to CSV parser
            separator = "\t" if ext == ".tsv" else ","
            df = pl.read_csv(
                bio,
                separator=separator,
                infer_schema_length=10000,
                ignore_errors=True,
                truncate_ragged_lines=True,
            )

        # Clean column names (strip whitespace)
        clean_cols = [c.strip() for c in df.columns]
        df = df.rename(dict(zip(df.columns, clean_cols)))

        # Ensure 'id' column exists for downstream pipelines
        cols_lower = [c.lower() for c in df.columns]
        if "id" not in cols_lower and "rec_id" not in cols_lower:
            # Generate deterministic record ID
            record_ids = [f"rec-{i+1:04d}" for i in range(df.height)]
            df = df.with_columns(pl.Series("id", record_ids))

        logger.info(
            "Parsed %d rows from s3://%s/%s (format: %s, cols: %s)",
            df.height,
            bucket,
            object_key,
            ext or "csv",
            df.columns,
        )
        return df


_default_minio_client: Optional[MinioRawStorageClient] = None


def get_minio_client() -> MinioRawStorageClient:
    """Return singleton instance of MinioRawStorageClient."""
    global _default_minio_client
    if _default_minio_client is None:
        _default_minio_client = MinioRawStorageClient()
    return _default_minio_client
