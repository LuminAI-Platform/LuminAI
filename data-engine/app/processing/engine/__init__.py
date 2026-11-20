"""Production enterprise data processing engine package for LuminAI.

Exports:
  - TypeInferenceEngine, InferredType
  - DateCleaner, DateCleanResult
  - TextCleaner, TextCleanResult
  - NameStandardizer, NameStandardizationResult
  - CategoricalStandardizer, CategoricalResult
  - IdentifierCleaner, IdentifierResult
  - DataProfiler, DatasetProfileReport, ProfilingDeltaReport
  - MultiStageEntityResolver, MatchEvidence
  - GoldenRecordEngine, GoldenRecordOutput, FieldProvenance
  - DataQualityFramework, DatasetQualityAssessment, RecordQualityAssessment
  - LineageTracker, RecordAuditTrail
  - DatasetCleaner, DatasetCleaningResult, CleanedRecord
"""

from app.processing.engine.categorical_standardizer import (
    CategoricalResult,
    CategoricalStandardizer,
)
from app.processing.engine.date_cleaner import DateCleaner, DateCleanResult
from app.processing.engine.dataset_cleaner import (
    CleanedRecord,
    DatasetCleaner,
    DatasetCleaningResult,
)
from app.processing.engine.deduplicator import (
    MatchDecision,
    MatchEvidence,
    MatchState,
    MergeRecordProvenance,
    MultiStageEntityResolver,
)
from app.processing.engine.golden_record_engine import (
    FieldProvenance,
    GoldenRecordEngine,
    GoldenRecordOutput,
)
from app.processing.engine.identifier_cleaner import (
    IdentifierCleaner,
    IdentifierResult,
)
from app.processing.engine.lineage import (
    LineageTracker,
    RecordAuditTrail,
    TransformationStep,
)
from app.processing.engine.name_standardizer import (
    NameStandardizer,
    NameStandardizationResult,
)
from app.processing.engine.profiler import (
    ColumnProfile,
    DataProfiler,
    DatasetProfileReport,
    ProfilingDeltaReport,
)
from app.processing.engine.quality_framework import (
    DataQualityFramework,
    DatasetQualityAssessment,
    QualityDimensionScores,
    RecordQualityAssessment,
)
from app.processing.engine.text_cleaner import TextCleaner, TextCleanResult
from app.processing.engine.type_inference import (
    ColumnTypeProfile,
    ConversionResult,
    InferredType,
    TypeInferenceEngine,
)

__all__ = [
    "TypeInferenceEngine",
    "InferredType",
    "ConversionResult",
    "ColumnTypeProfile",
    "DateCleaner",
    "DateCleanResult",
    "TextCleaner",
    "TextCleanResult",
    "NameStandardizer",
    "NameStandardizationResult",
    "CategoricalStandardizer",
    "CategoricalResult",
    "IdentifierCleaner",
    "IdentifierResult",
    "DataProfiler",
    "ColumnProfile",
    "DatasetProfileReport",
    "ProfilingDeltaReport",
    "MultiStageEntityResolver",
    "MatchDecision",
    "MatchState",
    "MatchEvidence",
    "MergeRecordProvenance",
    "GoldenRecordEngine",
    "GoldenRecordOutput",
    "FieldProvenance",
    "DataQualityFramework",
    "QualityDimensionScores",
    "RecordQualityAssessment",
    "DatasetQualityAssessment",
    "LineageTracker",
    "RecordAuditTrail",
    "TransformationStep",
    "DatasetCleaner",
    "DatasetCleaningResult",
    "CleanedRecord",
]
