"""Ingestion pipeline input validation, schema auto-detection, and ontology property mapping.

Provides:
  1. Auto-detection of column data types: 'string', 'number', 'date', 'boolean', 'email', 'phone'
  2. Ontology property mapping suggestions using normalized fuzzy matching
  3. Pre-flight data quality validation reports (null percentage, unique count, type distribution)
  4. Automatic rejection of files containing >50% null columns with clear error messages
"""

from __future__ import annotations

import io
import logging
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime
from difflib import SequenceMatcher
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import polars as pl

logger = logging.getLogger(__name__)

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
EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
)

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

# Standard LuminAI Ontology Property Registry
ONTOLOGY_REGISTRY: Dict[str, Dict[str, Dict[str, Any]]] = {
    "Person": {
        "id": {
            "aliases": ["id", "rec_id", "user_id", "person_id", "uuid", "uid", "customer_id"],
            "expected_type": ColumnType.STRING,
        },
        "name": {
            "aliases": ["name", "full_name", "first_name", "last_name", "contact_name", "username", "customer_name"],
            "expected_type": ColumnType.STRING,
        },
        "email": {
            "aliases": ["email", "e_mail", "email_address", "contact_email", "mail"],
            "expected_type": ColumnType.EMAIL,
        },
        "phone": {
            "aliases": ["phone", "telephone", "mobile", "cell", "phone_number", "contact_phone", "tel"],
            "expected_type": ColumnType.PHONE,
        },
        "age": {
            "aliases": ["age", "years_old", "dob_years", "age_years"],
            "expected_type": ColumnType.NUMBER,
        },
        "country": {
            "aliases": ["country", "nation", "country_code", "location_country", "nationality", "residence"],
            "expected_type": ColumnType.STRING,
        },
        "joined_at": {
            "aliases": ["joined_at", "created_at", "signup_date", "registered_at", "registration_date", "start_date"],
            "expected_type": ColumnType.DATE,
        },
        "score": {
            "aliases": ["score", "confidence", "rating", "rank", "credit_score"],
            "expected_type": ColumnType.NUMBER,
        },
        "salary": {
            "aliases": ["salary", "income", "compensation", "earnings", "wage", "pay"],
            "expected_type": ColumnType.NUMBER,
        },
    },
    "Organization": {
        "id": {
            "aliases": ["id", "org_id", "company_id", "business_id"],
            "expected_type": ColumnType.STRING,
        },
        "name": {
            "aliases": ["name", "org_name", "company_name", "business_name", "firm_name"],
            "expected_type": ColumnType.STRING,
        },
        "industry": {
            "aliases": ["industry", "sector", "business_sector", "domain"],
            "expected_type": ColumnType.STRING,
        },
        "employee_count": {
            "aliases": ["employee_count", "employees", "size", "headcount", "staff", "num_employees"],
            "expected_type": ColumnType.NUMBER,
        },
        "country": {
            "aliases": ["country", "hq_country", "location", "headquarters"],
            "expected_type": ColumnType.STRING,
        },
        "website": {
            "aliases": ["website", "url", "domain", "web_address", "homepage"],
            "expected_type": ColumnType.STRING,
        },
    },
    "Product": {
        "id": {
            "aliases": ["id", "product_id", "sku", "item_id", "code"],
            "expected_type": ColumnType.STRING,
        },
        "name": {
            "aliases": ["name", "product_name", "title", "item_name"],
            "expected_type": ColumnType.STRING,
        },
        "price": {
            "aliases": ["price", "cost", "amount", "unit_price", "retail_price"],
            "expected_type": ColumnType.NUMBER,
        },
        "stock_quantity": {
            "aliases": ["stock_quantity", "stock", "quantity", "inventory", "inventory_count", "qty"],
            "expected_type": ColumnType.NUMBER,
        },
        "category": {
            "aliases": ["category", "product_type", "department", "genre"],
            "expected_type": ColumnType.STRING,
        },
    },
    "Transaction": {
        "id": {
            "aliases": ["id", "transaction_id", "tx_id", "payment_id", "order_id"],
            "expected_type": ColumnType.STRING,
        },
        "amount": {
            "aliases": ["amount", "total", "total_amount", "sum", "value", "price"],
            "expected_type": ColumnType.NUMBER,
        },
        "timestamp": {
            "aliases": ["timestamp", "tx_date", "date", "created_at", "transacted_at", "transaction_date"],
            "expected_type": ColumnType.DATE,
        },
        "user_id": {
            "aliases": ["user_id", "customer_id", "buyer_id", "payer_id", "account_id"],
            "expected_type": ColumnType.STRING,
        },
        "status": {
            "aliases": ["status", "tx_status", "payment_status", "state", "order_status"],
            "expected_type": ColumnType.STRING,
        },
    },
}


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


