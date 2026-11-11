"""AWS SigV4 authentication helpers for MinIO and S3-compatible storage."""

from __future__ import annotations

import hashlib
import hmac
import urllib.parse
from datetime import datetime, timezone
from typing import Optional


def _sign(key: bytes, msg: str) -> bytes:
    """Compute HMAC-SHA256 signature."""
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def get_signature_key(
    key: str, date_stamp: str, region_name: str, service_name: str
) -> bytes:
    """Generate derived AWS SigV4 signing key."""
    k_date = _sign(("AWS4" + key).encode("utf-8"), date_stamp)
    k_region = _sign(k_date, region_name)
    k_service = _sign(k_region, service_name)
    k_signing = _sign(k_service, "aws4_request")
    return k_signing


def build_sigv4_headers(
    host_header: str,
    access_key: str,
    secret_key: str,
    region: str,
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
        "host": host_header,
        "x-amz-date": amz_date,
        "x-amz-content-sha256": payload_hash,
    }
    if content_type:
        headers_to_sign["content-type"] = content_type

    signed_headers = ";".join(sorted(headers_to_sign.keys()))
    canonical_headers = "".join(
        f"{k}:{headers_to_sign[k]}\n" for k in sorted(headers_to_sign.keys())
    )

    encoded_path = urllib.parse.quote(path, safe="/-_.~")
    canonical_request = (
        f"{method}\n"
        f"{encoded_path}\n"
        f"\n"
        f"{canonical_headers}\n"
        f"{signed_headers}\n"
        f"{payload_hash}"
    )

    algorithm = "AWS4-HMAC-SHA256"
    credential_scope = f"{date_stamp}/{region}/s3/aws4_request"
    string_to_sign = (
        f"{algorithm}\n"
        f"{amz_date}\n"
        f"{credential_scope}\n"
        f"{hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}"
    )

    signing_key = get_signature_key(secret_key, date_stamp, region, "s3")
    signature = hmac.new(
        signing_key, string_to_sign.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    auth_header = (
        f"{algorithm} "
        f"Credential={access_key}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, "
        f"Signature={signature}"
    )

    final_headers = {
        "Host": host_header,
        "x-amz-date": amz_date,
        "x-amz-content-sha256": payload_hash,
        "Authorization": auth_header,
    }
    if content_type:
        final_headers["Content-Type"] = content_type

    return final_headers
