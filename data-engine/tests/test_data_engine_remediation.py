"""Comprehensive Remediation Test Suite for LuminAI Data Engine.

Tests all requirements:
1. Type inference & safe conversion (no blind coercion, null sentinel handling, numeric 0 preservation).
2. Date cleaning & calendar validity (strict invalid date rejection, 2-digit years, partial dates, ambiguous dates).
3. Text cleaning, mojibake repair, HTML sanitization, formula injection neutralization, Unicode preservation.
4. Name standardization, smart title-casing, reversed names, placeholder detection, transposition flagging.
5. Categorical standardization (strict dictionary mapping, refusing blind numeric gender conversion, near-match flagging).
6. Identifier cleaning & collision prevention.
7. Entity resolution with IDENTIFIER_CONTRADICTION_GUARD (never merging differing MRNs/SSNs).
8. Golden Record multi-criteria survivorship, field provenance, and conflict tracking.
9. DAMA Data Quality Framework (6 dimensions, critical penalties, separation of quality from ER confidence).
10. End-to-end execution on the torture dataset (qa_datasets/02_negative_dirty_torture.csv).
"""

import os
from pathlib import Path
import pytest

from app.processing.engine.type_inference import TypeInferenceEngine, InferredType
from app.processing.engine.date_cleaner import DateCleaner
from app.processing.engine.text_cleaner import TextCleaner
from app.processing.engine.name_standardizer import NameStandardizer
from app.processing.engine.categorical_standardizer import CategoricalStandardizer
from app.processing.engine.identifier_cleaner import IdentifierCleaner
from app.processing.engine.profiler import DataProfiler
from app.processing.engine.deduplicator import MultiStageEntityResolver, MatchState, MatchDecision
from app.processing.engine.golden_record_engine import GoldenRecordEngine
from app.processing.engine.quality_framework import DataQualityFramework
from app.processing.engine.dataset_cleaner import DatasetCleaner


# =========================================================================
# 1. Type Inference Tests
# =========================================================================

def test_type_inference_sentinels_and_preservation():
    engine = TypeInferenceEngine()
    
    # Sentinels must be recognized as null
    for null_sentinel in ["NULL", "N/A", "None", "-", "?", "", "   ", None]:
        assert engine.is_null_sentinel(null_sentinel) is True
        norm_val, is_null = engine.normalize_null(null_sentinel)
        assert norm_val is None
        assert is_null is True

    # Numeric 0 or False must NEVER be treated as null
    assert engine.is_null_sentinel(0) is False
    assert engine.is_null_sentinel("0") is False
    assert engine.is_null_sentinel(False) is False
    assert engine.is_null_sentinel("false") is False


def test_type_inference_numeric_and_boolean():
    engine = TypeInferenceEngine()
    
    # String numerics
    res_int = engine.infer_and_convert("12345")
    assert res_int.inferred_type == InferredType.INTEGER
    assert res_int.converted_value == 12345
    assert res_int.is_valid is True

    res_float = engine.infer_and_convert("1,234.56")
    assert res_float.inferred_type == InferredType.FLOAT
    assert res_float.converted_value == 1234.56
    assert res_float.is_valid is True

    # Boolean variations
    for bool_true in ["true", "True", "TRUE", "yes", "Y"]:
        res_b = engine.infer_and_convert(bool_true)
        assert res_b.inferred_type == InferredType.BOOLEAN
        assert res_b.converted_value is True

    for bool_false in ["false", "False", "no", "N"]:
        res_b = engine.infer_and_convert(bool_false)
        assert res_b.inferred_type == InferredType.BOOLEAN
        assert res_b.converted_value is False


# =========================================================================
# 2. Date Cleaning & Calendar Validity Tests
# =========================================================================

def test_date_cleaning_calendar_validity():
    cleaner = DateCleaner()

    # Impossible calendar dates must be rejected
    invalid_dates = [
        "31/02/1990",  # Feb 31 does not exist
        "1990-02-30",  # Feb 30 does not exist
        "2023-04-31",  # April has only 30 days
        "9999-99-99",  # Completely invalid
        "Yesterday",   # Non-date relative string
        "61 yrs",      # Age string, not a date
    ]
    for inv in invalid_dates:
        res = cleaner.clean_date(inv)
        assert res.is_valid is False, f"Date '{inv}' should be marked invalid"
        assert res.calendar_valid is False, f"Date '{inv}' should have calendar_valid=False"
        assert res.standardized_iso is None or res.is_valid is False

    # Valid dates
    res_valid = cleaner.clean_date("09/09/1993")
    assert res_valid.is_valid is True
    assert res_valid.standardized_iso == "1993-09-09"

    # 2-digit years with documented cutoff
    res_cutoff = cleaner.clean_date("01/01/70")
    assert res_cutoff.is_valid is True
    assert res_cutoff.standardized_iso == "1970-01-01"

    # Partial / approximate dates
    res_partial = cleaner.clean_date("c. 2018")
    assert res_partial.is_partial is True
    assert res_partial.precision.upper() == "YEAR"
    assert res_partial.standardized_iso == "2018"

    # Ambiguous dates
    res_ambig = cleaner.clean_date("03/04/2020")
    assert res_ambig.is_ambiguous is True
    assert "interpretation_options" in res_ambig.metadata

    # Future birth dates
    res_future_dob = cleaner.clean_date("2099-01-01", is_birth_date=True)
    assert res_future_dob.is_valid is False
    assert "Future date" in res_future_dob.validation_notes