class SchemaDetector:
    """
    Automated schema detection, fuzzy ontology mapping, and pre-flight data quality validator.
    """

    def __init__(self, max_null_pct: float = MAX_NULL_PERCENTAGE_THRESHOLD):
        self.max_null_pct = max_null_pct

    # 1. Type Detection Logic
    @staticmethod
    def _is_null_or_empty(val: Any) -> bool:
        """Check if a value represents null, empty string, or whitespace."""
        if val is None:
            return True
        if isinstance(val, str) and val.strip() == "":
            return True
        return False

    @staticmethod
    def _try_parse_number(val: Any) -> bool:
        """Check if a value can be parsed as a numeric value (int, float, or currency)."""
        if isinstance(val, (int, float)) and not isinstance(val, bool):
            return True
        if not isinstance(val, str):
            return False
        s = val.strip()
        # Strip common currency signs and commas: $1,250.50 -> 1250.50
        s_clean = re.sub(r"^[\$€£¥₹]\s*|\s*[\$€£¥₹]$", "", s)
        s_clean = s_clean.replace(",", "")
        try:
            float(s_clean)
            return True
        except ValueError:
            return False

    @staticmethod
    def _try_parse_boolean(val: Any) -> bool:
        """Check if a value represents a boolean term."""
        if isinstance(val, bool):
            return True
        if isinstance(val, (int, float)):
            return val in (0, 1)
        if isinstance(val, str):
            return val.strip().lower() in BOOLEAN_TERMS
        return False

    @staticmethod
    def _try_parse_email(val: Any) -> bool:
        """Check if a string matches RFC email address formatting."""
        if not isinstance(val, str):
            return False
        s = val.strip()
        return bool(EMAIL_REGEX.match(s))

    @classmethod
    def _try_parse_date(cls, val: Any) -> bool:
        """Check if a value represents a valid date or timestamp."""
        if isinstance(val, (datetime, pl.Date, pl.Datetime)):
            return True
        if not isinstance(val, str):
            return False
        s = val.strip()
        if len(s) < 6:
            return False
        # Discard pure numbers (which should be classified as NUMBER, not epoch date)
        if re.match(r"^-?\d+(\.\d+)?$", s):
            return False
        for fmt in COMMON_DATE_FORMATS:
            try:
                datetime.strptime(s, fmt)
                return True
            except ValueError:
                continue
        # Also try ISO format parsing
        try:
            datetime.fromisoformat(s.replace("Z", "+00:00"))
            return True
        except Exception:
            pass
        return False

    @classmethod
    def _try_parse_phone(cls, val: Any) -> bool:
        """Check if a string matches telephone number formatting."""
        if not isinstance(val, (str, int)):
            return False
        s = str(val).strip()
        if len(s) < 7 or len(s) > 25:
            return False
        # Dates must not be classified as phone numbers
        if cls._try_parse_date(s):
            return False
        # Must only contain phone-valid characters: +, digits, spaces, hyphens, parens, dots
        if not re.match(r"^\+?[0-9\s\-\(\)\.]{7,25}$", s):
            return False
        digits = re.sub(r"\D", "", s)
        if len(digits) < 7 or len(digits) > 15:
            return False
        # Pure numeric strings without '+' or punctuation are numbers, not phone numbers
        if s.isdigit() and not s.startswith("+"):
            return False
        return True

    def detect_column_type(self, raw_values: List[Any]) -> Tuple[ColumnType, Dict[str, float]]:
        """
        Analyze a list of values to determine the predominant column type and type distribution.

        Returns:
            Tuple of (detected_type, type_distribution_dict).
        """
        non_null_values = [v for v in raw_values if not self._is_null_or_empty(v)]
        total_count = len(raw_values)
        non_null_count = len(non_null_values)

        if non_null_count == 0:
            dist = {t.value: 0.0 for t in ColumnType}
            dist["null"] = 100.0
            return ColumnType.STRING, dist

        # Count occurrences of each category
        counts = {
            ColumnType.BOOLEAN: 0,
            ColumnType.EMAIL: 0,
            ColumnType.DATE: 0,
            ColumnType.PHONE: 0,
            ColumnType.NUMBER: 0,
            ColumnType.STRING: 0,
        }

        for v in non_null_values:
            # Check high-specificity patterns first
            if self._try_parse_boolean(v):
                counts[ColumnType.BOOLEAN] += 1
            elif self._try_parse_email(v):
                counts[ColumnType.EMAIL] += 1
            elif self._try_parse_date(v):
                counts[ColumnType.DATE] += 1
            elif self._try_parse_phone(v):
                counts[ColumnType.PHONE] += 1
            elif self._try_parse_number(v):
                counts[ColumnType.NUMBER] += 1
            else:
                counts[ColumnType.STRING] += 1

        # Calculate percentage distribution over non-null values
        dist: Dict[str, float] = {}
        for ctype, count in counts.items():
            dist[ctype.value] = round((count / non_null_count) * 100.0, 2)
        dist["null"] = round(((total_count - non_null_count) / total_count) * 100.0, 2) if total_count > 0 else 0.0

        # Determine predominant type (threshold >= 60% of non-null values)
        for ctype in (
            ColumnType.BOOLEAN,
            ColumnType.EMAIL,
            ColumnType.DATE,
            ColumnType.PHONE,
            ColumnType.NUMBER,
        ):
            if dist[ctype.value] >= 60.0:
                return ctype, dist

        # Default fallback
        return ColumnType.STRING, dist

    # 2. Ontology Property Mapping Suggestions (Fuzzy Matching)
    @staticmethod
    def _normalize_name(name: str) -> str:
        """Normalize identifier for comparison (strip spaces, punctuation, lowercase)."""
        return re.sub(r"[^a-zA-Z0-9]", "", name).lower()

    def suggest_ontology_mapping(
        self,
        column_name: str,
        detected_type: ColumnType,
    ) -> Tuple[Optional[str], Optional[str], float]:
        """
        Suggest ontology property mapping based on column name fuzzy matching and type alignment.

        Returns:
            Tuple of (suggested_entity_type, suggested_property_name, confidence_score).
        """
        norm_col = self._normalize_name(column_name)
        best_entity: Optional[str] = None
        best_property: Optional[str] = None
        best_score: float = 0.0

        for entity_type, properties in ONTOLOGY_REGISTRY.items():
            for prop_name, prop_meta in properties.items():
                aliases = prop_meta["aliases"]
                expected_type = prop_meta["expected_type"]

                # Calculate match score across aliases
                for alias in aliases:
                    norm_alias = self._normalize_name(alias)

                    # Exact match
                    if norm_col == norm_alias:
                        score = 1.0
                    # Substring containment
                    elif norm_alias in norm_col or norm_col in norm_alias:
                        score = 0.85
                    # Sequence fuzzy ratio
                    else:
                        score = SequenceMatcher(None, norm_col, norm_alias).ratio()

                    # Type compatibility boost or penalty
                    if score >= 0.60:
                        if detected_type == expected_type:
                            score = min(1.0, score + 0.10)
                        elif expected_type == ColumnType.STRING:
                            # Any type can map to string without major penalty
                            pass
                        else:
                            score = max(0.0, score - 0.15)

                    if score > best_score:
                        best_score = score
                        best_entity = entity_type
                        best_property = prop_name

        if best_score >= 0.65:
            return best_entity, best_property, round(best_score, 2)
        return None, None, 0.0

    # 3. Pre-Flight Validation Report & >50% Null Rejection
    def validate_dataframe(self, df: pl.DataFrame) -> PreflightValidationReport:
        """
        Perform comprehensive pre-flight validation on a Polars DataFrame.

        Validates:
          - Column data types and distributions
          - Null percentages against max_null_pct (default 50.0%)
          - Unique value cardinalities
          - Ontology property mapping suggestions
          - Rejection of datasets violating quality thresholds
        """
        total_rows = df.height
        total_cols = df.width
        columns_report: List[ColumnValidationReport] = []
        rejected_cols: List[str] = []
        entity_votes: Dict[str, float] = {}

        if total_rows == 0:
            return PreflightValidationReport(
                is_valid=False,
                total_rows=0,
                total_columns=total_cols,
                columns=[],
                rejected_columns=[],
                error_message="Dataset is empty (0 rows). Ingest validation failed.",
            )

        for col_name in df.columns:
            # Extract sample values (up to 5,000 for fast type inference)
            sample_series = df[col_name].head(5000)
            raw_values = sample_series.to_list()

            # Null count across whole dataframe
            is_str_col = df.schema[col_name] in (pl.Utf8, pl.String)
            if is_str_col:
                null_count = df.select(
                    (pl.col(col_name).is_null() | (pl.col(col_name).str.strip_chars() == "")).sum()
                ).item()
            else:
                null_count = df.select(pl.col(col_name).is_null().sum()).item()

            null_pct = round((null_count / total_rows) * 100.0, 2)

            # Unique count
            try:
                unique_count = df.select(pl.col(col_name).n_unique()).item()
            except Exception:
                unique_count = len(set(str(v) for v in raw_values if not self._is_null_or_empty(v)))
            unique_pct = round((unique_count / total_rows) * 100.0, 2)

            # Detect type
            detected_type, type_dist = self.detect_column_type(raw_values)

            # Ontology suggestions
            sugg_entity, sugg_prop, conf = self.suggest_ontology_mapping(col_name, detected_type)
            if sugg_entity and conf >= 0.70:
                entity_votes[sugg_entity] = entity_votes.get(sugg_entity, 0.0) + conf

            # Sample values for preview (up to 5 non-null values)
            non_null_samples = [v for v in raw_values if not self._is_null_or_empty(v)][:5]

            # Rejection check (>50% null)
            is_rejected = null_pct > self.max_null_pct
            rejection_reason = (
                f"Column '{col_name}' has {null_pct:.1f}% null values, exceeding the maximum allowable threshold of {self.max_null_pct:.1f}%."
                if is_rejected
                else None
            )

            if is_rejected:
                rejected_cols.append(col_name)

            columns_report.append(
                ColumnValidationReport(
                    column_name=col_name,
                    detected_type=detected_type.value,
                    total_count=total_rows,
                    null_count=null_count,
                    null_percentage=null_pct,
                    unique_count=unique_count,
                    unique_percentage=unique_pct,
                    type_distribution=type_dist,
                    sample_values=non_null_samples,
                    is_rejected=is_rejected,
                    rejection_reason=rejection_reason,
                    suggested_property=sugg_prop,
                    suggested_entity_type=sugg_entity,
                    mapping_confidence=conf,
                )
            )

        # Primary entity type calculation
        primary_entity: Optional[str] = None
        entity_conf = 0.0
        if entity_votes:
            sorted_votes = sorted(entity_votes.items(), key=lambda x: x[1], reverse=True)
            primary_entity, total_weight = sorted_votes[0]
            entity_conf = round(min(1.0, total_weight / max(1, len(columns_report))), 2)

        # Overall validity
        is_valid = len(rejected_cols) == 0
        error_msg = None
        if not is_valid:
            col_list_str = ", ".join(f"'{c}'" for c in rejected_cols)
            error_msg = (
                f"File rejected: Columns ({col_list_str}) exceed the maximum allowable null threshold of {self.max_null_pct:.1f}%."
            )

        return PreflightValidationReport(
            is_valid=is_valid,
            total_rows=total_rows,
            total_columns=total_cols,
            columns=columns_report,
            rejected_columns=rejected_cols,
            error_message=error_msg,
            suggested_entity_type=primary_entity,
            entity_confidence=entity_conf,
        )

    # 4. Multi-Format Byte & Stream Ingestion Parser
    def validate_file_bytes(
        self,
        data: bytes,
        file_name: str = "upload.csv",
    ) -> PreflightValidationReport:
        """
        Parse raw file bytes (CSV, JSON, NDJSON, Parquet, or Excel) and validate schema.
        """
        ext = file_name.split(".")[-1].lower() if "." in file_name else "csv"
        bio = io.BytesIO(data)

        try:
            if ext in ("csv", "txt", "tsv"):
                separator = "\t" if ext == "tsv" else ","
                df = pl.read_csv(
                    bio,
                    separator=separator,
                    infer_schema_length=5000,
                    ignore_errors=True,
                    truncate_ragged_lines=True,
                )
            elif ext in ("json", "ndjson", "jsonl"):
                try:
                    df = pl.read_json(bio)
                except Exception:
                    bio.seek(0)
                    df = pl.read_ndjson(bio)
            elif ext in ("parquet", "pq"):
                df = pl.read_parquet(bio)
            elif ext in ("xlsx", "xls"):
                df = pl.read_excel(bio)
            else:
                # Default CSV fallback
                df = pl.read_csv(bio, ignore_errors=True, infer_schema_length=5000)
        except Exception as exc:
            return PreflightValidationReport(
                is_valid=False,
                total_rows=0,
                total_columns=0,
                columns=[],
                rejected_columns=[],
                error_message=f"Failed to parse file '{file_name}': {str(exc)}",
            )

        return self.validate_dataframe(df)


# Singleton factory helper
_default_detector: Optional[SchemaDetector] = None


def get_schema_detector() -> SchemaDetector:
    """Return singleton instance of SchemaDetector."""
    global _default_detector
    if _default_detector is None:
        _default_detector = SchemaDetector()
    return _default_detector
