"""Data models, report containers, and validation constants for schema detection."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

# Max null threshold allowed for any column (50%)
MAX_NULL_PERCENTAGE_THRESHOLD: float = 50.0


# Supported detected types
class ColumnType(str, Enum):
    STRING = "string"
    NUMBER = "number"
    DATE = "date"
    BOOLEAN = "boolean"
    EMAIL = "email"
    PHONE = "phone"


# Regex patterns for type identification
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

PHONE_REGEX = re.compile(
    r"^\+?[0-9]{1,4}?[-.\s]?\(?[0-9]{1,4}?\)?[-.\s]?[0-9]{1,4}[-.\s]?[0-9]{1,9}$"
)

BOOLEAN_TERMS = {"true", "false", "1", "0", "yes", "no", "y", "n", "t", "f"}

COMMON_DATE_FORMATS = [
    "%Y-%m-%d",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%dT%H:%M:%S%z",
    "%d/%m/%Y",
    "%m/%d/%Y",
    "%Y/%m/%d",
    "%d-%m-%Y",
    "%m-%d-%Y",
    "%b %d, %Y",
    "%d %b %Y",
]


@dataclass
class ColumnValidationReport:
    """Detailed validation and schema detection report for a single column."""

    column_name: str
    detected_type: str
    total_count: int
    null_count: int
    null_percentage: float
    unique_count: int
    unique_percentage: float
    type_distribution: Dict[str, float]
    sample_values: List[Any]
    is_rejected: bool = False
    rejection_reason: Optional[str] = None
    suggested_property: Optional[str] = None
    suggested_entity_type: Optional[str] = None
    mapping_confidence: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class PreflightValidationReport:
    """Comprehensive pre-flight schema and data quality report for an entire dataset."""

    is_valid: bool
    total_rows: int
    total_columns: int
    columns: List[ColumnValidationReport]
    rejected_columns: List[str] = field(default_factory=list)
    error_message: Optional[str] = None
    suggested_entity_type: Optional[str] = None
    entity_confidence: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        res = asdict(self)
        res["columns"] = [col.to_dict() for col in self.columns]
        return res
