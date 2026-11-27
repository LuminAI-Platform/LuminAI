"""Shared mathematically exact descriptive statistics helpers for EDA and DataProfiler."""

from __future__ import annotations

import math
from typing import Dict, Sequence


def linear_percentile(sorted_vals: Sequence[float], q: float) -> float:
    """Compute quantile ``q`` in [0.0, 1.0] via NIST/NumPy linear interpolation.

    Assumes ``sorted_vals`` is non-empty and already sorted ascending.
    """
    n = len(sorted_vals)
    if n == 0:
        raise ValueError("Cannot compute percentile of an empty sequence.")
    if n == 1:
        return float(sorted_vals[0])

    pos = max(0.0, min(1.0, float(q))) * (n - 1)
    lo = int(math.floor(pos))
    hi = int(math.ceil(pos))
    frac = pos - lo
    return float(sorted_vals[lo]) * (1.0 - frac) + float(sorted_vals[hi]) * frac


def compute_numeric_summary(values: Sequence[float]) -> Dict[str, float | int]:
    """Compute consistent sample statistics and IQR outlier counts from finite floats."""
    finite_vals = [float(x) for x in values if x is not None and math.isfinite(float(x))]
    n = len(finite_vals)
    if n == 0:
        return {}

    sorted_vals = sorted(finite_vals)
    mean_v = sum(sorted_vals) / n
    variance_v = (
        sum((x - mean_v) ** 2 for x in sorted_vals) / (n - 1)
        if n >= 2
        else 0.0
    )
    std_v = math.sqrt(variance_v)

    min_v = sorted_vals[0]
    max_v = sorted_vals[-1]
    median_v = linear_percentile(sorted_vals, 0.50)
    q1 = linear_percentile(sorted_vals, 0.25)
    q3 = linear_percentile(sorted_vals, 0.75)
    p90 = linear_percentile(sorted_vals, 0.90)
    p95 = linear_percentile(sorted_vals, 0.95)

    iqr = q3 - q1
    lower_bound = q1 - 1.5 * iqr
    upper_bound = q3 + 1.5 * iqr
    outlier_count = sum(1 for x in sorted_vals if x < lower_bound or x > upper_bound)

    return {
        "count": n,
        "mean": mean_v,
        "median": median_v,
        "variance": variance_v,
        "std_dev": std_v,
        "min": min_v,
        "max": max_v,
        "q1": q1,
        "q3": q3,
        "p90": p90,
        "p95": p95,
        "iqr_lower_bound": lower_bound,
        "iqr_upper_bound": upper_bound,
        "outlier_count": outlier_count,
    }
