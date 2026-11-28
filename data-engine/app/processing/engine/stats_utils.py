"""Shared mathematically exact descriptive statistics helpers for EDA and DataProfiler."""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Sequence


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


def _format_bin_edge(val: float) -> str:
    rounded = round(val, 2)
    if rounded == int(rounded):
        return str(int(rounded))
    return f"{rounded:.2f}".rstrip("0").rstrip(".")


def compute_numeric_histogram(
    values: Sequence[float],
    bins: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Compute equal-width histogram buckets for finite numeric values."""
    finite_vals = [float(x) for x in values if x is not None and math.isfinite(float(x))]
    n = len(finite_vals)
    if n == 0:
        return []

    min_v = min(finite_vals)
    max_v = max(finite_vals)

    if bins is None:
        bin_count = 1 if n == 1 else max(5, min(15, math.ceil(math.log2(n)) + 1))
    else:
        bin_count = max(1, min(int(bins), 50))

    if abs(max_v - min_v) < 1e-12 or bin_count == 1:
        r_min = round(min_v, 4)
        r_max = round(max_v, 4)
        lbl = (
            _format_bin_edge(min_v)
            if abs(max_v - min_v) < 1e-12
            else f"{_format_bin_edge(min_v)}-{_format_bin_edge(max_v)}"
        )
        return [
            {
                "bin_start": r_min,
                "bin_end": r_max,
                "label": lbl,
                "count": n,
                "percentage": 100.0,
            }
        ]

    width = (max_v - min_v) / bin_count
    counts = [0] * bin_count
    for x in finite_vals:
        idx = int((x - min_v) / width)
        if idx >= bin_count:
            idx = bin_count - 1
        elif idx < 0:
            idx = 0
        counts[idx] += 1

    buckets: List[Dict[str, Any]] = []
    for i in range(bin_count):
        b_start = min_v + i * width
        b_end = max_v if i == bin_count - 1 else min_v + (i + 1) * width
        cnt = counts[i]
        buckets.append(
            {
                "bin_start": round(b_start, 4),
                "bin_end": round(b_end, 4),
                "label": f"{_format_bin_edge(b_start)}-{_format_bin_edge(b_end)}",
                "count": cnt,
                "percentage": round((cnt / n) * 100.0, 2),
            }
        )
    return buckets
