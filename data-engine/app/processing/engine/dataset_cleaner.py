"""Production master dataset cleaning, standardization, and quality remediation orchestrator.

Coordinates the end-to-end data lifecycle:
  Raw Data → Profiling (Before) → Cleaning & Normalization → Quality Assessment →
  Deduplication & Entity Resolution → Golden Record Generation → Profiling (After) → Lineage.

Works across any domain, schema, or dataset (enterprise, healthcare/hospital patients, financial, CRM).
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set

import polars as pl

from app.processing.engine.categorical_standardizer import CategoricalStandardizer
from app.processing.engine.date_cleaner import DateCleaner
from app.processing.engine.deduplicator import MultiStageEntityResolver
from app.processing.engine.golden_record_engine import GoldenRecordEngine, GoldenRecordOutput
from app.processing.engine.identifier_cleaner import IdentifierCleaner
from app.processing.engine.lineage import LineageTracker
from app.processing.engine.name_standardizer import NameStandardizer
from app.processing.engine.profiler import DataProfiler, DatasetProfileReport, ProfilingDeltaReport
from app.processing.engine.quality_framework import DataQualityFramework, DatasetQualityAssessment
from app.processing.engine.text_cleaner import TextCleaner
from app.processing.engine.type_inference import TypeInferenceEngine

logger = logging.getLogger(__name__)


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

    def to_api_response(self) -> Dict[str, Any]:
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
            "goldenRecords": [gr.to_dict() for gr in self.golden_records],
            "profilingDelta": self.profiling_delta.to_dict(),
        }


class DatasetCleaner:
    """Master engine orchestrating data cleaning, profiling, ER, and quality assessment."""

    def __init__(
        self,
        tenant_id: str = "acme",
        source_id: str = "dataset",
        run_id: Optional[str] = None,
    ):
        self.tenant_id = tenant_id
        self.source_id = source_id
        self.run_id = run_id or str(uuid.uuid4())

        self.profiler = DataProfiler()
        self.type_engine = TypeInferenceEngine()
        self.categorical_standardizer = CategoricalStandardizer()
        self.golden_engine = GoldenRecordEngine()
        self.lineage = LineageTracker(run_id=self.run_id, tenant_id=self.tenant_id)

    def clean_file(
        self,
        file_path: str,
        entity_type_hint: Optional[str] = None,
        mandatory_fields: Optional[Set[str]] = None,
    ) -> DatasetCleaningResult:
        """Loads and processes a CSV, Parquet, or JSON file."""
        if file_path.endswith(".parquet"):
            df = pl.read_parquet(file_path)
        elif file_path.endswith(".json"):
            df = pl.read_json(file_path)
        else:
            try:
                df = pl.read_csv(file_path, ignore_errors=True)
            except Exception:
                import pandas as pd
                pdf = pd.read_csv(file_path, encoding_errors="replace")
                df = pl.from_pandas(pdf)
        return self.process_dataframe(df, entity_type_hint, mandatory_fields)

    def process_dataframe(
        self,
        df: pl.DataFrame,
        entity_type_hint: Optional[str] = None,
        mandatory_fields: Optional[Set[str]] = None,
    ) -> DatasetCleaningResult:
        """Executes full data cleaning and standardization pipeline on a Polars DataFrame."""
        total_rows = df.height
        logger.info("Starting production dataset cleaning pipeline on %d rows", total_rows)

        # ─── 1. Profiling (Before Cleaning) ───────────────────────────────────
        profile_before = self.profiler.profile_dataset(df, stage="BEFORE_CLEANING")

        # Establish column types and format hints
        column_date_hints: Dict[str, Optional[str]] = {}
        for col in df.columns:
            vals = df[col].to_list()
            hint = DateCleaner.infer_column_date_format(vals)
            column_date_hints[col] = hint

        # ─── 2. Row-by-Row Cleaning & Normalization ───────────────────────────
        cleaned_records_list: List[CleanedRecord] = []
        raw_dicts = df.to_dicts()

        for idx, raw_row in enumerate(raw_dicts):
            rec_id = str(
                raw_row.get("record_id")
                or raw_row.get("id")
                or raw_row.get("mrn")
                or raw_row.get("raw_id")
                or f"rec-{idx+1:04d}"
            )
            audit = self.lineage.start_record(rec_id, self.source_id, raw_row)

            cleaned_attrs: Dict[str, Any] = {}
            validation_errors: List[str] = []
            validation_warnings: List[str] = []
            transformations_count = 0

            # Step 2a: Standardize each field
            for col_name, raw_val in raw_row.items():
                if col_name.startswith("_"):
                    continue

                col_lower = col_name.lower().replace("_", "").replace("-", "")

                # 1. Null handling & type inference
                if self.type_engine.is_null_value(raw_val):
                    cleaned_attrs[col_name] = None
                    if raw_val is not None and str(raw_val).strip() != "":
                        audit.add_transformation(col_name, raw_val, None, "NULL_SENTINEL_NORMALIZATION", "NULL_HANDLING")
                        transformations_count += 1
                    continue

                # 2. Text cleaning (mojibake, control chars, html strip, formula neutralize)
                t_res = TextCleaner.clean_text(raw_val)
                current_val = t_res.cleaned_text
                if t_res.is_modified:
                    audit.add_transformation(col_name, raw_val, current_val, "TEXT_SANITIZATION", "ENCODING")
                    transformations_count += 1

                # 3. Date & time cleaning
                if (
                    "date" in col_lower
                    or col_lower in ("dob", "birth", "birthday", "birthdate", "joinedat", "createdat", "admitted")
                ):
                    d_hint = column_date_hints.get(col_name)
                    d_res = DateCleaner.clean_date(current_val, field_name=col_name, column_format_hint=d_hint)
                    if d_res.is_valid:
                        cleaned_attrs[col_name] = d_res.iso_date
                        if d_res.iso_date != current_val:
                            audit.add_transformation(col_name, current_val, d_res.iso_date, "DATE_STANDARDIZED", "DATE_CLEANING")
                            transformations_count += 1
                        if d_res.is_ambiguous:
                            validation_warnings.append(f"Field '{col_name}' date '{raw_val}' is ambiguous")
                    else:
                        cleaned_attrs[col_name] = current_val  # Keep original value for inspection
                        validation_errors.append(f"Field '{col_name}': {d_res.error}")
                    continue

                # 4. Name standardization
                if col_lower in ("name", "fullname", "patientname", "customername", "personname", "contactname"):
                    n_res = NameStandardizer.standardize_name(current_val)
                    cleaned_attrs[col_name] = n_res.normalized_name
                    if n_res.normalized_name != current_val:
                        audit.add_transformation(col_name, current_val, n_res.normalized_name, "NAME_STANDARDIZED", "NAME")
                        transformations_count += 1
                    if n_res.needs_review:
                        validation_warnings.append(f"Field '{col_name}': {n_res.review_reason}")
                    continue

                # 5. Identifier validation
                if col_lower in ("mrn", "nationalid", "ssn", "taxid", "idnumber", "customerid"):
                    id_res = IdentifierCleaner.clean_identifier(current_val, id_type=col_lower)
                    cleaned_attrs[col_name] = id_res.normalized_id or current_val
                    if id_res.transformation:
                        audit.add_transformation(col_name, current_val, id_res.normalized_id, "IDENTIFIER_STANDARDIZED", "IDENTIFIER")
                        transformations_count += 1
                    if not id_res.is_valid:
                        validation_errors.append(f"Field '{col_name}': {id_res.error}")
                    continue

                # 6. Categorical standardization (Gender, Country, City, Status)
                if col_lower in ("gender", "sex"):
                    c_res = self.categorical_standardizer.standardize_gender(current_val)
                    cleaned_attrs[col_name] = c_res.canonical_value
                    if c_res.transformation:
                        audit.add_transformation(col_name, current_val, c_res.canonical_value, "GENDER_CANONICALIZED", "CATEGORICAL")
                        transformations_count += 1
                    if c_res.needs_review:
                        validation_warnings.append(f"Field '{col_name}': {c_res.review_reason}")
                    continue

                if col_lower in ("country", "nation", "nationality"):
                    c_res = self.categorical_standardizer.standardize_country(current_val)
                    cleaned_attrs[col_name] = c_res.canonical_value
                    if c_res.transformation:
                        audit.add_transformation(col_name, current_val, c_res.canonical_value, "COUNTRY_CANONICALIZED", "CATEGORICAL")
                        transformations_count += 1
                    if c_res.needs_review:
                        validation_warnings.append(f"Field '{col_name}': {c_res.review_reason}")
                    continue

                if col_lower in ("city", "town", "region"):
                    c_res = self.categorical_standardizer.standardize_city(current_val)
                    cleaned_attrs[col_name] = c_res.canonical_value
                    if c_res.transformation:
                        audit.add_transformation(col_name, current_val, c_res.canonical_value, "CITY_STANDARDIZED", "CATEGORICAL")
                        transformations_count += 1
                    if c_res.needs_review:
                        validation_warnings.append(f"Field '{col_name}': {c_res.review_reason}")
                    continue

                if col_lower in ("status", "riskrating", "risklevel", "priority"):
                    c_res = self.categorical_standardizer.standardize_status(current_val)
                    cleaned_attrs[col_name] = c_res.canonical_value
                    if c_res.transformation:
                        audit.add_transformation(col_name, current_val, c_res.canonical_value, "STATUS_CANONICALIZED", "CATEGORICAL")
                        transformations_count += 1
                    if c_res.needs_review:
                        validation_warnings.append(f"Field '{col_name}': {c_res.review_reason}")
                    continue

                # Default field value
                cleaned_attrs[col_name] = current_val

            # Step 2b: Evaluate record-level quality
            qa = DataQualityFramework.evaluate_record(
                record=cleaned_attrs,
                record_id=rec_id,
                mandatory_fields=mandatory_fields,
            )

            # Combine errors & warnings
            all_errors = list(set(validation_errors + qa.critical_errors))
            all_warnings = list(set(validation_warnings + qa.warnings))

            # Quality State Resolution
            if all_errors:
                quality_state = "REJECTED" if any("invalid calendar date" in e or "in the future" in e or "Missing mandatory" in e for e in all_errors) else "NEEDS_REVIEW"
            elif all_warnings:
                quality_state = "NEEDS_REVIEW"
            else:
                quality_state = "VERIFIED"

            # Determine canonical name
            c_name = (
                str(cleaned_attrs.get("name") or cleaned_attrs.get("full_name") or cleaned_attrs.get("canonical_name") or rec_id).strip()
            )

            audit.cleaned_payload = cleaned_attrs
            audit.quality_state = quality_state
            audit.quality_score = qa.quality_score
            audit.validation_errors = all_errors
            audit.validation_warnings = all_warnings

            cleaned_records_list.append(
                CleanedRecord(
                    record_id=rec_id,
                    canonical_name=c_name,
                    entity_type=entity_type_hint or "Person",
                    quality_state=quality_state,
                    quality_score=qa.quality_score,
                    confidence_score=1.0,
                    attributes=cleaned_attrs,
                    original_attributes=raw_row,
                    validation_errors=all_errors,
                    validation_warnings=all_warnings,
                    transformations_count=transformations_count,
                )
            )

        # ─── 3. Deduplication & Entity Resolution ─────────────────────────────
        review_candidates: List[Dict[str, Any]] = []
        clusters: List[List[Dict[str, Any]]] = []
        used_indices: Set[int] = set()

        records_data = [
            {"id": r.record_id, **r.attributes, "_idx": i, "_qualityState": r.quality_state}
            for i, r in enumerate(cleaned_records_list)
        ]

        # Inverted Blocking Index for high-throughput entity resolution
        blocks: Dict[str, List[int]] = {}
        for idx, rec in enumerate(records_data):
            idents = MultiStageEntityResolver.extract_identifiers(rec)
            for itype, ival in idents.items():
                if ival:
                    blocks.setdefault(f"id:{itype}:{ival}", []).append(idx)

            raw_name = str(rec.get("name") or rec.get("full_name") or "").strip().lower()
            if len(raw_name) >= 3:
                blocks.setdefault(f"nam:{raw_name[:4]}", []).append(idx)

            raw_email = str(rec.get("email") or rec.get("contact_email") or "").strip().lower()
            if "@" in raw_email:
                uname = raw_email.split("@")[0]
                if len(uname) >= 3:
                    blocks.setdefault(f"eml:{uname}", []).append(idx)

            raw_dob = str(rec.get("dob") or rec.get("date_of_birth") or rec.get("birth_date") or "").strip()
            if len(raw_dob) >= 4:
                blocks.setdefault(f"dob:{raw_dob[:10]}", []).append(idx)

        # Build candidate pairs from inverted blocks
        candidate_pairs_map: Dict[int, Set[int]] = {i: set() for i in range(len(records_data))}
        for bkey, idx_list in blocks.items():
            if 1 < len(idx_list) < 200:
                for a_pos in range(len(idx_list)):
                    ia = idx_list[a_pos]
                    for b_pos in range(a_pos + 1, len(idx_list)):
                        ib = idx_list[b_pos]
                        candidate_pairs_map[min(ia, ib)].add(max(ia, ib))

        # Evaluate blocked candidate pairs
        for i in range(len(records_data)):
            if i in used_indices:
                continue

            current_cluster = [records_data[i]]
            used_indices.add(i)

            potential_matches = candidate_pairs_map.get(i, set())
            for j in sorted(potential_matches):
                if j in used_indices:
                    continue

                evidence = MultiStageEntityResolver.evaluate_pair(records_data[i], records_data[j])

                if evidence.decision in ("CONFIRMED_DUPLICATE", "PROBABLE_DUPLICATE"):
                    current_cluster.append(records_data[j])
                    used_indices.add(j)
                    self.lineage.log_merge(
                        lead_record_id=records_data[i]["id"],
                        merged_record_id=records_data[j]["id"],
                        confidence_score=evidence.overall_confidence,
                        rules_triggered=evidence.matched_rules,
                        reason=evidence.notes or "High multi-attribute similarity",
                    )
                elif evidence.decision == "POSSIBLE_MATCH":
                    review_candidates.append({
                        "candidate_pair": (records_data[i]["id"], records_data[j]["id"]),
                        "confidence_score": evidence.overall_confidence,
                        "matched_rules": evidence.matched_rules,
                        "reason": evidence.notes,
                        "record_a": records_data[i],
                        "record_b": records_data[j],
                    })

            clusters.append(current_cluster)

        # ─── 4. Golden Record Generation ──────────────────────────────────────
        golden_records: List[GoldenRecordOutput] = []
        duplicates_merged_count = 0

        for clus in clusters:
            if len(clus) > 1:
                duplicates_merged_count += (len(clus) - 1)

            gr = self.golden_engine.build_golden_record(
                cluster_records=clus,
                tenant_id=self.tenant_id,
                entity_type=entity_type_hint or "Person",
            )
            golden_records.append(gr)

        # ─── 5. Profiling (After Cleaning) ────────────────────────────────────
        clean_dicts = [r.attributes for r in cleaned_records_list]
        clean_df = pl.DataFrame(clean_dicts) if clean_dicts else pl.DataFrame()
        profile_after = self.profiler.profile_dataset(clean_df, stage="AFTER_CLEANING")

        # ─── 6. Quality Assessment & Delta Summary ────────────────────────────
        verified_cnt = sum(1 for r in cleaned_records_list if r.quality_state == "VERIFIED")
        review_cnt = sum(1 for r in cleaned_records_list if r.quality_state == "NEEDS_REVIEW")
        rejected_cnt = sum(1 for r in cleaned_records_list if r.quality_state == "REJECTED")

        qa_dataset = DataQualityFramework.evaluate_dataset(
            records=[r.attributes for r in cleaned_records_list],
            mandatory_fields=mandatory_fields,
        )

        delta_report = self.profiler.generate_delta_report(
            before=profile_before,
            after=profile_after,
            rows_valid=verified_cnt + review_cnt,
            rows_quarantined=rejected_cnt,
            duplicates_merged=duplicates_merged_count,
        )

        quarantined = [
            {"record_id": r.record_id, "errors": r.validation_errors, "payload": r.original_attributes}
            for r in cleaned_records_list
            if r.quality_state == "REJECTED"
        ]

        return DatasetCleaningResult(
            run_id=self.run_id,
            tenant_id=self.tenant_id,
            source_id=self.source_id,
            total_raw_records=total_rows,
            total_clean_records=len(cleaned_records_list),
            duplicates_merged=duplicates_merged_count,
            verified_records_count=verified_cnt,
            needs_review_count=review_cnt,
            rejected_records_count=rejected_cnt,
            records=cleaned_records_list,
            golden_records=golden_records,
            review_candidates=review_candidates,
            quarantined_records=quarantined,
            profile_before=profile_before,
            profile_after=profile_after,
            profiling_delta=delta_report,
            quality_assessment=qa_dataset,
            columns=df.columns,
        )
