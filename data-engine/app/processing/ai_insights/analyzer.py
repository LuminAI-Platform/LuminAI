"""Statistical profiling and anomaly detection engine powered by Polars and DuckDB."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
import polars as pl

logger = logging.getLogger(__name__)


class DatasetProfiler:
    """Profiles datasets to extract summary statistics, distributions, and anomalies."""

    def profile_dataframe(
        self,
        df: pl.DataFrame,
        entity_type: str,
        time_field: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Compute statistical profile, value distributions, and anomaly indicators.

        :param df: Polars DataFrame of records to profile.
        :param entity_type: The ontology entity type.
        :param time_field: Optional column name for time trend detection.
        :return: JSON-serializable statistical profile dictionary.
        """
        row_count = df.height
        if row_count == 0:
            return {
                "entity_type": entity_type,
                "row_count": 0,
                "completeness": {},
                "numerical_metrics": {},
                "categorical_distributions": {},
                "anomalies": [],
                "time_trends": {},
            }

        completeness = self._compute_completeness(df)
        numerical_metrics, anomalies = self._compute_numerical_metrics(df)
        categorical_distributions = self._compute_categorical_distributions(df)
        time_trends = self._compute_time_trends(df, time_field) if time_field else {}

        return {
            "entity_type": entity_type,
            "row_count": row_count,
            "column_count": len(df.columns),
            "completeness": completeness,
            "numerical_metrics": numerical_metrics,
            "categorical_distributions": categorical_distributions,
            "anomalies": anomalies,
            "time_trends": time_trends,
        }

    def _compute_completeness(self, df: pl.DataFrame) -> Dict[str, float]:
        """Calculate non-null completeness percentage for each column."""
        total = df.height
        completeness = {}
        for col in df.columns:
            if col in ("id", "rec_id", "tenant_id", "entity_type"):
                continue
            null_count = df[col].null_count()
            valid_pct = round(((total - null_count) / total) * 100.0, 1)
            completeness[col] = valid_pct
        return completeness

    def _compute_numerical_metrics(
        self, df: pl.DataFrame
    ) -> tuple[Dict[str, Dict[str, Any]], List[Dict[str, Any]]]:
        """Calculate min, max, avg, stddev, and detect statistical outliers."""
        metrics: Dict[str, Dict[str, Any]] = {}
        anomalies: List[Dict[str, Any]] = []

        for col, dtype in zip(df.columns, df.dtypes):
            if col in ("id", "rec_id", "tenant_id") or not dtype.is_numeric():
                continue

            series = df[col].drop_nulls()
            if series.len() < 2:
                continue

            try:
                col_min = float(series.min())
                col_max = float(series.max())
                col_mean = float(series.mean())
                col_std = float(series.std()) if series.std() is not None else 0.0

                metrics[col] = {
                    "min": round(col_min, 2),
                    "max": round(col_max, 2),
                    "mean": round(col_mean, 2),
                    "stddev": round(col_std, 2),
                }

                # Anomaly detection using Tukey IQR fences (Q3 + 1.5*IQR) and Z-score
                q25 = float(series.quantile(0.25)) if series.len() >= 4 else col_min
                q75 = float(series.quantile(0.75)) if series.len() >= 4 else col_max
                iqr = q75 - q25

                upper_fence = (
                    q75 + (1.5 * iqr) if iqr > 0 else (col_mean + (2.0 * col_std))
                )
                lower_fence = (
                    q25 - (1.5 * iqr) if iqr > 0 else (col_mean - (2.0 * col_std))
                )

                outliers_high = series.filter(series > upper_fence)
                outliers_low = series.filter(series < lower_fence)
                outlier_count = outliers_high.len() + outliers_low.len()

                if outlier_count > 0:
                    anomalies.append(
                        {
                            "column": col,
                            "type": "outlier_iqr",
                            "outlier_count": outlier_count,
                            "upper_bound": round(upper_fence, 2),
                            "lower_bound": round(lower_fence, 2),
                            "max_observed": round(col_max, 2),
                            "severity": (
                                "warning" if outlier_count < 10 else "critical"
                            ),
                        }
                    )
            except Exception as exc:
                logger.debug("Failed numerical metric compute on %s: %s", col, exc)

        return metrics, anomalies

    def _compute_categorical_distributions(
        self, df: pl.DataFrame
    ) -> Dict[str, Dict[str, Any]]:
        """Identify top 5 frequent categories and concentration for string columns."""
        distributions: Dict[str, Dict[str, Any]] = {}
        total = df.height

        for col, dtype in zip(df.columns, df.dtypes):
            if col in ("id", "rec_id", "tenant_id", "entity_type"):
                continue
            if dtype != pl.Utf8 and dtype != pl.String:
                continue

            series = df[col].drop_nulls()
            if series.len() == 0:
                continue

            # Limit cardinality to avoid explosion
            unique_count = series.n_unique()
            if unique_count > 100:
                distributions[col] = {
                    "high_cardinality": True,
                    "unique_values": unique_count,
                }
                continue

            value_counts = (
                series.value_counts(sort=True).head(5).to_dict(as_series=False)
            )
            top_values = []
            values_list = value_counts.get(col, [])
            counts_list = value_counts.get("count", [])

            dominant_pct = 0.0
            for idx, val in enumerate(values_list):
                cnt = counts_list[idx]
                pct = round((cnt / total) * 100.0, 1)
                if idx == 0:
                    dominant_pct = pct
                top_values.append({"value": str(val), "count": cnt, "pct": pct})

            distributions[col] = {
                "unique_values": unique_count,
                "top_values": top_values,
                "dominant_pct": dominant_pct,
            }

        return distributions

    def _compute_time_trends(self, df: pl.DataFrame, time_field: str) -> Dict[str, Any]:
        """Compute chronological record velocity trends if timestamp column exists."""
        if time_field not in df.columns:
            return {}

        try:
            series = df[time_field].drop_nulls()
            if series.len() < 2:
                return {}

            return {
                "time_field": time_field,
                "earliest": str(series.min()),
                "latest": str(series.max()),
                "active_span_records": series.len(),
            }
        except Exception as exc:
            logger.debug("Could not compute time trends on %s: %s", time_field, exc)
            return {}