# =========================================================================
# 3. Text Cleaning, Mojibake & Security Tests
# =========================================================================

def test_text_cleaning_mojibake_html_and_formula_injection():
    cleaner = TextCleaner()

    # Mojibake repair
    res_mojibake = cleaner.clean_text("MÃ¼ller")
    assert res_mojibake.cleaned == "Müller"
    assert res_mojibake.mojibake_fixed is True

    res_francois = cleaner.clean_text("FranÃ§ois")
    assert res_francois.cleaned == "François"

    # Preserving legitimate Unicode and emojis
    res_unicode = cleaner.clean_text("  José María Müller 🚢📦  ")
    assert res_unicode.cleaned == "José María Müller 🚢📦"

    # HTML fragment stripping
    res_html = cleaner.clean_text("<b>John Doe</b><script>alert('xss')</script>")
    assert "<script>" not in res_html.cleaned
    assert "<b>" not in res_html.cleaned
    assert "John Doe" in res_html.cleaned
    assert res_html.html_stripped is True

    # Formula injection neutralization
    for injection in ["=cmd|' /C calc'!A0", "@SUM(A1:B1)", "+cmd|powershell", "-cmd|calc"]:
        res_sec = cleaner.clean_text(injection)
        assert res_sec.formula_neutralized is True
        assert res_sec.cleaned.startswith("'")


# =========================================================================
# 4. Name Standardization Tests
# =========================================================================

def test_name_standardization():
    standardizer = NameStandardizer()

    # Smart title-casing
    res1 = standardizer.standardize_name("ibrahim garcia")
    assert res1.canonical_name == "Ibrahim Garcia"

    res2 = standardizer.standardize_name("EFUA DARKO")
    assert res2.canonical_name == "Efua Darko"

    # Reversed names
    res_rev = standardizer.standardize_name("Darko, Efua")
    assert res_rev.canonical_name == "Efua Darko"
    assert res_rev.reversed_detected is True

    # Placeholder identities
    res_placeholder = standardizer.standardize_name("Unknown Doe")
    assert res_placeholder.is_placeholder is True

    res_test = standardizer.standardize_name("Test User")
    assert res_test.is_placeholder is True

    # Transposition / spelling check
    res_spell = standardizer.standardize_name("Fatima Borwn")
    assert res_spell.potential_transposition is True


# =========================================================================
# 5. Categorical Standardization Tests
# =========================================================================

def test_categorical_standardization():
    standardizer = CategoricalStandardizer()

    # Sex / Gender mapping
    for valid_female in ["FEMALE", "Female", "female", "F"]:
        res = standardizer.standardize_gender(valid_female)
        assert res.canonical == "Female"
        assert res.is_valid is True

    for valid_male in ["MALE", "Male", "male", "M"]:
        res = standardizer.standardize_gender(valid_male)
        assert res.canonical == "Male"
        assert res.is_valid is True

    # Blind numeric conversion MUST BE REJECTED
    res_num = standardizer.standardize_gender("1")
    assert res_num.is_valid is False
    assert res_num.requires_review is True

    # Country mapping
    for us_var in ["US", "U.S.A.", "United States of America"]:
        res_c = standardizer.standardize_country(us_var)
        assert res_c.canonical == "United States"

    # City mapping and near-match detection
    res_city = standardizer.standardize_city("MADINA")
    assert res_city.canonical == "Madina"

    # Near match "Madian" should be flagged for review, NOT silently merged
    res_near = standardizer.standardize_city("Madian")
    assert res_near.requires_review is True
    assert res_near.suggested_match == "Madina"


# =========================================================================
# 6. Identifier Cleaning Tests
# =========================================================================

def test_identifier_cleaner():
    cleaner = IdentifierCleaner()

    # Whitespace and safe trim
    res_mrn = cleaner.clean_identifier("  MRN-100234  ", id_type="MRN")
    assert res_mrn.cleaned_id == "MRN-100234"
    assert res_mrn.is_valid is True

    # SSN format validation
    res_ssn = cleaner.clean_identifier("219-45-6789", id_type="SSN")
    assert res_ssn.cleaned_id == "219-45-6789"
    assert res_ssn.is_valid is True

    # Dummy sequential SSN detected and flagged
    res_dummy = cleaner.clean_identifier("123-45-6789", id_type="SSN")
    assert res_dummy.is_valid is False
    assert res_dummy.needs_review is True

    # Invalid empty or sentinel identifier
    res_bad = cleaner.clean_identifier("N/A", id_type="MRN")
    assert res_bad.is_valid is False


# =========================================================================
# 7. Entity Resolution & IDENTIFIER_CONTRADICTION_GUARD Tests
# =========================================================================

