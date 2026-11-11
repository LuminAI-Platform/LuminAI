"""Automated schema detection, fuzzy ontology mapping, and pre-flight data quality validator."""

from __future__ import annotations

import io
import logging
import re
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Tuple

import polars as pl

from app.processing.schema_detector.models import (
    MAX_NULL_PERCENTAGE_THRESHOLD,
    ColumnType,
    ColumnValidationReport,
    PreflightValidationReport,
)
from app.processing.schema_detector.ontology import ONTOLOGY_REGISTRY
from app.processing.schema_detector.type_parsers import (
    is_null_or_empty,
    try_parse_boolean,
    try_parse_date,
    try_parse_email,
    try_parse_number,
    try_parse_phone,
)

logger = logging.getLogger(__name__)


class SchemaDetector:
    """Automated schema detection, fuzzy ontology mapping, and pre-flight data quality validator."""

    def __init__(self, max_null_pct: float = MAX_NULL_PERCENTAGE_THRESHOLD):
        self.max_null_pct = max_null_pct

    # Type Detection Helpers (re-exported on class for compatibility)
    _is_null_or_empty = staticmethod(is_null_or_empty)
    _try_parse_number = staticmethod(try_parse_number)
    _try_parse_boolean = staticmethod(try_parse_boolean)
    _try_parse_email = staticmethod(try_parse_email)
    _try_parse_date = staticmethod(try_parse_date)
    _try_parse_phone = staticmethod(try_parse_phone)

    def detect_column_type(
        self, raw_values: List[Any]
    ) -> Tuple[ColumnType, Dict[str, float]]:
        """Analyze a list of values to determine the predominant column type and type distribution."""
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
        dist["null"] = (
            round(((total_count - non_null_count) / total_count) * 100.0, 2)
            if total_count > 0
            else 0.0
        )

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
        """Suggest ontology property mapping based on column name fuzzy matching and type alignment."""
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
    def validate_dataframe(
        self,
        df: pl.DataFrame,
        max_null_pct: Optional[float] = None,
    ) -> PreflightValidationReport:
        """Perform comprehensive pre-flight validation on a Polars DataFrame."""
        threshold = max_null_pct if max_null_pct is not None else self.max_null_pct
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
                    (
                        pl.col(col_name).is_null()
                        | (pl.col(col_name).str.strip_chars() == "")
                    ).sum()
                ).item()
            else:
                null_count = df.select(pl.col(col_name).is_null().sum()).item()

            null_pct = round((null_count / total_rows) * 100.0, 2)

            # Unique count
            try:
                unique_count = df.select(pl.col(col_name).n_unique()).item()
            except Exception:
                unique_count = len(
                    set(str(v) for v in raw_values if not self._is_null_or_empty(v))
                )
            unique_pct = round((unique_count / total_rows) * 100.0, 2)

            # Detect type
            detected_type, type_dist = self.detect_column_type(raw_values)

            # Ontology suggestions
            sugg_entity, sugg_prop, conf = self.suggest_ontology_mapping(
                col_name, detected_type
            )
            if sugg_entity and conf >= 0.70:
                entity_votes[sugg_entity] = entity_votes.get(sugg_entity, 0.0) + conf

            # Sample values for preview (up to 5 non-null values)
            non_null_samples = [v for v in raw_values if not self._is_null_or_empty(v)][
                :5
            ]

            # Rejection check against threshold
            is_rejected = null_pct > threshold
            rejection_reason = (
                f"Column '{col_name}' has {null_pct:.1f}% null values, exceeding the maximum allowable threshold of {threshold:.1f}%."
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
            sorted_votes = sorted(
                entity_votes.items(), key=lambda x: x[1], reverse=True
            )
            primary_entity, total_weight = sorted_votes[0]
            entity_conf = round(min(1.0, total_weight / max(1, len(columns_report))), 2)

        # Overall validity
        is_valid = len(rejected_cols) == 0
        error_msg = None
        if not is_valid:
            col_list_str = ", ".join(f"'{c}'" for c in rejected_cols)
            error_msg = f"File rejected: Columns ({col_list_str}) exceed the maximum allowable null threshold of {threshold:.1f}%."

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
        max_null_pct: Optional[float] = None,
    ) -> PreflightValidationReport:
        """Parse raw file bytes (CSV, JSON, NDJSON, Parquet, or Excel) and validate schema."""
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

        return self.validate_dataframe(df, max_null_pct=max_null_pct)


# Singleton factory helper
_default_detector: Optional[SchemaDetector] = None


def get_schema_detector() -> SchemaDetector:
    """Return singleton instance of SchemaDetector."""
    global _default_detector
    if _default_detector is None:
        _default_detector = SchemaDetector()
    return _default_detector
