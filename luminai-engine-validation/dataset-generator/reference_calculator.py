"""
Independent Mathematical, Statistical, and Ground-Truth Reference Calculator.

Implements streaming single-pass statistics (Welford / Pebays higher moments +
exact online pairwise covariance/correlation) plus exact quantile/outlier/mode
verification WITHOUT importing or calling any `data-engine/app/` function.

Documented Conventions:
- Variance / StdDev: Sample (ddof=1, Bessel's correction) AND Population (ddof=0) reported explicitly.
- Median: Exact sorted midpoint ((s[n//2 - 1] + s[n//2]) / 2 when even).
- Percentiles / Quartiles (p25, p50, p75, p90, p95): Type-7 linear interpolation
  between adjacent sorted order statistics: lo + (hi - lo) * frac where idx = (n - 1) * q.
- Outliers: Tukey IQR (Q1 - 1.5*IQR, Q3 + 1.5*IQR) AND Z-score |x - mean| / std_sample > 3.0.
- Correlation: Pearson r = C_xy / sqrt(M2_x * M2_y); None when either variable has 0 variance.
- Skewness: Adjusted/sample Fisher-Pearson moment; Excess Kurtosis: m4 / m2^2 - 3.
"""

from __future__ import annotations

import math
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

NULL_SENTINELS_LOWER = frozenset(
    {"", "n/a", "na", "null", "none", "nan", "nat", "-", "--", "?", "nil", "undef", "undefined"}
)


def classify_missing(value: Any) -> str:
    """Distinguish exact missing/null representations independently of engine code."""
    if value is None:
        return "none"
    if isinstance(value, float) and math.isnan(value):
        return "nan"
    if isinstance(value, str):
        if value == "":
            return "empty"
        if value.strip() == "":
            return "whitespace"
        if value.strip().lower() in NULL_SENTINELS_LOWER:
            return "sentinel"
    return "present"


def linear_percentile(sorted_vals: List[float], q: float) -> Optional[float]:
    """Independent linear-interpolated percentile matching Type-7 (R / NumPy default / EdaEngine)."""
    n = len(sorted_vals)
    if n == 0:
        return None
    if n == 1:
        return float(sorted_vals[0])
    pos = (n - 1) * q
    lo = int(math.floor(pos))
    hi = int(math.ceil(pos))
    if lo == hi:
        return float(sorted_vals[lo])
    frac = pos - lo
    return float(sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * frac)


