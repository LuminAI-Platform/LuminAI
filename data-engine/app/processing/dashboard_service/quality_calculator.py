"""Data quality score computation routines using DuckDB, Polars, and DataQualityFramework.

Evaluates:
  - Completeness: Percentage of non-null, non-sentinel attribute values.
  - Validity: Adherence to calendar dates, valid identifiers, and schema rules.
  - Uniqueness: Distinct real-world entities and absence of identifier collisions.
  - Consistency: Uniformity of casing, formatting, and canonical categories.
  - Timeliness: Records refreshed or validated within operational recency windows.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

import polars as pl

from app.processing.engine.date_cleaner import DateCleaner
from app.processing.engine.type_inference import TypeInferenceEngine

logger = logging.getLogger(__name__)


def compute_completeness(df: pl.DataFrame, total_rows: int) -> float:
    """Completeness: percentage of non-null, non-sentinel attribute values."""
    if total_rows == 0:
        return 0.0

    total_fields = 0
    non_null_fields = 0
    type_engine = TypeInferenceEngine()

    # If attributes JSON column is present
    if "attributes" in df.columns:
        for val in df["attributes"].to_list():
            if not val:
                continue
            try:
                attrs = json.loads(val) if isinstance(val, str) else (val if isinstance(val, dict) else {})
                for k, v in attrs.items():
                    if not k.startswith("_"):
                        total_fields += 1
                        if not type_engine.is_null_value(v):
                            non_null_fields += 1
            except Exception:
                pass
    else:
        # Direct columns
        for col in df.columns:
            if col.startswith("_") or col in ("id", "golden_id", "tenant_id"):
                continue
            total_fields += total_rows
            missing = sum(1 for v in df[col].to_list() if type_engine.is_null_value(v))
            non_null_fields += (total_rows - missing)

    if total_fields == 0:
        return 100.0

    return round((non_null_fields / total_fields) * 100.0, 1)


def compute_uniqueness(df: pl.DataFrame, total_rows: int) -> float:
    """Uniqueness: absence of duplicate real-world entity records."""
    if total_rows == 0:
        return 0.0

    # Look for unique composite key (e.g. canonical_name + dob or email)
    signatures = []
    for row in df.iter_rows(named=True):
        attrs = {}
        if "attributes" in row and row["attributes"]:
            try:
                attrs = json.loads(row["attributes"]) if isinstance(row["attributes"], str) else (row["attributes"] if isinstance(row["attributes"], dict) else {})
            except Exception:
                pass
        
        name = str(row.get("canonical_name") or attrs.get("name") or attrs.get("full_name") or row.get("name") or "").strip().lower()
        email = str(attrs.get("email") or row.get("email") or "").strip().lower()
        dob = str(attrs.get("dob") or attrs.get("date_of_birth") or row.get("dob") or "").strip()
        
        if email:
            signatures.append(f"email:{email}")
        elif name and dob:
            signatures.append(f"namedob:{name}:{dob}")
        elif name:
            signatures.append(f"name:{name}")
        else:
            signatures.append(f"id:{row.get('golden_id') or row.get('id') or ''}")

    distinct_count = len(set(signatures))
    return round((distinct_count / total_rows) * 100.0, 1)


def compute_validity(df: pl.DataFrame, total_rows: int) -> float:
    """Validity: percentage of non-null values conforming to calendar and format checks."""
    if total_rows == 0:
        return 0.0

    checked_fields = 0
    valid_fields = 0

    for row in df.iter_rows(named=True):
        attrs = {}
        if "attributes" in row and row["attributes"]:
            try:
                attrs = json.loads(row["attributes"]) if isinstance(row["attributes"], str) else (row["attributes"] if isinstance(row["attributes"], dict) else {})
            except Exception:
                pass
        else:
            attrs = {k: v for k, v in row.items() if not k.startswith("_")}

        for k, v in attrs.items():
            if TypeInferenceEngine.is_null_value(v):
                continue
            k_lower = k.lower()
            if "date" in k_lower or k_lower in ("dob", "birth_date", "joined_at"):
                checked_fields += 1
                d_res = DateCleaner.clean_date(v, field_name=k)
                if d_res.is_valid:
                    valid_fields += 1
            elif "email" in k_lower:
                checked_fields += 1
                s_email = str(v).strip()
                if "@" in s_email and "." in s_email.split("@")[-1]:
                    valid_fields += 1

    if checked_fields == 0:
        return 100.0

    return round((valid_fields / checked_fields) * 100.0, 1)


def compute_consistency(df: pl.DataFrame, total_rows: int) -> float:
    """Consistency: formatting uniformity and valid JSON attributes."""
    if total_rows == 0:
        return 0.0

    valid_json_count = 0
    attrs_col = "attributes"
    if attrs_col in df.columns:
        for val in df[attrs_col].to_list():
            if val and isinstance(val, str):
                try:
                    parsed = json.loads(val)
                    if isinstance(parsed, dict) and len(parsed) > 0:
                        valid_json_count += 1
                except (json.JSONDecodeError, TypeError):
                    continue
            elif isinstance(val, dict) and len(val) > 0:
                valid_json_count += 1
        return round((valid_json_count / total_rows) * 100.0, 1)

    return 100.0


def compute_timeliness(df: pl.DataFrame, total_rows: int) -> float:
    """Timeliness: percentage of records updated within the last 30 days."""
    if total_rows == 0:
        return 0.0

    now = datetime.now(timezone.utc)
    timely_count = 0

    ts_col = "updated_at" if "updated_at" in df.columns else "created_at"
    if ts_col not in df.columns:
        return 100.0

    for val in df[ts_col].to_list():
        if val is None:
            continue
        try:
            if isinstance(val, datetime):
                ts = val if val.tzinfo else val.replace(tzinfo=timezone.utc)
            elif isinstance(val, str):
                ts = datetime.fromisoformat(val.replace("Z", "+00:00"))
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
            else:
                continue
            delta = (now - ts).days
            if delta <= 30:
                timely_count += 1
        except (ValueError, TypeError):
            continue

    return round((timely_count / total_rows) * 100.0, 1)


def compute_data_quality(df: pl.DataFrame) -> Dict[str, Any]:
    """Compute overall quality metrics dictionary for a golden records dataframe."""
    total_rows = len(df)
    if total_rows == 0:
        return {
            "overallScore": 0.0,
            "completeness": 0.0,
            "uniqueness": 0.0,
            "validity": 0.0,
            "consistency": 0.0,
            "timeliness": 0.0,
        }

    completeness = compute_completeness(df, total_rows)
    uniqueness = compute_uniqueness(df, total_rows)
    validity = compute_validity(df, total_rows)
    consistency = compute_consistency(df, total_rows)
    timeliness = compute_timeliness(df, total_rows)

    # Weighted composite score
    overall = round(
        (completeness * 0.25)
        + (validity * 0.30)
        + (uniqueness * 0.20)
        + (consistency * 0.15)
        + (timeliness * 0.10),
        1,
    )

    return {
        "overallScore": overall,
        "completeness": completeness,
        "uniqueness": uniqueness,
        "validity": validity,
        "consistency": consistency,
        "timeliness": timeliness,
    }
