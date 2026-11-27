"""Production master dataset cleaning, standardization, and quality remediation orchestrator.

Coordinates the end-to-end data lifecycle:
  Raw Data → Profiling (Before) → Cleaning & Normalization → Quality Assessment →
  Deduplication & Entity Resolution → Golden Record Generation → Profiling (After) → Lineage.

Works across any domain, schema, or dataset (enterprise, healthcare/hospital patients, financial, CRM).
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, List, Optional, Set

import polars as pl

from app.processing.engine.categorical_standardizer import CategoricalStandardizer
from app.processing.engine.cleaner_models import CleanedRecord, DatasetCleaningResult
from app.processing.engine.date_cleaner import DateCleaner
from app.processing.engine.deduplicator import MultiStageEntityResolver
from app.processing.engine.golden_record_engine import GoldenRecordEngine, GoldenRecordOutput
from app.processing.engine.identifier_cleaner import IdentifierCleaner
from app.processing.engine.lineage import LineageTracker
from app.processing.engine.name_standardizer import NameStandardizer
from app.processing.engine.profiler import DataProfiler
from app.processing.engine.quality_framework import DataQualityFramework, RecordQualityAssessment
from app.processing.engine.text_cleaner import TextCleaner
from app.processing.engine.type_inference import TypeInferenceEngine

logger = logging.getLogger(__name__)

__all__ = ["CleanedRecord", "DatasetCleaningResult", "DatasetCleaner"]


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

    @staticmethod
    def _classify_column_role(col_name: str) -> str:
        """Classify column handling role once per DataFrame schema instead of per cell."""
        col_lower = col_name.lower().replace("_", "").replace("-", "")
        if "date" in col_lower or col_lower in (
            "dob",
            "birth",
            "birthday",
            "birthdate",
            "joinedat",
            "createdat",
            "admitted",
        ):
            return "date"
        if col_lower in (
            "name",
            "fullname",
            "canonicalname",
            "patientname",
            "customername",
            "personname",
            "contactname",
        ):
            return "name"
        if "email" in col_lower:
            return "email"
        if col_lower in (
            "mrn",
            "nationalid",
            "ssn",
            "taxid",
            "idnumber",
            "customerid",
            "entityid",
            "nationaltin",
        ):
            return "identifier"
        if col_lower in ("gender", "sex"):
            return "gender"
        if col_lower in ("country", "nation", "nationality"):
            return "country"
        if col_lower in ("city", "town", "region"):
            return "city"
        if col_lower in ("status", "riskrating", "risklevel", "priority"):
            return "status"
        return "text"

    @staticmethod
    def _resolve_quality_state(errors: List[str], warnings: List[str]) -> str:
        if errors:
            is_severe = any(
                "invalid calendar date" in e or "in the future" in e or "Missing mandatory" in e
                for e in errors
            )
            return "REJECTED" if is_severe else "NEEDS_REVIEW"
        if warnings:
            return "NEEDS_REVIEW"
        return "VERIFIED"

    def _clean_single_row(
        self,
        idx: int,
        raw_row: Dict[str, Any],
        column_roles: Dict[str, str],
        column_date_hints: Dict[str, Optional[str]],
        entity_type_hint: Optional[str],
        mandatory_fields: Optional[Set[str]],
    ) -> tuple[CleanedRecord, RecordQualityAssessment, bool]:
        explicit_id = raw_row.get("record_id") or raw_row.get("id") or raw_row.get("mrn") or raw_row.get("raw_id")
        rec_id = str(explicit_id or f"rec-{idx + 1:04d}")
        audit = self.lineage.start_record(rec_id, self.source_id, raw_row)

        cleaned_attrs: Dict[str, Any] = {}
        validation_errors: List[str] = []
        validation_warnings: List[str] = []
        transformations_count = 0

        for col_name, role in column_roles.items():
            raw_val = raw_row.get(col_name)
            if self.type_engine.is_null_value(raw_val):
                cleaned_attrs[col_name] = None
                if raw_val is not None and str(raw_val).strip() != "":
                    audit.add_transformation(col_name, raw_val, None, "NULL_SENTINEL_NORMALIZATION", "NULL_HANDLING")
                    transformations_count += 1
                continue

            t_res = TextCleaner.clean_text(raw_val)
            current_val = t_res.cleaned_text
            if t_res.is_modified:
                audit.add_transformation(col_name, raw_val, current_val, "TEXT_SANITIZATION", "ENCODING")
                transformations_count += 1

            if role == "date":
                d_res = DateCleaner.clean_date(current_val, field_name=col_name, column_format_hint=column_date_hints.get(col_name))
                if d_res.is_valid:
                    cleaned_attrs[col_name] = d_res.iso_date
                    if d_res.iso_date != current_val:
                        audit.add_transformation(col_name, current_val, d_res.iso_date, "DATE_STANDARDIZED", "DATE_CLEANING")
                        transformations_count += 1
                    if d_res.is_ambiguous:
                        validation_warnings.append(f"Field '{col_name}' date '{raw_val}' is ambiguous")
                else:
                    cleaned_attrs[col_name] = current_val
                    validation_errors.append(f"Field '{col_name}': {d_res.error}")
            elif role == "name":
                n_res = NameStandardizer.standardize_name(current_val)
                cleaned_attrs[col_name] = n_res.normalized_name
                if n_res.normalized_name != current_val:
                    audit.add_transformation(col_name, current_val, n_res.normalized_name, "NAME_STANDARDIZED", "NAME")
                    transformations_count += 1
                if n_res.needs_review:
                    validation_warnings.append(f"Field '{col_name}': {n_res.review_reason}")
            elif role == "email":
                norm_email = current_val.lower()
                cleaned_attrs[col_name] = norm_email
                if norm_email != current_val:
                    audit.add_transformation(col_name, current_val, norm_email, "EMAIL_NORMALIZED", "EMAIL")
                    transformations_count += 1
            elif role == "identifier":
                col_lower = col_name.lower().replace("_", "").replace("-", "")
                id_res = IdentifierCleaner.clean_identifier(current_val, id_type=col_lower)
                cleaned_attrs[col_name] = id_res.normalized_id or current_val
                if id_res.transformation:
                    audit.add_transformation(col_name, current_val, id_res.normalized_id, "IDENTIFIER_STANDARDIZED", "IDENTIFIER")
                    transformations_count += 1
                if not id_res.is_valid:
                    validation_errors.append(f"Field '{col_name}': {id_res.error}")
            elif role in ("gender", "country", "city", "status"):
                fn = getattr(self.categorical_standardizer, f"standardize_{role}")
                c_res = fn(current_val)
                cleaned_attrs[col_name] = c_res.canonical_value
                if c_res.transformation:
                    audit.add_transformation(col_name, current_val, c_res.canonical_value, f"{role.upper()}_CANONICALIZED", "CATEGORICAL")
                    transformations_count += 1
                if c_res.needs_review:
                    validation_warnings.append(f"Field '{col_name}': {c_res.review_reason}")
            else:
                cleaned_attrs[col_name] = current_val

        qa = DataQualityFramework.evaluate_record(
            record=cleaned_attrs,
            record_id=rec_id,
            mandatory_fields=mandatory_fields,
        )
        all_errors = list(set(validation_errors + qa.critical_errors))
        all_warnings = list(set(validation_warnings + qa.warnings))
        quality_state = self._resolve_quality_state(all_errors, all_warnings)
        c_name = str(
            cleaned_attrs.get("name")
            or cleaned_attrs.get("full_name")
            or cleaned_attrs.get("canonical_name")
            or rec_id
        ).strip()

        audit.cleaned_payload = cleaned_attrs
        audit.quality_state = quality_state
        audit.quality_score = qa.quality_score
        audit.validation_errors = all_errors
        audit.validation_warnings = all_warnings

        record = CleanedRecord(
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
        return record, qa, not bool(explicit_id)

    def _merge_cluster_record(
        self,
        idx_cluster: List[int],
        clus_recs: List[Dict[str, Any]],
        cleaned_records_list: List[CleanedRecord],
        entity_type_hint: Optional[str],
        mandatory_fields: Optional[Set[str]],
    ) -> tuple[CleanedRecord, RecordQualityAssessment, GoldenRecordOutput]:
        gr = self.golden_engine.build_golden_record(
            cluster_records=clus_recs,
            tenant_id=self.tenant_id,
            entity_type=entity_type_hint or "Person",
        )
        lead = cleaned_records_list[idx_cluster[0]]
        merged_attrs = dict(lead.attributes)
        merged_attrs.update(gr.attributes)

        qa = DataQualityFramework.evaluate_record(
            record=merged_attrs,
            record_id=lead.record_id,
            mandatory_fields=mandatory_fields,
        )
        all_errors = list(qa.critical_errors)
        all_warnings = list(qa.warnings)
        quality_state = self._resolve_quality_state(all_errors, all_warnings)
        c_name = str(
            merged_attrs.get("name")
            or merged_attrs.get("full_name")
            or merged_attrs.get("canonical_name")
            or gr.canonical_name
            or lead.record_id
        ).strip()
        tx_total = sum(cleaned_records_list[i].transformations_count for i in idx_cluster) + (len(idx_cluster) - 1)
        merged_record = CleanedRecord(
            record_id=lead.record_id,
            canonical_name=c_name,
            entity_type=entity_type_hint or lead.entity_type,
            quality_state=quality_state,
            quality_score=qa.quality_score,
            confidence_score=gr.confidence_score,
            attributes=merged_attrs,
            original_attributes=lead.original_attributes,
            validation_errors=all_errors,
            validation_warnings=all_warnings,
            transformations_count=tx_total,
        )
        return merged_record, qa, gr

    def process_dataframe(
        self,
        df: pl.DataFrame,
        entity_type_hint: Optional[str] = None,
        mandatory_fields: Optional[Set[str]] = None,
        build_golden_records: bool = True,
    ) -> DatasetCleaningResult:
        """Executes full data cleaning, deduplication, and standardization pipeline on a Polars DataFrame."""
        total_rows = df.height
        logger.info("Starting production dataset cleaning pipeline on %d rows", total_rows)

        # ─── 1. Profiling (Before Cleaning) ───────────────────────────────────
        profile_before = self.profiler.profile_dataset(df, stage="BEFORE_CLEANING")
        column_roles: Dict[str, str] = {
            col: self._classify_column_role(col)
            for col in df.columns
            if not col.startswith("_")
        }
        column_date_hints: Dict[str, Optional[str]] = {
            col: DateCleaner.infer_column_date_format(df[col].to_list())
            for col, role in column_roles.items()
            if role == "date"
        }

        # ─── 2. Row-by-Row Cleaning & Normalization ───────────────────────────
        cleaned_records_list: List[CleanedRecord] = []
        record_assessments: List[RecordQualityAssessment] = []
        synthetic_flags: List[bool] = []

        for idx, raw_row in enumerate(df.to_dicts()):
            rec, qa, is_synth = self._clean_single_row(
                idx, raw_row, column_roles, column_date_hints, entity_type_hint, mandatory_fields
            )
            cleaned_records_list.append(rec)
            record_assessments.append(qa)
            synthetic_flags.append(is_synth)

        # ─── 3. Deduplication & Entity Resolution ─────────────────────────────
        records_data = [
            {
                "id": r.record_id,
                **r.attributes,
                "_idx": i,
                "_qualityState": r.quality_state,
                "_synthetic_id": synthetic_flags[i],
            }
            for i, r in enumerate(cleaned_records_list)
        ]
        clustering = MultiStageEntityResolver.cluster_records(records_data)
        for mlog in clustering.merge_logs:
            self.lineage.log_merge(
                lead_record_id=str(mlog["lead_record_id"]),
                merged_record_id=str(mlog["merged_record_id"]),
                confidence_score=float(mlog["confidence_score"]),
                rules_triggered=list(mlog["rules_triggered"]),
                reason=str(mlog["reason"]),
            )

        # ─── 4. Cluster Consolidation & Golden Record Generation ──────────────
        deduped_records: List[CleanedRecord] = []
        deduped_assessments: List[RecordQualityAssessment] = []
        golden_records: List[GoldenRecordOutput] = []
        duplicates_merged_count = 0

        for idx_cluster in clustering.clusters:
            clus_recs = [records_data[idx] for idx in idx_cluster]
            if len(idx_cluster) == 1:
                i0 = idx_cluster[0]
                deduped_records.append(cleaned_records_list[i0])
                deduped_assessments.append(record_assessments[i0])
                if build_golden_records:
                    golden_records.append(
                        self.golden_engine.build_golden_record(
                            cluster_records=clus_recs,
                            tenant_id=self.tenant_id,
                            entity_type=entity_type_hint or "Person",
                        )
                    )
            else:
                duplicates_merged_count += len(idx_cluster) - 1
                merged_rec, merged_qa, gr = self._merge_cluster_record(
                    idx_cluster, clus_recs, cleaned_records_list, entity_type_hint, mandatory_fields
                )
                deduped_records.append(merged_rec)
                deduped_assessments.append(merged_qa)
                if build_golden_records:
                    golden_records.append(gr)

        # ─── 5. Profiling (After Cleaning & Deduplication) ────────────────────
        clean_dicts = [r.attributes for r in deduped_records]
        clean_df = pl.DataFrame(clean_dicts) if clean_dicts else pl.DataFrame()
        profile_after = self.profiler.profile_dataset(clean_df, stage="AFTER_CLEANING")

        # ─── 6. Quality Assessment & Delta Summary ────────────────────────────
        verified_cnt = sum(1 for r in deduped_records if r.quality_state == "VERIFIED")
        review_cnt = sum(1 for r in deduped_records if r.quality_state == "NEEDS_REVIEW")
        rejected_cnt = sum(1 for r in deduped_records if r.quality_state == "REJECTED")

        qa_dataset = DataQualityFramework.evaluate_dataset(
            records=clean_dicts,
            mandatory_fields=mandatory_fields,
            precomputed_assessments=deduped_assessments,
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
            for r in deduped_records
            if r.quality_state == "REJECTED"
        ]

        return DatasetCleaningResult(
            run_id=self.run_id,
            tenant_id=self.tenant_id,
            source_id=self.source_id,
            total_raw_records=total_rows,
            total_clean_records=len(deduped_records),
            duplicates_merged=duplicates_merged_count,
            verified_records_count=verified_cnt,
            needs_review_count=review_cnt,
            rejected_records_count=rejected_cnt,
            records=deduped_records,
            golden_records=golden_records,
            review_candidates=clustering.review_candidates,
            quarantined_records=quarantined,
            profile_before=profile_before,
            profile_after=profile_after,
            profiling_delta=delta_report,
            quality_assessment=qa_dataset,
            columns=df.columns,
        )
