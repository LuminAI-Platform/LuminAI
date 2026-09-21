"""Dagster asset checks and data quality gates for LuminAI data engine.

Defines production-grade data quality checks:
  1. ``cleaning_min_row_count_check``: Validates minimum row count thresholds on cleaned datasets.
  2. ``cleaning_max_null_percentage_check``: Validates column completeness, flags 100% null columns and missing IDs.
  3. ``cleaning_value_range_check``: Validates domain value ranges (age in [0, 150], no future dates, non-negative salary).
  4. ``er_referential_integrity_check``: Validates referential integrity between Golden Records and staging records.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List

import polars as pl
from dagster import (
    AssetCheckResult,
    AssetCheckSeverity,
    AssetIn,
    asset_check,
)

from app.processing.pipelines.cleaning_pipeline import cleaned_ingestion_data
from app.processing.pipelines.er_pipeline import er_golden_records

logger = logging.getLogger(__name__)

# Primary identifier columns that must never have null or empty values
MANDATORY_IDENTIFIER_COLS = {"id", "raw_id", "tenant_id"}

# Configurable max null percentage for optional attribute columns (50%)
DEFAULT_MAX_NULL_PERCENTAGE = 50.0

# Supported timestamp formats for future-date checking
TIMESTAMP_FORMATS = [
    "%Y-%m-%dT%H:%M:%S%z",
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d",
    "%d/%m/%Y",
    "%m/%d/%Y",
]


def evaluate_min_row_count(
    df: pl.DataFrame,
    min_threshold: int = 1,
) -> AssetCheckResult:
    """Evaluate whether a DataFrame meets the minimum row count threshold."""
    row_count = df.height
    passed = row_count >= min_threshold
    description = (
        f"Dataset contains {row_count} rows (minimum required: {min_threshold})."
        if passed
        else f"Dataset is empty ({row_count} rows), below minimum required threshold of {min_threshold}."
    )
    return AssetCheckResult(
        passed=passed,
        severity=AssetCheckSeverity.ERROR,
        description=description,
        metadata={
            "row_count": row_count,
            "min_threshold": min_threshold,
        },
    )


def evaluate_null_percentages(
    df: pl.DataFrame,
    max_null_pct: float = DEFAULT_MAX_NULL_PERCENTAGE,
) -> AssetCheckResult:
    """Evaluate null and empty-string percentages across all DataFrame columns."""
    total_rows = df.height
    if total_rows == 0:
        return AssetCheckResult(
            passed=True,
            severity=AssetCheckSeverity.WARN,
            description="Empty dataset; null percentage check bypassed.",
            metadata={"total_rows": 0},
        )

    null_percentages: Dict[str, float] = {}
    violations: List[str] = []

    for col in df.columns:
        dtype = df.schema[col]
        # Treat None, null, and empty/whitespace string as missing
        if dtype in (pl.Utf8, pl.String):
            missing_count = df.select(
                (pl.col(col).is_null() | (pl.col(col).str.strip_chars() == "")).sum()
            ).item()
        else:
            missing_count = df.select(pl.col(col).is_null().sum()).item()

        pct = (missing_count / total_rows) * 100.0
        null_percentages[col] = round(pct, 2)

        # 1. Mandatory identifier columns must be 0% null
        if col.lower() in MANDATORY_IDENTIFIER_COLS and pct > 0.0:
            violations.append(
                f"Mandatory identifier '{col}' has {pct:.1f}% missing values ({missing_count}/{total_rows} rows)."
            )

        # 2. 100% null columns are invalid
        elif pct >= 100.0:
            violations.append(
                f"Column '{col}' is 100% null/empty ({missing_count}/{total_rows} rows)."
            )

        # 3. Standard attributes exceeding configurable threshold
        elif pct > max_null_pct:
            violations.append(
                f"Column '{col}' null percentage {pct:.1f}% exceeds max threshold {max_null_pct}%."
            )

    passed = len(violations) == 0
    description = (
        f"All {len(df.columns)} columns satisfied completeness and null percentage thresholds."
        if passed
        else f"Data quality violation: {len(violations)} column(s) exceeded null/missing thresholds."
    )

    return AssetCheckResult(
        passed=passed,
        severity=AssetCheckSeverity.ERROR,
        description=description,
        metadata={
            "total_rows": total_rows,
            "column_count": len(df.columns),
            "null_percentages": {k: f"{v}%" for k, v in null_percentages.items()},
            "violations": violations,
        },
    )


def evaluate_value_range_constraints(
    df: pl.DataFrame,
) -> AssetCheckResult:
    """Evaluate value range constraints on age, dates, scores, and currency."""
    violations: List[str] = []
    total_rows = df.height
    if total_rows == 0:
        return AssetCheckResult(
            passed=True,
            severity=AssetCheckSeverity.WARN,
            description="Empty dataset; value range check bypassed.",
            metadata={"total_rows": 0},
        )

    # 1. Age constraint: age in [0, 150]
    if "age" in df.columns:
        age_col = df["age"]
        # Filter non-null numeric values
        try:
            valid_ages = age_col.cast(pl.Float64, strict=False).drop_nulls()
            if valid_ages.len() > 0:
                min_age = float(valid_ages.min())  # type: ignore[arg-type]
                max_age = float(valid_ages.max())  # type: ignore[arg-type]
                out_of_bounds = valid_ages.filter((valid_ages < 0) | (valid_ages > 150))
                if out_of_bounds.len() > 0:
                    violations.append(
                        f"Age constraint violation: {out_of_bounds.len()} rows out of range [0, 150] "
                        f"(min: {min_age}, max: {max_age})."
                    )
        except Exception as exc:
            violations.append(f"Age parsing error: {exc}")

    # 2. Date / temporal constraint: no future dates (birth date, joined_at, etc.)
    # Allow 1 day clock skew buffer
    now_limit = datetime.now(timezone.utc) + timedelta(days=1)
    date_candidates = ["joined_at", "birth_date", "dob", "created_at"]
    for date_col in date_candidates:
        if date_col in df.columns:
            future_dates_count = 0
            latest_found: datetime | None = None
            for val in df[date_col].drop_nulls().to_list():
                if not val or str(val).strip() in ("", "0"):
                    continue
                val_str = str(val).strip()
                parsed_dt: datetime | None = None
                for fmt in TIMESTAMP_FORMATS:
                    try:
                        parsed_dt = datetime.strptime(val_str, fmt)
                        break
                    except ValueError:
                        continue
                if parsed_dt:
                    if parsed_dt.tzinfo is None:
                        parsed_dt = parsed_dt.replace(tzinfo=timezone.utc)
                    if parsed_dt > now_limit:
                        future_dates_count += 1
                        if latest_found is None or parsed_dt > latest_found:
                            latest_found = parsed_dt

            if future_dates_count > 0:
                violations.append(
                    f"Future date constraint violation: {future_dates_count} rows in '{date_col}' "
                    f"have dates in the future (latest: {latest_found.isoformat() if latest_found else 'unknown'})."
                )

    # 3. Salary constraint: salary_amount >= 0
    if "salary_amount" in df.columns:
        try:
            salaries = df["salary_amount"].cast(pl.Float64, strict=False).drop_nulls()
            if salaries.len() > 0:
                negative_salaries = salaries.filter(salaries < 0)
                if negative_salaries.len() > 0:
                    violations.append(
                        f"Salary constraint violation: {negative_salaries.len()} rows with negative salary "
                        f"(min: {salaries.min()})."
                    )
        except Exception as exc:
            violations.append(f"Salary validation error: {exc}")

    # 4. Score constraint: score in [0.0, 1.0] (or [0, 100])
    if "score" in df.columns:
        try:
            scores = df["score"].cast(pl.Float64, strict=False).drop_nulls()
            if scores.len() > 0:
                negative_scores = scores.filter(scores < 0.0)
                if negative_scores.len() > 0:
                    violations.append(
                        f"Score constraint violation: {negative_scores.len()} rows with negative scores "
                        f"(min: {scores.min()})."
                    )
        except Exception as exc:
            violations.append(f"Score validation error: {exc}")

    passed = len(violations) == 0
    description = (
        "All value range constraints satisfied (age, dates, salary, scores)."
        if passed
        else f"Data quality violation: {len(violations)} value range constraint(s) failed."
    )

    return AssetCheckResult(
        passed=passed,
        severity=AssetCheckSeverity.ERROR,
        description=description,
        metadata={
            "total_rows": total_rows,
            "violations_count": len(violations),
            "violations": violations,
        },
    )


def evaluate_referential_integrity(
    golden_df: pl.DataFrame,
    staging_df: pl.DataFrame,
) -> AssetCheckResult:
    """Evaluate referential integrity between Golden Records and staging records."""
    if golden_df.height == 0:
        return AssetCheckResult(
            passed=True,
            severity=AssetCheckSeverity.WARN,
            description="Empty golden records dataset; referential integrity check bypassed.",
            metadata={"golden_records_count": 0, "staging_records_count": staging_df.height},
        )

    # Collect all available staging record IDs
    staging_ids: set[str] = set()
    if "id" in staging_df.columns:
        staging_ids.update(str(x) for x in staging_df["id"].drop_nulls().to_list())
    if "raw_id" in staging_df.columns:
        staging_ids.update(str(x) for x in staging_df["raw_id"].drop_nulls().to_list())

    missing_references: set[str] = set()
    orphaned_count = 0
    total_references = 0

    for row in golden_df.iter_rows(named=True):
        source_ids = row.get("source_record_ids")
        if not source_ids:
            orphaned_count += 1
            continue

        if isinstance(source_ids, list):
            id_list = [str(i) for i in source_ids]
        elif isinstance(source_ids, str):
            import json
            try:
                parsed = json.loads(source_ids)
                id_list = [str(i) for i in parsed] if isinstance(parsed, list) else [source_ids]
            except Exception:
                id_list = [source_ids]
        else:
            id_list = [str(source_ids)]

        if not id_list:
            orphaned_count += 1
            continue

        total_references += len(id_list)
        for ref_id in id_list:
            if ref_id not in staging_ids:
                missing_references.add(ref_id)

    violations: List[str] = []
    if missing_references:
        violations.append(
            f"Found {len(missing_references)} referenced source record IDs missing from staging dataset."
        )
    if orphaned_count:
        violations.append(
            f"Found {orphaned_count} Golden Records with no associated source record IDs (orphaned)."
        )

    passed = len(violations) == 0
    description = (
        f"Referential integrity verified: all {total_references} source references across "
        f"{golden_df.height} Golden Records exist in staging records."
        if passed
        else f"Referential integrity violation: {len(missing_references)} missing references, {orphaned_count} orphaned records."
    )

    return AssetCheckResult(
        passed=passed,
        severity=AssetCheckSeverity.ERROR,
        description=description,
        metadata={
            "golden_records_count": golden_df.height,
            "staging_records_count": staging_df.height,
            "total_source_references": total_references,
            "missing_references_count": len(missing_references),
            "missing_sample": list(missing_references)[:10],
            "orphaned_golden_records": orphaned_count,
            "violations": violations,
        },
    )


# ---------------------------------------------------------------------------
# Dagster Asset Check Decorators
# ---------------------------------------------------------------------------


@asset_check(
    asset=cleaned_ingestion_data,
    description="Asserts that cleaned_ingestion_data has at least 1 row.",
)
def cleaning_min_row_count_check(
    cleaned_ingestion_data: pl.DataFrame,
) -> AssetCheckResult:
    """Validate minimum row count on cleaned ingestion data."""
    return evaluate_min_row_count(cleaned_ingestion_data, min_threshold=1)


@asset_check(
    asset=cleaned_ingestion_data,
    description="Validates column completeness, flags 100% null columns and null identifiers.",
)
def cleaning_max_null_percentage_check(
    cleaned_ingestion_data: pl.DataFrame,
) -> AssetCheckResult:
    """Validate null percentages on cleaned ingestion data."""
    return evaluate_null_percentages(cleaned_ingestion_data)


@asset_check(
    asset=cleaned_ingestion_data,
    description="Validates domain value ranges (age in [0, 150], no future dates, non-negative salary).",
)
def cleaning_value_range_check(
    cleaned_ingestion_data: pl.DataFrame,
) -> AssetCheckResult:
    """Validate value ranges on cleaned ingestion data."""
    return evaluate_value_range_constraints(cleaned_ingestion_data)


@asset_check(
    asset=er_golden_records,
    additional_ins={"staged_records_for_er": AssetIn("staged_records_for_er")},
    description="Asserts referential integrity between Golden Records and source staging records.",
)
def er_referential_integrity_check(
    er_golden_records: pl.DataFrame,
    staged_records_for_er: pl.DataFrame,
) -> AssetCheckResult:
    """Validate referential integrity between Golden Records and staging records."""
    return evaluate_referential_integrity(er_golden_records, staged_records_for_er)
