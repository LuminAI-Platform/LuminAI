"""Rate limiting middleware and sliding-window request throttling.

Provides:
1. Thread-safe sliding-window rate limiting per IP address or tenant identifier.
2. Distinct rate tiers for general endpoints vs high-compute pipeline triggering endpoints.
3. Path whitelisting for health checks, Prometheus metrics, and OpenAPI schema documentation.
4. Compliant HTTP 429 Too Many Requests responses with Retry-After and X-RateLimit-* headers.
5. In-memory window management with automatic stale entry pruning and optional Redis support.
"""

from __future__ import annotations

from collections import deque
from collections.abc import Callable
import logging
import threading
import time
from typing import Any

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.config import get_settings

logger = logging.getLogger("data-engine.rate-limit")


class SlidingWindowRateLimiter:
    """Thread-safe in-memory sliding window rate limiter."""

    def __init__(self, window_seconds: float = 60.0):
        self.window_seconds = window_seconds
        self._lock = threading.Lock()
        self._buckets: dict[str, deque[float]] = {}
        self._last_prune_time = time.time()

    def check_and_record(
        self,
        key: str,
        limit: int,
    ) -> tuple[bool, int, float]:
        """Check if request is allowed under the rate limit and record its timestamp.

        Returns:
            tuple of (allowed: bool, remaining: int, retry_after_seconds: float)
        """
        now = time.time()
        window_start = now - self.window_seconds

        with self._lock:
            # Periodic pruning of expired buckets every 120 seconds
            if now - self._last_prune_time > 120.0:
                self._prune_stale(now)
                self._last_prune_time = now

            if key not in self._buckets:
                self._buckets[key] = deque()

            bucket = self._buckets[key]

            # Evict timestamps outside the active sliding window
            while bucket and bucket[0] < window_start:
                bucket.popleft()

            current_count = len(bucket)

            if current_count >= limit:
                # Rate limit exceeded: compute how long until the oldest call rolls out
                oldest_timestamp = bucket[0]
                retry_after = max(1.0, (oldest_timestamp + self.window_seconds) - now)
                return False, 0, retry_after

            # Allowed: record current timestamp
            bucket.append(now)
            remaining = max(0, limit - (current_count + 1))
            return True, remaining, 0.0

    def _prune_stale(self, now: float) -> None:
        """Remove empty or outdated buckets to prevent memory accumulation."""
        window_start = now - self.window_seconds
        stale_keys = [
            k for k, timestamps in self._buckets.items()
            if not timestamps or timestamps[-1] < window_start
        ]
        for k in stale_keys:
            del self._buckets[k]

    def reset(self) -> None:
        """Clear all active buckets (useful for unit testing)."""
        with self._lock:
            self._buckets.clear()


# Global limiter instance
_limiter = SlidingWindowRateLimiter()


def get_rate_limiter() -> SlidingWindowRateLimiter:
    """Return the global rate limiter instance."""
    return _limiter


def reset_rate_limits() -> None:
    """Reset rate limiter state (used by test suites)."""
    _limiter.reset()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware enforcing sliding-window rate limits."""

    EXEMPT_PATHS = {
        "/health",
        "/metrics",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/favicon.ico",
    }

    PIPELINE_PATH_PREFIXES = (
        "/process/trigger",
        "/process/er/trigger",
        "/process/reconciliation",
    )

    def __init__(self, app: Any, limiter: SlidingWindowRateLimiter | None = None):
        super().__init__(app)
        self.limiter = limiter or _limiter

    async def dispatch(self, request: Request, call_next: Callable[[Request], Any]) -> Response:
        settings = get_settings()

        # 1. Skip if rate limiting is globally disabled
        if not settings.rate_limit_enabled:
            return await call_next(request)

        # 2. Skip CORS pre-flight OPTIONS requests
        if request.method.upper() == "OPTIONS":
            return await call_next(request)

        path = request.url.path

        # 3. Skip exempt operational endpoints
        if path in self.EXEMPT_PATHS or any(path.startswith(p) for p in ("/docs", "/redoc", "/metrics")):
            return await call_next(request)

        # 4. Resolve client identifier (Tenant ID > X-Forwarded-For > Client IP)
        client_ip = request.client.host if request.client else "unknown"
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()

        tenant_id = request.headers.get("X-Tenant-ID")
        client_key = f"tenant:{tenant_id}" if tenant_id else f"ip:{client_ip}"

        # 5. Determine rate tier based on path
        is_pipeline = any(path.startswith(prefix) for prefix in self.PIPELINE_PATH_PREFIXES)
        if is_pipeline:
            limit = settings.rate_limit_pipeline_per_minute
            bucket_key = f"{client_key}:pipeline"
        else:
            limit = settings.rate_limit_default_per_minute
            bucket_key = f"{client_key}:general"

        # 6. Evaluate rate limit
        allowed, remaining, retry_after = self.limiter.check_and_record(bucket_key, limit)

        reset_epoch = int(time.time() + (retry_after if not allowed else 60.0))

        if not allowed:
            retry_int = int(retry_after + 0.99)
            logger.warning(
                "Rate limit exceeded for %s on %s (limit: %d/min, retry in %ds)",
                bucket_key,
                path,
                limit,
                retry_int,
            )
            return JSONResponse(
                status_code=429,
                content={
                    "detail": f"Rate limit exceeded. Try again in {retry_int} seconds.",
                    "retry_after": retry_int,
                },
                headers={
                    "Retry-After": str(retry_int),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset_epoch),
                },
            )

        # 7. Execute downstream request and attach rate limit headers
        response: Response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_epoch)

        return response
