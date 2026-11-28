"""Automated comprehensive data profiling engine for LuminAI.

Profiles datasets before and after cleaning to evaluate:
  - Inferred vs actual types
  - Null counts, sentinel missing values, and missing percentages
  - Cardinality and unique vs duplicate value analysis
  - Invalid and malformed values
  - Formatting inconsistencies
  - Outlier detection (Interquartile Range IQR for numerical distributions)
  - Encoding issues and mojibake counts
  - Schema violations
  - Before-and-after delta comparative reporting
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional

import polars as pl

from app.processing.engine.date_cleaner import DateCleaner
from app.processing.engine.stats_utils import (
    compute_numeric_histogram,
    compute_numeric_summary,
)
from app.processing.engine.text_cleaner import TextCleaner
from app.processing.engine.type_inference import InferredType, TypeInferenceEngine


@dataclass
class ColumnProfile:
    """Detailed profile metrics for a single column."""
    column_name: str
    total_count: int
    inferred_type: str
    null_count: int
    null_percentage: float
    unique_count: int
    cardinality_ratio: float
    duplicate_count: int
    invalid_count: int
    invalid_percentage: float
    inconsistent_format_count: int
    mojibake_count: int
    outlier_count: int
    min_value: Optional[Any] = None
    max_value: Optional[Any] = None
    mean: Optional[float] = None
    median: Optional[float] = None
    std_dev: Optional[float] = None
    q1: Optional[float] = None
    q3: Optional[float] = None
    sample_invalids: List[Any] = field(default_factory=list)
    sample_values: List[Any] = field(default_factory=list)
    most_frequent_values: List[Dict[str, Any]] = field(default_factory=list)
    pattern_distribution: Dict[str, int] = field(default_factory=dict)
    histogram: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class DatasetProfileReport:
    """Complete profiling report for a dataset at a point in time."""
    stage: str  # "BEFORE_CLEANING" or "AFTER_CLEANING"
    total_rows: int
    total_columns: int
    columns: Dict[str, ColumnProfile] = field(default_factory=dict)
    total_missing_values: int = 0
    duplicate_row_count: int = 0
    valid_record_count: int = 0
    invalid_record_count: int = 0
    estimated_memory_bytes: int = 0
    dataset_size_bytes: int = 0
    schema_info: Dict[str, str] = field(default_factory=dict)
    overall_completeness: float = 0.0
    overall_validity: float = 0.0
    critical_issues_count: int = 0
    anomalies: List[str] = field(default_factory=list)
    quality_issues: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert report to dictionary format for JSON serialization."""
        return {
            "stage": self.stage,
            "total_rows": self.total_rows,
            "total_columns": self.total_columns,
            "total_missing_values": self.total_missing_values,
            "duplicate_row_count": self.duplicate_row_count,
            "valid_record_count": self.valid_record_count,
            "invalid_record_count": self.invalid_record_count,
            "estimated_memory_bytes": self.estimated_memory_bytes,
            "dataset_size_bytes": self.dataset_size_bytes,
            "schema_info": self.schema_info,
            "overall_completeness": self.overall_completeness,
            "overall_validity": self.overall_validity,
            "critical_issues_count": self.critical_issues_count,
            "anomalies": self.anomalies,
            "quality_issues": self.quality_issues,
            "columns": {k: asdict(v) for k, v in self.columns.items()},
        }


