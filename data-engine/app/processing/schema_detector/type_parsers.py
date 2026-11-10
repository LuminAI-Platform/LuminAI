"""Value parsing and type detection helper functions."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

import polars as pl

from app.processing.schema_detector.models import (
    BOOLEAN_TERMS,
    COMMON_DATE_FORMATS,
    EMAIL_REGEX,
)


def is_null_or_empty(val: Any) -> bool:
    """Check if a value represents null, empty string, or whitespace."""
    if val is None:
        return True
    if isinstance(val, str) and val.strip() == "":
        return True
    return False


def try_parse_number(val: Any) -> bool:
    """Check if a value can be parsed as a numeric value (int, float, or currency)."""
    if isinstance(val, (int, float)) and not isinstance(val, bool):
        return True
    if not isinstance(val, str):
        return False
    s = val.strip()
    s_clean = re.sub(r"^[\$€£¥₹]\s*|\s*[\$€£¥₹]$", "", s)
    s_clean = s_clean.replace(",", "")
    try:
        float(s_clean)
        return True
    except ValueError:
        return False


def try_parse_boolean(val: Any) -> bool:
    """Check if a value represents a boolean term."""
    if isinstance(val, bool):
        return True
    if isinstance(val, (int, float)):
        return val in (0, 1)
    if isinstance(val, str):
        return val.strip().lower() in BOOLEAN_TERMS
    return False


def try_parse_email(val: Any) -> bool:
    """Check if a string matches RFC email address formatting."""
    if not isinstance(val, str):
        return False
    s = val.strip()
    return bool(EMAIL_REGEX.match(s))


def try_parse_date(val: Any) -> bool:
    """Check if a value represents a valid date or timestamp."""
    if isinstance(val, (datetime, pl.Date, pl.Datetime)):
        return True
    if not isinstance(val, str):
        return False
    s = val.strip()
    if len(s) < 6:
        return False
    if re.match(r"^-?\d+(\.\d+)?$", s):
        return False
    for fmt in COMMON_DATE_FORMATS:
        try:
            datetime.strptime(s, fmt)
            return True
        except ValueError:
            continue
    try:
        datetime.fromisoformat(s.replace("Z", "+00:00"))
        return True
    except Exception:
        pass
    return False


def try_parse_phone(val: Any) -> bool:
    """Check if a string matches telephone number formatting."""
    if not isinstance(val, (str, int)):
        return False
    s = str(val).strip()
    if len(s) < 7 or len(s) > 25:
        return False
    if try_parse_date(s):
        return False
    if not re.match(r"^\+?[0-9\s\-\(\)\.]{7,25}$", s):
        return False
    digits = re.sub(r"\D", "", s)
    if len(digits) < 7 or len(digits) > 15:
        return False
    if s.isdigit() and not s.startswith("+"):
        return False
    return True
