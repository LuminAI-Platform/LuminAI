"""Exploratory Data Analysis (EDA) and Statistical Analytics Engine for LuminAI.

Computes mathematically sound, type-appropriate analytical statistics:
  - Descriptive statistics (mean, median, mode, variance, std_dev, percentiles)
  - Frequency and value distributions
  - Pearson correlation matrix across numeric features
  - Missingness and duplicate analysis
  - Statistical outlier identification
"""

from __future__ import annotations

import math
from typing import Any, Dict, Optional
import polars as pl

from app.processing.engine.stats_utils import (
    compute_numeric_histogram,
    compute_numeric_summary,
)


class EdaEngine:
    """Computes comprehensive Exploratory Data Analysis summaries over DataFrames."""

    @classmethod
    def generate_eda_report(cls, df: pl.DataFrame) -> Dict[str, Any]:
        """Generates a complete, structured EDA report for a dataset."""
        total_rows = df.height
        total_cols = df.width

        if total_rows == 0:
            return {
                "overview": {"total_rows": 0, "total_columns": total_cols, "duplicate_rows": 0},
                "numeric_statistics": {},
                "categorical_statistics": {},
                "correlation_matrix": {},
                "missingness": {},
            }

        # 1. Dataset Overview
        dup_rows = total_rows - df.unique().height if total_rows > 0 else 0
        total_cells = total_rows * total_cols
        total_nulls = sum(df[c].null_count() for c in df.columns)
        overview = {
            "total_rows": total_rows,
            "total_columns": total_cols,
            "total_cells": total_cells,
            "missing_cells": total_nulls,
            "missing_cells_pct": round((total_nulls / total_cells) * 100.0, 2) if total_cells > 0 else 0.0,
            "duplicate_rows": dup_rows,
            "duplicate_rows_pct": round((dup_rows / total_rows) * 100.0, 2) if total_rows > 0 else 0.0,
            "estimated_memory_bytes": df.estimated_size(),
        }

        # 2. Missingness per column
        missingness = {
            col: {
                "null_count": int(df[col].null_count()),
                "null_pct": round((df[col].null_count() / total_rows) * 100.0, 2),
            }
            for col in df.columns
        }

        # 3. Numeric Statistics & Percentiles
        numeric_cols = [c for c in df.columns if df[c].dtype.is_numeric()]
        numeric_stats: Dict[str, Dict[str, Any]] = {}

        for col in numeric_cols:
            series = df[col].drop_nulls()
            if series.dtype.is_float():
                series = series.drop_nans()
            if series.len() == 0:
                continue

            series_list = series.to_list()
            summary = compute_numeric_summary(series_list)
            if not summary:
                continue

            n = int(summary["count"])
            numeric_stats[col] = {
                "count": n,
                "min": round(float(summary["min"]), 2),
                "max": round(float(summary["max"]), 2),
                "mean": round(float(summary["mean"]), 2),
                "median": round(float(summary["median"]), 2),
                "variance": round(float(summary["variance"]), 2),
                "std_dev": round(float(summary["std_dev"]), 2),
                "percentiles": {
                    "p25": round(float(summary["q1"]), 2),
                    "p50": round(float(summary["median"]), 2),
                    "p75": round(float(summary["q3"]), 2),
                    "p90": round(float(summary["p90"]), 2),
                    "p95": round(float(summary["p95"]), 2),
                },
                "outlier_count": int(summary["outlier_count"]),
                "outlier_pct": round((int(summary["outlier_count"]) / n) * 100.0, 2) if n > 0 else 0.0,
                "histogram": compute_numeric_histogram(series_list),
            }

        # 4. Categorical Statistics
        non_numeric_cols = [c for c in df.columns if not df[c].dtype.is_numeric()]
        cat_stats: Dict[str, Dict[str, Any]] = {}

        for col in non_numeric_cols:
            series = df[col].drop_nulls()
            n = series.len()
            if n == 0:
                continue

            unique_cnt = series.n_unique()
            val_counts = {}
            for v in series.to_list():
                s = str(v)
                val_counts[s] = val_counts.get(s, 0) + 1

            sorted_freq = sorted(val_counts.items(), key=lambda x: x[1], reverse=True)
            top_cats = [
                {
                    "category": cat,
                    "count": cnt,
                    "percentage": round((cnt / n) * 100.0, 2),
                    "pct_of_total": round((cnt / total_rows) * 100.0, 2) if total_rows > 0 else 0.0,
                }
                for cat, cnt in sorted_freq[:8]
            ]
            mode_v = sorted_freq[0][0] if sorted_freq else None
            top_shown = sum(cnt for _, cnt in sorted_freq[:8])

            cat_stats[col] = {
                "count": n,
                "distinct_count": unique_cnt,
                "uniqueness_ratio": round(unique_cnt / n, 4) if n > 0 else 0.0,
                "mode": mode_v,
                "top_categories": top_cats,
                "other_count": max(0, n - top_shown),
            }

        # 5. Correlation Matrix for Numeric Columns (preserve None for undefined zero-variance correlations)
        correlation_matrix: Dict[str, Dict[str, Optional[float]]] = {}
        if len(numeric_cols) >= 2:
            try:
                clean_num_exprs = [
                    pl.col(c).fill_nan(None) if df[c].dtype.is_float() else pl.col(c)
                    for c in numeric_cols
                ]
                corr_df = df.select(clean_num_exprs).corr()
                for c in numeric_cols:
                    correlation_matrix[c] = {}
                    for target_c in numeric_cols:
                        val = corr_df[target_c][corr_df.columns.index(c)]
                        if val is not None and math.isfinite(float(val)):
                            correlation_matrix[c][target_c] = round(float(val), 4)
                        else:
                            correlation_matrix[c][target_c] = None
            except Exception:
                correlation_matrix = {}

        return {
            "overview": overview,
            "missingness": missingness,
            "numeric_statistics": numeric_stats,
            "categorical_statistics": cat_stats,
            "correlation_matrix": correlation_matrix,
        }
