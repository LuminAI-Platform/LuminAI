"""Shared pytest fixtures preventing singleton state leakage across test modules."""

import pytest

from app.rate_limit import reset_rate_limits


@pytest.fixture(autouse=True)
def isolate_rate_limiter_per_test():
    """Reset the shared in-memory sliding-window rate limiter before and after every test.

    Prevents fast CI runs (<60s total across 490+ tests) from accumulating prior
    modules' ``ip:testclient:pipeline`` counts into subsequent test modules such as
    ``tests/test_auth.py``. Individual rate-limit tests still test window throttling
    within a single test function.
    """
    reset_rate_limits()
    yield
    reset_rate_limits()