@dataclass
class ProfilingDeltaReport:
    """Comparative report highlighting improvements and fixes achieved by cleaning."""
    rows_processed: int
    rows_valid: int
    rows_quarantined: int
    initial_null_count: int
    resolved_null_count: int
    invalid_dates_detected: int
    invalid_dates_flagged: int
    mojibake_encoding_fixed: int
    duplicates_detected: int
    outliers_identified: int
    completeness_delta: float
    validity_delta: float
    summary: str
    column_deltas: Dict[str, Dict[str, Any]] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class DataProfiler:
    """Engine for comprehensive dataset profiling and delta comparison."""

    def __init__(self):
        self.type_engine = TypeInferenceEngine()

    def profile_dataset(
        self,
        df: pl.DataFrame,
        stage: str = "BEFORE_CLEANING",
    ) -> DatasetProfileReport:
        """Computes a deep profiling report across all columns in a dataset."""
        total_rows = df.height
        total_cols = df.width

        if total_rows == 0:
            return DatasetProfileReport(
                stage=stage,
                total_rows=0,
                total_columns=total_cols,
                columns={},
                overall_completeness=100.0,
                overall_validity=100.0,
            )

        col_profiles: Dict[str, ColumnProfile] = {}
        total_fields = total_rows * total_cols
        total_missing = 0
        total_invalids = 0
        invalid_row_indices: set[int] = set()
        anomalies: List[str] = []
        quality_issues: List[Dict[str, Any]] = []

        for col_name in df.columns:
            raw_vals = df[col_name].to_list()
            type_profile = self.type_engine.profile_column(col_name, raw_vals)
            inferred_type = type_profile.predominant_type

            # Null analysis (accounting for null sentinels)
            null_count = sum(1 for v in raw_vals if self.type_engine.is_null_value(v))
            total_missing += null_count
            null_pct = round((null_count / total_rows) * 100.0, 2)

            # Unique & duplicates analysis
            non_null_vals = [v for v in raw_vals if not self.type_engine.is_null_value(v)]
            unique_count = len(set(str(v) for v in non_null_vals))
            dup_count = len(non_null_vals) - unique_count
            cardinality = round(unique_count / total_rows, 4) if total_rows > 0 else 0.0

            # Invalid, inconsistent format, mojibake, and outlier analysis
            invalid_count = 0
            inconsistent_count = 0
            mojibake_count = 0
            sample_invalids = []
            numeric_vals: List[float] = []

            is_date_col = (
                inferred_type in (InferredType.DATE, InferredType.DATETIME)
                or any(k in col_name.lower() for k in ("date", "dob", "birth", "joined", "timestamp", "created"))
            )

            for row_idx, v in enumerate(raw_vals):
                if self.type_engine.is_null_value(v):
                    continue
                s_val = str(v)
                row_invalid = False
                # Check mojibake
                _, did_mojibake = TextCleaner.repair_mojibake(s_val)
                if did_mojibake:
                    mojibake_count += 1

                # Check date validity if date column
                if is_date_col:
                    dres = DateCleaner.clean_date(v, field_name=col_name)
                    if not dres.is_valid:
                        row_invalid = True
                        invalid_count += 1
                        if len(sample_invalids) < 5 and v not in sample_invalids:
                            sample_invalids.append(v)
                    elif dres.is_ambiguous:
                        inconsistent_count += 1

                # Collect numeric values for stats & outliers
                if inferred_type in (InferredType.INTEGER, InferredType.FLOAT):
                    conv = self.type_engine.convert_value(v, InferredType.FLOAT)
                    if conv.success and conv.converted_value is not None:
                        num_f = float(conv.converted_value)
                        if math.isfinite(num_f):
                            numeric_vals.append(num_f)
                        else:
                            row_invalid = True
                            invalid_count += 1
                            if len(sample_invalids) < 5 and v not in sample_invalids:
                                sample_invalids.append(v)
                    else:
                        row_invalid = True
                        invalid_count += 1
                        if len(sample_invalids) < 5 and v not in sample_invalids:
                            sample_invalids.append(v)

                if row_invalid:
                    invalid_row_indices.add(row_idx)

            total_invalids += invalid_count

            # Outlier detection (IQR method) & exact sample statistics
            outlier_count = 0
            min_val, max_val, mean_val, median_val, std_val = None, None, None, None, None
            q1_val, q3_val = None, None
            summary = compute_numeric_summary(numeric_vals)
            if summary:
                min_val = round(float(summary["min"]), 2)
                max_val = round(float(summary["max"]), 2)
                mean_val = round(float(summary["mean"]), 2)
                median_val = round(float(summary["median"]), 2)
                std_val = round(float(summary["std_dev"]), 2)
                q1_val = round(float(summary["q1"]), 2)
                q3_val = round(float(summary["q3"]), 2)
                outlier_count = int(summary["outlier_count"])

            # Sample non-null values
            sample_vals = [str(x) for x in non_null_vals[:5]]

            # Frequency distribution (top-5 most frequent values)
            val_counts: Dict[str, int] = {}
            for v in non_null_vals:
                sv = str(v)
                val_counts[sv] = val_counts.get(sv, 0) + 1
            sorted_freq = sorted(val_counts.items(), key=lambda x: x[1], reverse=True)[:5]
            most_frequent = [
                {"value": val, "count": cnt, "percentage": round((cnt / total_rows) * 100.0, 2)}
                for val, cnt in sorted_freq
            ]

            # Register anomalies and structured quality issues
            if null_pct > 0:
                if null_pct > 50.0:
                    anomalies.append(f"Column '{col_name}' has high missingness ({null_pct}%)")
                quality_issues.append({
                    "column": col_name,
                    "issue_category": "MISSING_VALUES",
                    "affected_records": null_count,
                    "percentage_affected": null_pct,
                    "example_values": [None],
                    "severity": "ERROR" if null_pct > 50.0 else "WARNING",
                    "recommended_action": "Impute missing values or drop affected records",
                })
            if invalid_count > 0:
                anomalies.append(f"Column '{col_name}' contains {invalid_count} invalid value(s)")
                quality_issues.append({
                    "column": col_name,
                    "issue_category": "INVALID_VALUES",
                    "affected_records": invalid_count,
                    "percentage_affected": round((invalid_count / total_rows) * 100.0, 2) if total_rows > 0 else 0.0,
                    "example_values": sample_invalids,
                    "severity": "ERROR",
                    "recommended_action": "Standardize formatting or quarantine invalid rows",
                })
            if mojibake_count > 0:
                anomalies.append(f"Column '{col_name}' contains {mojibake_count} character encoding error(s)")
                quality_issues.append({
                    "column": col_name,
                    "issue_category": "ENCODING_ERROR",
                    "affected_records": mojibake_count,
                    "percentage_affected": round((mojibake_count / total_rows) * 100.0, 2) if total_rows > 0 else 0.0,
                    "example_values": [],
                    "severity": "WARNING",
                    "recommended_action": "Apply automated UTF-8 mojibake repair",
                })
            if outlier_count > 0:
                quality_issues.append({
                    "column": col_name,
                    "issue_category": "NUMERIC_OUTLIER",
                    "affected_records": outlier_count,
                    "percentage_affected": round((outlier_count / total_rows) * 100.0, 2) if total_rows > 0 else 0.0,
                    "example_values": [],
                    "severity": "INFO",
                    "recommended_action": "Inspect extreme values or apply IQR fence capping",
                })

            histogram = compute_numeric_histogram(numeric_vals) if numeric_vals else []

            col_profiles[col_name] = ColumnProfile(
                column_name=col_name,
                total_count=total_rows,
                inferred_type=inferred_type.value,
                null_count=null_count,
                null_percentage=null_pct,
                unique_count=unique_count,
                cardinality_ratio=cardinality,
                duplicate_count=dup_count,
                invalid_count=invalid_count,
                invalid_percentage=round((invalid_count / total_rows) * 100.0, 2) if total_rows > 0 else 0.0,
                inconsistent_format_count=inconsistent_count,
                mojibake_count=mojibake_count,
                outlier_count=outlier_count,
                min_value=min_val,
                max_value=max_val,
                mean=mean_val,
                median=median_val,
                std_dev=std_val,
                q1=q1_val,
                q3=q3_val,
                sample_invalids=sample_invalids,
                sample_values=sample_vals,
                most_frequent_values=most_frequent,
                pattern_distribution=type_profile.type_counts,
                histogram=histogram,
            )

        completeness = round(((total_fields - total_missing) / total_fields) * 100.0, 2) if total_fields > 0 else 100.0
        validity = round(((total_fields - total_invalids) / total_fields) * 100.0, 2) if total_fields > 0 else 100.0
        dup_rows = total_rows - df.unique().height if total_rows > 0 else 0
        est_mem = df.estimated_size()
        schema_dict = {col: str(df.schema[col]) for col in df.columns}

        invalid_records = len(invalid_row_indices)
        valid_records = max(0, total_rows - invalid_records)

        return DatasetProfileReport(
            stage=stage,
            total_rows=total_rows,
            total_columns=total_cols,
            columns=col_profiles,
            total_missing_values=total_missing,
            duplicate_row_count=dup_rows,
            valid_record_count=valid_records,
            invalid_record_count=invalid_records,
            estimated_memory_bytes=est_mem,
            dataset_size_bytes=est_mem,
            schema_info=schema_dict,
            overall_completeness=completeness,
            overall_validity=validity,
            critical_issues_count=len(anomalies),
            anomalies=anomalies,
            quality_issues=quality_issues,
        )

    def generate_delta_report(
        self,
        before: DatasetProfileReport,
        after: DatasetProfileReport,
        rows_valid: int,
        rows_quarantined: int,
        duplicates_merged: int,
    ) -> ProfilingDeltaReport:
        """Generates before-and-after audit comparison detailing the transformations."""
        initial_nulls = sum(c.null_count for c in before.columns.values())
        final_nulls = sum(c.null_count for c in after.columns.values())
        invalid_dates = sum(
            c.invalid_count for c in before.columns.values()
            if "date" in c.inferred_type or any(k in c.column_name.lower() for k in ("dob", "birth", "date"))
        )
        mojibake_fixed = sum(c.mojibake_count for c in before.columns.values())
        outliers_total = sum(c.outlier_count for c in before.columns.values())

        col_deltas = {}
        for col, b_prof in before.columns.items():
            if col in after.columns:
                a_prof = after.columns[col]
                col_deltas[col] = {
                    "inferred_type": a_prof.inferred_type,
                    "null_reduction": b_prof.null_count - a_prof.null_count,
                    "invalids_resolved": b_prof.invalid_count - a_prof.invalid_count,
                    "mojibake_fixed": b_prof.mojibake_count - a_prof.mojibake_count,
                }

        summary = (
            f"Processed {before.total_rows} raw records: {rows_valid} verified/staged, "
            f"{rows_quarantined} quarantined/rejected. Resolved {mojibake_fixed} encoding errors, "
            f"flagged {invalid_dates} invalid calendar dates, and merged {duplicates_merged} duplicate candidate pairs. "
            f"Overall validity increased from {before.overall_validity}% to {after.overall_validity}%."
        )

        return ProfilingDeltaReport(
            rows_processed=before.total_rows,
            rows_valid=rows_valid,
            rows_quarantined=rows_quarantined,
            initial_null_count=initial_nulls,
            resolved_null_count=max(0, initial_nulls - final_nulls),
            invalid_dates_detected=invalid_dates,
            invalid_dates_flagged=invalid_dates,
            mojibake_encoding_fixed=mojibake_fixed,
            duplicates_detected=duplicates_merged,
            outliers_identified=outliers_total,
            completeness_delta=round(after.overall_completeness - before.overall_completeness, 2),
            validity_delta=round(after.overall_validity - before.overall_validity, 2),
            summary=summary,
            column_deltas=col_deltas,
        )