def test_entity_resolution_contradiction_guard():
    resolver = MultiStageEntityResolver()

    # Case A: Same name and birth date, but DIFFERENT verified MRNs
    # MUST NEVER BE MERGED
    rec1 = {
        "id": "REC-001",
        "name": "John Doe",
        "dob": "1980-05-15",
        "mrn": "MRN-11111",
        "gender": "Male",
    }
    rec2 = {
        "id": "REC-002",
        "name": "John Doe",
        "dob": "1980-05-15",
        "mrn": "MRN-22222",  # Contradictory identifier!
        "gender": "Male",
    }
    
    match_result = resolver.evaluate_pair(rec1, rec2)
    assert match_result.decision == MatchState.DISTINCT_ENTITY
    assert match_result.has_conflicting_identifiers is True
    assert "IDENTIFIER_CONTRADICTION_GUARD" in match_result.matched_rules

    # Case B: Confirmed duplicate (same MRN)
    rec3 = {
        "id": "REC-003",
        "name": "John Doe",
        "dob": "1980-05-15",
        "mrn": "MRN-11111",
        "gender": "Male",
    }
    match_confirmed = resolver.evaluate_pair(rec1, rec3)
    assert match_confirmed.decision == MatchState.CONFIRMED_DUPLICATE
    assert match_confirmed.overall_confidence >= 0.95


# =========================================================================
# 8. Golden Record Multi-Criteria Survivorship & Provenance Tests
# =========================================================================

def test_golden_record_survivorship_and_conflicts():
    engine = GoldenRecordEngine()

    cluster = [
        {
            "id": "REC-A",
            "_source_id": "ehr_system_a",
            "name": "Efua Darko",
            "phone": "555-0100",
            "email": None,
            "dob": "1990-05-12",
            "city": "Madina",
        },
        {
            "id": "REC-B",
            "_source_id": "crm_system_b",
            "name": "EFUA DARKO",
            "phone": "555-0199",  # Conflicting phone
            "email": "efua@example.com",
            "dob": "1990-05-12",
            "city": "Accra",       # Conflicting city
        },
    ]

    source_priorities = {"ehr_system_a": 10, "crm_system_b": 5}
    golden = engine.generate_golden_record(cluster, source_priorities=source_priorities)

    # EHR system has higher priority for name and city
    assert golden["name"] == "Efua Darko"
    assert golden["city"] == "Madina"
    # Email was missing in REC-A, so survived from REC-B
    assert golden["email"] == "efua@example.com"

    # Conflicting values must be recorded in _conflicts
    assert "_conflicts" in golden
    assert "phone" in golden["_conflicts"] or "city" in golden["_conflicts"]
    
    # Provenance metadata must be present
    assert "_provenance" in golden
    assert "name" in golden["_provenance"]
    assert golden["_provenance"]["name"]["source_record_id"] == "REC-A"


# =========================================================================
# 9. Data Quality Framework & Score Separation Tests
# =========================================================================

def test_data_quality_framework_penalties_and_states():
    framework = DataQualityFramework()

    # Record with critical invalidity (invalid date)
    bad_record = {
        "id": "BAD-01",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "dob": "31/02/1990",  # Critical invalid date!
        "gender": "Female",
        "mrn": "MRN-9999",
    }
    
    assessment = framework.assess_record(
        bad_record,
        record_id="BAD-01",
    )
    
    # Must receive severe validity penalty and not be VERIFIED
    assert assessment.dimension_scores.validity < 70.0
    assert assessment.quality_state in ["REJECTED", "NEEDS_REVIEW"]

    # Clean valid record
    good_record = {
        "id": "GOOD-01",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "dob": "1990-02-28",
        "gender": "Female",
        "mrn": "MRN-9999",
    }
    good_assessment = framework.assess_record(good_record, record_id="GOOD-01")
    assert good_assessment.dimension_scores.validity == 100.0
    assert good_assessment.quality_state == "VERIFIED"


# =========================================================================
# 10. End-to-End DatasetCleaner on Torture CSV
# =========================================================================

def test_dataset_cleaner_on_torture_csv():
    repo_root = Path(__file__).resolve().parents[2]
    torture_csv_path = repo_root / "qa_datasets" / "02_negative_dirty_torture.csv"
    
    assert torture_csv_path.exists(), f"File {torture_csv_path} must exist"

    cleaner = DatasetCleaner()
    result = cleaner.clean_file(str(torture_csv_path))

    # Assertions on remediation results
    assert result.total_raw_records > 0
    assert result.total_clean_records > 0
    assert result.duplicates_merged >= 0
    
    # Invalid dates must be detected and recorded in invalid/quarantined count
    assert result.rejected_count > 0 or result.needs_review_count > 0, (
        "Torture dataset contains invalid dates and corrupted data that must be flagged"
    )
    
    # Verified quality score must be calculated truthfully (not hardcoded 98.5)
    assert result.data_quality_score < 98.0, (
        f"Torture dataset quality score should reflect dirty data, got {result.data_quality_score}"
    )

    # Profiling report before and after must exist
    assert result.profiling_report is not None
    assert "column_deltas" in result.profiling_report or "completeness_delta" in result.profiling_report
