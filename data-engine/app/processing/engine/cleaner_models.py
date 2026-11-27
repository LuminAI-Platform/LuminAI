"""Models and result data structures for the DatasetCleaner engine."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List

from app.processing.engine.golden_record_engine import GoldenRecordOutput
from app.processing.engine.profiler import DatasetProfileReport, ProfilingDeltaReport
from app.processing.engine.quality_framework import DatasetQualityAssessment


@dataclass
class CleanedRecord:
    """A standardized, audited record ready for operational use."""
    record_id: str
    canonical_name: str
    entity_type: str
    quality_state: str  # "VERIFIED", "NEEDS_REVIEW", "REJECTED"
    quality_score: float
    confidence_score: float
    attributes: Dict[str, Any]
    original_attributes: Dict[str, Any]
    validation_errors: List[str] = field(default_factory=list)
    validation_warnings: List[str] = field(default_factory=list)
    transformations_count: int = 0


@dataclass
class DatasetCleaningResult:
    """Complete output package of the LuminAI Data Engine."""
    run_id: str
    tenant_id: str
    source_id: str
    total_raw_records: int
    total_clean_records: int
    duplicates_merged: int
    verified_records_count: int
    needs_review_count: int
    rejected_records_count: int
    records: List[CleanedRecord]
    golden_records: List[GoldenRecordOutput]
    review_candidates: List[Dict[str, Any]]
    quarantined_records: List[Dict[str, Any]]
    profile_before: DatasetProfileReport
    profile_after: DatasetProfileReport
    profiling_delta: ProfilingDeltaReport
    quality_assessment: DatasetQualityAssessment
    columns: List[str]

    @property
    def rejected_count(self) -> int:
        return self.rejected_records_count

    @property
    def verified_count(self) -> int:
        return self.verified_records_count

    @property
    def data_quality_score(self) -> float:
        return self.quality_assessment.dimension_scores.overall_score

    @property
    def profiling_report(self) -> Dict[str, Any]:
        return self.profiling_delta.to_dict()

    def to_api_response(self, include_golden_records: bool = True) -> Dict[str, Any]:
        """Formats the result for the REST API and React Clean Data View."""
        flat_rows = []
        for r in self.records:
            row_dict = {
                "id": r.record_id,
                "canonicalName": r.canonical_name,
                "entityType": r.entity_type,
                "qualityState": r.quality_state,
                "qualityScore": r.quality_score,
                "confidenceScore": r.confidence_score,
                "_validationErrors": r.validation_errors,
                "_validationWarnings": r.validation_warnings,
                **r.attributes,
            }
            flat_rows.append(row_dict)

        cols = list(self.columns)
        for standard_col in ("qualityState", "qualityScore", "confidenceScore"):
            if standard_col not in cols:
                cols.insert(2, standard_col)

        return {
            "connectionId": self.source_id,
            "runId": self.run_id,
            "totalRawRecords": self.total_raw_records,
            "totalCleanRecords": self.total_clean_records,
            "duplicatesMerged": self.duplicates_merged,
            "verifiedRecords": self.verified_records_count,
            "needsReviewRecords": self.needs_review_count,
            "rejectedRecords": self.rejected_records_count,
            "dataQualityScore": self.quality_assessment.dimension_scores.overall_score,
            "qualityBreakdown": self.quality_assessment.dimension_scores.to_dict(),
            "status": "COMPLETED",
            "columns": cols,
            "rows": flat_rows,
            "goldenRecords": (
                [gr.to_dict() for gr in self.golden_records]
                if include_golden_records
                else []
            ),
            "profilingDelta": self.profiling_delta.to_dict(),
        }
