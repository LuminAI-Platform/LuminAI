"""Production data type inference, conversion, and validation engine.

Ensures that values are never blindly coerced, null sentinels are normalized safely,
original values are preserved, and all type conversions are recorded and auditable.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple


class InferredType(str, Enum):
    NULL = "null"
    BOOLEAN = "boolean"
    INTEGER = "integer"
    FLOAT = "float"
    DATE = "date"
    DATETIME = "datetime"
    EMAIL = "email"
    PHONE = "phone"
    IDENTIFIER = "identifier"
    CATEGORICAL = "categorical"
    STRING = "string"
    OBJECT = "object"
    ARRAY = "array"


# Standard null sentinels across relational, CSV, and dirty data dumps
NULL_SENTINELS: Set[str] = {
    "",
    "null",
    "none",
    "nil",
    "n/a",
    "na",
    "n.a.",
    "-",
    "--",
    "?",
    "??",
    "undefined",
    "#n/a",
    "#na",
    "nan",
    "null()",
    "(null)",
    "<null>",
}

BOOLEAN_TRUE: Set[str] = {"true", "t", "yes", "y", "1"}
BOOLEAN_FALSE: Set[str] = {"false", "f", "no", "n", "0"}


@dataclass
class ConversionResult:
    """Outcome of converting a single scalar value."""
    success: bool
    original_value: Any
    converted_value: Any
    target_type: InferredType
    is_null: bool = False
    warning: Optional[str] = None
    transformation: Optional[str] = None

    @property
    def is_valid(self) -> bool:
        return self.success

    @property
    def inferred_type(self) -> InferredType:
        return self.target_type


@dataclass
class ColumnTypeProfile:
    """Statistical type distribution for a column."""
    column_name: str
    predominant_type: InferredType
    confidence: float
    total_count: int
    null_count: int
    type_counts: Dict[str, int] = field(default_factory=dict)
    sample_invalids: List[Any] = field(default_factory=list)


class TypeInferenceEngine:
    """Engine for reliable type detection, schema inference, and safe conversion."""

    @classmethod
    def is_null_sentinel(cls, val: Any) -> bool:
        """Determines whether a value matches a null sentinel or is empty/None."""
        return cls.is_null_value(val)

    @classmethod
    def normalize_null(cls, val: Any) -> Tuple[Any, bool]:
        """Normalizes sentinels to None while preserving non-null values."""
        is_null = cls.is_null_value(val)
        return (None if is_null else val, is_null)

    def infer_and_convert(self, val: Any) -> ConversionResult:
        """Infers the scalar type of val and safely converts it."""
        inferred = self.detect_scalar_type(val)
        if inferred == InferredType.NULL:
            return self.convert_value(val, InferredType.STRING)
        return self.convert_value(val, inferred)

    @staticmethod
    def is_null_value(val: Any) -> bool:
        """Determines whether a value is effectively null or a null sentinel.
        
        Note: Numeric 0 or 0.0 is NOT considered null.
        """
        if val is None:
            return True
        if isinstance(val, (int, float)):
            if isinstance(val, float):
                import math
                return math.isnan(val)
            return False
        if isinstance(val, str):
            clean = val.strip().lower()
            return clean in NULL_SENTINELS
        return False

    @staticmethod
    def detect_scalar_type(val: Any) -> InferredType:
        """Detects the specific semantic type of an individual value."""
        if TypeInferenceEngine.is_null_value(val):
            return InferredType.NULL

        if isinstance(val, bool):
            return InferredType.BOOLEAN

        if isinstance(val, int):
            return InferredType.INTEGER

        if isinstance(val, float):
            return InferredType.FLOAT

        if isinstance(val, (dict, list)):
            return InferredType.OBJECT if isinstance(val, dict) else InferredType.ARRAY

        s = str(val).strip()
        lower = s.lower()

        # Booleans
        if lower in BOOLEAN_TRUE or lower in BOOLEAN_FALSE:
            return InferredType.BOOLEAN

        # Integers
        if re.match(r"^[-+]?\d+$", s):
            return InferredType.INTEGER

        # Floats & numeric with currency symbols or commas
        if re.match(r"^[-+]?\d+\.\d+$", s):
            return InferredType.FLOAT
        
        # Numeric with commas (e.g. 12,000.50)
        clean_num = s.replace(",", "")
        if re.match(r"^[-+]?\d+(\.\d+)?$", clean_num):
            return InferredType.FLOAT if "." in clean_num else InferredType.INTEGER

        # Check Date / Datetime pattern
        if re.match(r"^\d{4}-\d{2}-\d{2}$", s) or re.match(r"^\d{2}[/-]\d{2}[/-]\d{4}$", s):
            return InferredType.DATE

        if "t" in lower or ":" in s:
            if re.match(r"^\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(z|[+-]\d{2}:?\d{2})?$", lower):
                return InferredType.DATETIME

        # Email
        if re.match(r"^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$", s):
            return InferredType.EMAIL

        # Phone
        digits_only = re.sub(r"\D", "", s)
        if 7 <= len(digits_only) <= 15 and re.match(r"^\+?[0-9\s\-\(\)\.]{7,25}$", s):
            if not s.isdigit() or s.startswith("+"):
                return InferredType.PHONE

        return InferredType.STRING

    def profile_column(self, col_name: str, values: List[Any]) -> ColumnTypeProfile:
        """Profiles a list of column values to infer predominant type and type confidence."""
        total = len(values)
        if total == 0:
            return ColumnTypeProfile(
                column_name=col_name,
                predominant_type=InferredType.STRING,
                confidence=1.0,
                total_count=0,
                null_count=0,
                type_counts={},
            )

        type_counts: Dict[str, int] = {}
        null_count = 0
        invalids: List[Any] = []

        for val in values:
            stype = self.detect_scalar_type(val)
            if stype == InferredType.NULL:
                null_count += 1
            else:
                type_counts[stype.value] = type_counts.get(stype.value, 0) + 1

        non_null_total = total - null_count
        if non_null_total == 0:
            return ColumnTypeProfile(
                column_name=col_name,
                predominant_type=InferredType.STRING,
                confidence=1.0,
                total_count=total,
                null_count=null_count,
                type_counts=type_counts,
            )

        # Sort types by frequency
        sorted_types = sorted(type_counts.items(), key=lambda x: x[1], reverse=True)
        top_type_str, top_count = sorted_types[0]
        confidence = round(top_count / non_null_total, 4)

        # Coercion compatibility: if mix of INTEGER and FLOAT, promote to FLOAT
        if top_type_str in ("integer", "float"):
            num_total = type_counts.get("integer", 0) + type_counts.get("float", 0)
            if num_total / non_null_total >= 0.70:
                predominant = InferredType.FLOAT if type_counts.get("float", 0) > 0 else InferredType.INTEGER
                confidence = round(num_total / non_null_total, 4)
            else:
                predominant = InferredType.STRING if confidence < 0.60 else InferredType(top_type_str)
        elif confidence < 0.60:
            predominant = InferredType.STRING
        else:
            predominant = InferredType(top_type_str)

        # Collect sample invalids if column has predominant type
        if predominant != InferredType.STRING:
            for v in values:
                if not self.is_null_value(v):
                    vt = self.detect_scalar_type(v)
                    if vt != predominant and not (predominant == InferredType.FLOAT and vt == InferredType.INTEGER):
                        if v not in invalids and len(invalids) < 5:
                            invalids.append(v)

        return ColumnTypeProfile(
            column_name=col_name,
            predominant_type=predominant,
            confidence=confidence,
            total_count=total,
            null_count=null_count,
            type_counts=type_counts,
            sample_invalids=invalids,
        )

    def convert_value(
        self,
        val: Any,
        target_type: InferredType,
        allow_lossy: bool = False,
    ) -> ConversionResult:
        """Safely converts a value to target_type without silent data corruption."""
        if self.is_null_value(val):
            return ConversionResult(
                success=True,
                original_value=val,
                converted_value=None,
                target_type=target_type,
                is_null=True,
                transformation="null_normalized" if val is not None and str(val).strip() != "" else None,
            )

        if target_type == InferredType.STRING:
            s_val = str(val).strip()
            return ConversionResult(
                success=True,
                original_value=val,
                converted_value=s_val,
                target_type=target_type,
                transformation="string_trimmed" if len(s_val) != len(str(val)) else None,
            )

        if target_type == InferredType.BOOLEAN:
            if isinstance(val, bool):
                return ConversionResult(
                    success=True,
                    original_value=val,
                    converted_value=val,
                    target_type=target_type,
                )
            s = str(val).strip().lower()
            if s in BOOLEAN_TRUE:
                return ConversionResult(
                    success=True,
                    original_value=val,
                    converted_value=True,
                    target_type=target_type,
                    transformation="boolean_standardized",
                )
            if s in BOOLEAN_FALSE:
                return ConversionResult(
                    success=True,
                    original_value=val,
                    converted_value=False,
                    target_type=target_type,
                    transformation="boolean_standardized",
                )
            return ConversionResult(
                success=False,
                original_value=val,
                converted_value=val,
                target_type=target_type,
                warning=f"Cannot safely convert '{val}' to boolean without established mapping",
            )

        if target_type in (InferredType.INTEGER, InferredType.FLOAT):
            if isinstance(val, (int, float)) and not isinstance(val, bool):
                if target_type == InferredType.INTEGER:
                    int_val = int(val)
                    if float(int_val) != float(val) and not allow_lossy:
                        return ConversionResult(
                            success=False,
                            original_value=val,
                            converted_value=val,
                            target_type=target_type,
                            warning=f"Lossy float-to-integer conversion rejected for {val}",
                        )
                    return ConversionResult(
                        success=True,
                        original_value=val,
                        converted_value=int_val,
                        target_type=target_type,
                    )
                return ConversionResult(
                    success=True,
                    original_value=val,
                    converted_value=float(val),
                    target_type=target_type,
                )

            s = str(val).strip()
            # Clean commas and currency symbols if safe
            clean_s = re.sub(r"^[\$€£¥₹]\s*|\s*[\$€£¥₹]$", "", s).replace(",", "")
            try:
                f_val = float(clean_s)
                import math
                if math.isinf(f_val):
                    return ConversionResult(
                        success=False,
                        original_value=val,
                        converted_value=val,
                        target_type=target_type,
                        warning=f"Infinite numeric value '{val}' rejected",
                    )
                if target_type == InferredType.INTEGER:
                    if not clean_s.lstrip("-+").isdigit():
                        if allow_lossy:
                            return ConversionResult(
                                success=True,
                                original_value=val,
                                converted_value=int(round(f_val)),
                                target_type=target_type,
                                transformation="float_rounded_to_int",
                            )
                        return ConversionResult(
                            success=False,
                            original_value=val,
                            converted_value=val,
                            target_type=target_type,
                            warning=f"Value '{val}' has decimal part; lossy integer conversion rejected",
                        )
                    return ConversionResult(
                        success=True,
                        original_value=val,
                        converted_value=int(clean_s),
                        target_type=target_type,
                        transformation="parsed_integer" if clean_s != s else None,
                    )
                return ConversionResult(
                    success=True,
                    original_value=val,
                    converted_value=f_val,
                    target_type=target_type,
                    transformation="parsed_float" if clean_s != s else None,
                )
            except ValueError:
                return ConversionResult(
                    success=False,
                    original_value=val,
                    converted_value=val,
                    target_type=target_type,
                    warning=f"Cannot parse '{val}' as numeric {target_type.value}",
                )

        return ConversionResult(
            success=True,
            original_value=val,
            converted_value=val,
            target_type=target_type,
        )