class StreamingNumericStats:
    """Single-pass streaming numeric summary + exact sorted quantiles up to max_exact_buffer."""

    def __init__(self, name: str, max_exact_buffer: int = 250_000) -> None:
        self.name = name
        self.total_rows = 0
        self.none_count = 0
        self.nan_count = 0
        self.empty_count = 0
        self.whitespace_count = 0
        self.sentinel_count = 0
        self.non_numeric_count = 0

        # Pebays / Terriberry online moments for n, mean, M2, M3, M4
        self.n = 0
        self.mean = 0.0
        self.m2 = 0.0
        self.m3 = 0.0
        self.m4 = 0.0
        self.min_val: Optional[float] = None
        self.max_val: Optional[float] = None

        self._max_exact_buffer = max_exact_buffer
        self._values: List[float] = []
        self._buffer_truncated = False
        self._freq: Counter[float] = Counter()

    def add(self, raw_value: Any) -> Optional[float]:
        self.total_rows += 1
        kind = classify_missing(raw_value)
        if kind != "present":
            if kind == "none":
                self.none_count += 1
            elif kind == "nan":
                self.nan_count += 1
            elif kind == "empty":
                self.empty_count += 1
            elif kind == "whitespace":
                self.whitespace_count += 1
            elif kind == "sentinel":
                self.sentinel_count += 1
            return None

        if isinstance(raw_value, bool):
            self.non_numeric_count += 1
            return None

        try:
            x = float(raw_value)
        except (TypeError, ValueError):
            self.non_numeric_count += 1
            return None

        if not math.isfinite(x):
            self.nan_count += 1
            return None

        # Online Pebays recurrence
        n1 = float(self.n)
        self.n += 1
        n = float(self.n)
        delta = x - self.mean
        delta_n = delta / n
        delta_n2 = delta_n * delta_n
        term1 = delta * delta_n * n1
        self.mean += delta_n
        self.m4 += (
            term1 * delta_n2 * (n * n - 3 * n + 3)
            + 6.0 * delta_n2 * self.m2
            - 4.0 * delta_n * self.m3
        )
        self.m3 += term1 * delta_n * (n - 2.0) - 3.0 * delta_n * self.m2
        self.m2 += term1

        if self.min_val is None or x < self.min_val:
            self.min_val = x
        if self.max_val is None or x > self.max_val:
            self.max_val = x

        if len(self._values) < self._max_exact_buffer:
            self._values.append(x)
            if len(self._freq) < 200_000:
                self._freq[x] += 1
        else:
            self._buffer_truncated = True

        return x

    def summary(self) -> Dict[str, Any]:
        missing_total = (
            self.none_count
            + self.nan_count
            + self.empty_count
            + self.whitespace_count
            + self.sentinel_count
        )
        var_sample = (self.m2 / (self.n - 1)) if self.n >= 2 else (0.0 if self.n == 1 else None)
        std_sample = math.sqrt(var_sample) if var_sample is not None else None
        var_pop = (self.m2 / self.n) if self.n >= 1 else None
        std_pop = math.sqrt(var_pop) if var_pop is not None else None

        skewness = None
        excess_kurtosis = None
        if self.n >= 3 and self.m2 > 0:
            skewness = round((math.sqrt(self.n) * self.m3) / (self.m2 ** 1.5), 6)
        if self.n >= 4 and self.m2 > 0:
            excess_kurtosis = round(((self.n * self.m4) / (self.m2 * self.m2)) - 3.0, 6)

        sorted_vals = sorted(self._values)
        median = linear_percentile(sorted_vals, 0.50)
        q1 = linear_percentile(sorted_vals, 0.25)
        q3 = linear_percentile(sorted_vals, 0.75)
        p90 = linear_percentile(sorted_vals, 0.90)
        p95 = linear_percentile(sorted_vals, 0.95)
        iqr = (q3 - q1) if (q1 is not None and q3 is not None) else None

        iqr_outliers = None
        z_outliers = None
        lower_fence = None
        upper_fence = None
        if not self._buffer_truncated and iqr is not None and q1 is not None and q3 is not None:
            lower_fence = round(q1 - 1.5 * iqr, 6)
            upper_fence = round(q3 + 1.5 * iqr, 6)
            iqr_outliers = sum(1 for v in sorted_vals if v < lower_fence or v > upper_fence)
        if not self._buffer_truncated and std_sample and std_sample > 0:
            z_outliers = sum(1 for v in sorted_vals if abs((v - self.mean) / std_sample) > 3.0)

        mode_val = None
        if self._freq:
            mode_val = self._freq.most_common(1)[0][0]

        return {
            "column": self.name,
            "total_rows": self.total_rows,
            "valid_numeric_count": self.n,
            "missing_breakdown": {
                "none": self.none_count,
                "nan": self.nan_count,
                "empty": self.empty_count,
                "whitespace": self.whitespace_count,
                "sentinel": self.sentinel_count,
                "total_missing": missing_total,
            },
            "non_numeric_string_count": self.non_numeric_count,
            "min": round(self.min_val, 6) if self.min_val is not None else None,
            "max": round(self.max_val, 6) if self.max_val is not None else None,
            "range": (
                round(self.max_val - self.min_val, 6)
                if (self.max_val is not None and self.min_val is not None)
                else None
            ),
            "mean": round(self.mean, 6) if self.n > 0 else None,
            "median": round(median, 6) if median is not None else None,
            "mode": round(mode_val, 6) if isinstance(mode_val, float) else mode_val,
            "sample_variance_ddof1": round(var_sample, 6) if var_sample is not None else None,
            "sample_std_ddof1": round(std_sample, 6) if std_sample is not None else None,
            "population_variance_ddof0": round(var_pop, 6) if var_pop is not None else None,
            "population_std_ddof0": round(std_pop, 6) if std_pop is not None else None,
            "skewness_fisher": skewness,
            "excess_kurtosis": excess_kurtosis,
            "quantiles_exact_on_full_data": not self._buffer_truncated,
            "percentiles_linear": {
                "p25_q1": round(q1, 6) if q1 is not None else None,
                "p50_median": round(median, 6) if median is not None else None,
                "p75_q3": round(q3, 6) if q3 is not None else None,
                "p90": round(p90, 6) if p90 is not None else None,
                "p95": round(p95, 6) if p95 is not None else None,
                "iqr": round(iqr, 6) if iqr is not None else None,
            },
            "iqr_lower_fence": lower_fence,
            "iqr_upper_fence": upper_fence,
            "iqr_outlier_count": iqr_outliers,
            "zscore_gt3_outlier_count": z_outliers,
        }


