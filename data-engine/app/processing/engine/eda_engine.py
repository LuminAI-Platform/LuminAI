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
from typing import Any, Dict, List, Optional
import numpy as np
import polars as pl


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
            if series.len() == 0:
                continue

            nums = series.to_list()
            n = len(nums)
            mean_v = float(series.mean())
            std_v = float(series.std()) if series.std() is not None else 0.0
            sorted_nums = sorted(nums)
            median_v = float(sorted_nums[n // 2])
            min_v = float(sorted_nums[0])
            max_v = float(sorted_nums[-1])

            # Percentiles
            p25 = float(sorted_nums[int(n * 0.25)]) if n >= 4 else min_v
            p75 = float(sorted_nums[int(n * 0.75)]) if n >= 4 else max_v
            p90 = float(sorted_nums[int(n * 0.90)]) if n >= 10 else max_v
            p95 = float(sorted_nums[int(n * 0.95)]) if n >= 20 else max_v

            # Outliers (IQR)
            iqr = p75 - p25
            outliers = [x for x in sorted_nums if x < (p25 - 1.5 * iqr) or x > (p75 + 1.5 * iqr)]

            numeric_stats[col] = {
                "count": n,
                "min": round(min_v, 2),
                "max": round(max_v, 2),
                "mean": round(mean_v, 2),
                "median": round(median_v, 2),
                "variance": round(std_v ** 2, 2),
                "std_dev": round(std_v, 2),
                "percentiles": {
                    "p25": round(p25, 2),
                    "p50": round(median_v, 2),
                    "p75": round(p75, 2),
                    "p90": round(p90, 2),
                    "p95": round(p95, 2),
                },
                "outlier_count": len(outliers),
                "outlier_pct": round((len(outliers) / n) * 100.0, 2) if n > 0 else 0.0,
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
                {"category": cat, "count": cnt, "percentage": round((cnt / total_rows) * 100.0, 2)}
                for cat, cnt in sorted_freq[:8]
            ]
            mode_v = sorted_freq[0][0] if sorted_freq else None

            cat_stats[col] = {
                "count": n,
                "distinct_count": unique_cnt,
                "uniqueness_ratio": round(unique_cnt / total_rows, 4) if total_rows > 0 else 0.0,
                "mode": mode_v,
                "top_categories": top_cats,
            }

        # 5. Correlation Matrix for Numeric Columns
        correlation_matrix: Dict[str, Dict[str, float]] = {}
        if len(numeric_cols) >= 2:
            try:
                corr_df = df.select(numeric_cols).corr()
                for c in numeric_cols:
                    correlation_matrix[c] = {}
                    for target_c in numeric_cols:
                        val = corr_df[target_c][corr_df.columns.index(c)]
                        correlation_matrix[c][target_c] = round(float(val), 4) if val is not None and not math.isnan(val) else 0.0
            except Exception:
                correlation_matrix = {}

        return {
            "overview": overview,
            "missingness": missingness,
            "numeric_statistics": numeric_stats,
            "categorical_statistics": cat_stats,
            "correlation_matrix": correlation_matrix,
        }
