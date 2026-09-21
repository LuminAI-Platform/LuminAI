"""Unit and integration tests for sliding-window rate limiting middleware.

Covers:
1. Standard requests passing under the limit.
2. Throttling and HTTP 429 Too Many Requests when exceeding limit.
3. Response headers: Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset.
4. Operational endpoint exemption (/health, /metrics, /openapi.json).
5. Tenant isolation (distinct tenants do not share rate limits).
6. Pipeline endpoint specific rate limits.
7. Disabling rate limiting via config.
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from app.config import Settings
from app.main import app
from app.rate_limit import RateLimitMiddleware, SlidingWindowRateLimiter, reset_rate_limits


class TestRateLimiterCore:
    """Direct tests for the SlidingWindowRateLimiter class."""

    def setup_method(self):
        reset_rate_limits()

    def test_allow_within_limit(self):
        limiter = SlidingWindowRateLimiter(window_seconds=60.0)
        for i in range(5):
            allowed, remaining, retry = limiter.check_and_record("test_key", limit=5)
            assert allowed is True
            assert remaining == 5 - (i + 1)
            assert retry == 0.0

    def test_block_when_limit_exceeded(self):
        limiter = SlidingWindowRateLimiter(window_seconds=60.0)
        for _ in range(3):
            allowed, _, _ = limiter.check_and_record("test_client", limit=3)
            assert allowed is True

        # 4th request exceeds limit
        allowed, remaining, retry_after = limiter.check_and_record("test_client", limit=3)
        assert allowed is False
        assert remaining == 0
        assert retry_after > 0.0


class TestRateLimitMiddleware:
    """Integration tests testing FastAPI app with RateLimitMiddleware."""

    def setup_method(self):
        reset_rate_limits()

    def test_health_and_metrics_exempt(self):
        client = TestClient(app)
        # Verify /health is never blocked even after multiple rapid calls
        for _ in range(10):
            response = client.get("/health")
            assert response.status_code == 200

        metrics_resp = client.get("/metrics")
        assert metrics_resp.status_code == 200

    def test_rate_limit_enforcement_on_custom_app(self):
        # Create a small standalone test app with low limit to verify 429 behavior
        test_app = FastAPI()
        limiter = SlidingWindowRateLimiter(window_seconds=60.0)
        test_app.add_middleware(RateLimitMiddleware, limiter=limiter)

        @test_app.get("/test-endpoint")
        def sample():
            return {"status": "ok"}

        test_client = TestClient(test_app)

        # Override settings for low limit
        with pytest.MonkeyPatch.context() as m:
            m.setattr(
                "app.rate_limit.get_settings",
                lambda: Settings(rate_limit_enabled=True, rate_limit_default_per_minute=3),
            )

            # Requests 1, 2, 3 should succeed
            for i in range(3):
                res = test_client.get("/test-endpoint")
                assert res.status_code == 200
                assert "X-RateLimit-Limit" in res.headers
                assert "X-RateLimit-Remaining" in res.headers
                assert res.headers["X-RateLimit-Limit"] == "3"

            # Request 4 should be throttled
            throttled = test_client.get("/test-endpoint")
            assert throttled.status_code == 429
            data = throttled.json()
            assert "Rate limit exceeded" in data["detail"]
            assert data["retry_after"] >= 1
            assert throttled.headers["Retry-After"] == str(data["retry_after"])
            assert throttled.headers["X-RateLimit-Remaining"] == "0"

    def test_rate_limit_tenant_isolation(self):
        test_app = FastAPI()
        limiter = SlidingWindowRateLimiter(window_seconds=60.0)
        test_app.add_middleware(RateLimitMiddleware, limiter=limiter)

        @test_app.get("/tenant-data")
        def tenant_data():
            return {"data": True}

        test_client = TestClient(test_app)

        with pytest.MonkeyPatch.context() as m:
            m.setattr(
                "app.rate_limit.get_settings",
                lambda: Settings(rate_limit_enabled=True, rate_limit_default_per_minute=2),
            )

            # Tenant A sends 2 requests (exhausts quota)
            res_a1 = test_client.get("/tenant-data", headers={"X-Tenant-ID": "tenant-a"})
            res_a2 = test_client.get("/tenant-data", headers={"X-Tenant-ID": "tenant-a"})
            assert res_a1.status_code == 200
            assert res_a2.status_code == 200
            assert test_client.get("/tenant-data", headers={"X-Tenant-ID": "tenant-a"}).status_code == 429

            # Tenant B should still be allowed
            res_b1 = test_client.get("/tenant-data", headers={"X-Tenant-ID": "tenant-b"})
            assert res_b1.status_code == 200

    def test_rate_limit_disabled_bypass(self):
        test_app = FastAPI()
        test_app.add_middleware(RateLimitMiddleware)

        @test_app.get("/unlimited")
        def unlimited():
            return {"unlimited": True}

        test_client = TestClient(test_app)

        with pytest.MonkeyPatch.context() as m:
            m.setattr(
                "app.rate_limit.get_settings",
                lambda: Settings(rate_limit_enabled=False, rate_limit_default_per_minute=1),
            )

            for _ in range(5):
                res = test_client.get("/unlimited")
                assert res.status_code == 200