class StreamingBivariateTracker:
    """Computes exact paired Pearson correlation & sample/pop covariance in O(1) memory."""

    def __init__(self, columns: List[str]) -> None:
        self.columns = list(columns)
        self.pairs: Dict[Tuple[str, str], List[float]] = {}
        # State per pair: [n, mean_x, mean_y, m2_x, m2_y, c_xy]
        for i, col_a in enumerate(self.columns):
            for col_b in self.columns[i + 1 :]:
                self.pairs[(col_a, col_b)] = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]

    def add_row(self, numeric_row: Dict[str, Optional[float]]) -> None:
        for (col_a, col_b), st in self.pairs.items():
            x = numeric_row.get(col_a)
            y = numeric_row.get(col_b)
            if x is None or y is None:
                continue
            st[0] += 1.0
            n = st[0]
            dx = x - st[1]
            dy = y - st[2]
            st[1] += dx / n
            st[2] += dy / n
            dx2 = x - st[1]
            dy2 = y - st[2]
            st[3] += dx * dx2
            st[4] += dy * dy2
            st[5] += dx * dy2

    def matrices(self) -> Dict[str, Any]:
        corr: Dict[str, Dict[str, Optional[float]]] = {c: {} for c in self.columns}
        cov_sample: Dict[str, Dict[str, Optional[float]]] = {c: {} for c in self.columns}
        for c in self.columns:
            corr[c][c] = 1.0
            cov_sample[c][c] = None  # Self-variance reported per column summary

        for (col_a, col_b), st in self.pairs.items():
            n, _, _, m2x, m2y, cxy = st
            if n < 2:
                r = None
                cov = None
            else:
                cov = round(cxy / (n - 1.0), 6)
                denom = math.sqrt(m2x * m2y)
                r = round(cxy / denom, 6) if denom > 0 else None
            corr[col_a][col_b] = r
            corr[col_b][col_a] = r
            cov_sample[col_a][col_b] = cov
            cov_sample[col_b][col_a] = cov

        return {
            "conventions": {
                "correlation": "pearson_pairwise_complete",
                "zero_variance_correlation": None,
                "covariance": "sample_ddof1",
            },
            "pearson_correlation": corr,
            "sample_covariance": cov_sample,
        }


class StreamingCategoricalStats:
    """Computes independent categorical frequency counts, mode, and percentages."""

    def __init__(self, name: str, track_unique_limit: int = 200_000) -> None:
        self.name = name
        self.total_rows = 0
        self.missing_count = 0
        self.valid_count = 0
        self.counts: Counter[str] = Counter()
        self._limit = track_unique_limit
        self._overflow = False

    def add(self, raw_value: Any) -> None:
        self.total_rows += 1
        kind = classify_missing(raw_value)
        if kind != "present":
            self.missing_count += 1
            return
        self.valid_count += 1
        sval = str(raw_value)
        if len(self.counts) < self._limit or sval in self.counts:
            self.counts[sval] += 1
        else:
            self._overflow = True

    def summary(self) -> Dict[str, Any]:
        top = []
        for val, cnt in self.counts.most_common(10):
            top.append(
                {
                    "value": val,
                    "count": cnt,
                    "pct_of_valid": round((cnt / self.valid_count) * 100.0, 2) if self.valid_count else 0.0,
                    "pct_of_total": round((cnt / self.total_rows) * 100.0, 2) if self.total_rows else 0.0,
                }
            )
        mode_val = top[0]["value"] if top else None
        return {
            "column": self.name,
            "total_rows": self.total_rows,
            "valid_count": self.valid_count,
            "missing_or_sentinel_count": self.missing_count,
            "distinct_count": len(self.counts),
            "distinct_truncated": self._overflow,
            "mode": mode_val,
            "top_categories": top,
        }


class DomainStatsCollector:
    """Aggregates numeric, bivariate correlation/covariance, and categorical stats in one streaming pass."""

    def __init__(
        self,
        numeric_cols: List[str],
        categorical_cols: List[str],
        max_exact_buffer: int = 250_000,
    ) -> None:
        self.numeric = {c: StreamingNumericStats(c, max_exact_buffer=max_exact_buffer) for c in numeric_cols}
        self.categorical = {c: StreamingCategoricalStats(c) for c in categorical_cols}
        self.bivariate = StreamingBivariateTracker(numeric_cols)
        self.row_count = 0
        self.seen_row_hashes: set[int] = set()
        self.exact_duplicate_rows = 0

    def observe_row(self, row: Dict[str, Any], track_exact_dups: bool = True) -> None:
        self.row_count += 1
        if track_exact_dups and self.row_count <= 300_000:
            key = hash(tuple(sorted((k, str(row.get(k))) for k in row)))
            if key in self.seen_row_hashes:
                self.exact_duplicate_rows += 1
            else:
                self.seen_row_hashes.add(key)

        num_vals: Dict[str, Optional[float]] = {}
        for col, tracker in self.numeric.items():
            num_vals[col] = tracker.add(row.get(col))
        self.bivariate.add_row(num_vals)

        for col, ctracker in self.categorical.items():
            ctracker.add(row.get(col))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_rows": self.row_count,
            "exact_duplicate_rows_observed": self.exact_duplicate_rows,
            "numeric_summaries": {k: v.summary() for k, v in self.numeric.items()},
            "categorical_summaries": {k: v.summary() for k, v in self.categorical.items()},
            "bivariate": self.bivariate.matrices(),
        }
