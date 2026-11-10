"""Ingestion pipeline input validation, schema auto-detection, and ontology property mapping.

Decomposed into:
  - models.py   → Report containers, ColumnType enum, and regex constants
  - ontology.py → ONTOLOGY_REGISTRY property aliases and expected types
  - detector.py → SchemaDetector core inference, byte parsing, and quality validation

All classes, constants, and helper singletons are re-exported at package root.
"""

from app.processing.schema_detector.detector import (
    SchemaDetector,
    get_schema_detector,
)
from app.processing.schema_detector.models import (
    BOOLEAN_TERMS,
    COMMON_DATE_FORMATS,
    EMAIL_REGEX,
    MAX_NULL_PERCENTAGE_THRESHOLD,
    PHONE_REGEX,
    ColumnType,
    ColumnValidationReport,
    PreflightValidationReport,
)
from app.processing.schema_detector.ontology import ONTOLOGY_REGISTRY

__all__ = [
    # Models & enums
    "ColumnType",
    "ColumnValidationReport",
    "PreflightValidationReport",
    # Constants & regexes
    "MAX_NULL_PERCENTAGE_THRESHOLD",
    "EMAIL_REGEX",
    "PHONE_REGEX",
    "BOOLEAN_TERMS",
    "COMMON_DATE_FORMATS",
    # Registry
    "ONTOLOGY_REGISTRY",
    # Detector
    "SchemaDetector",
    "get_schema_detector",
]
