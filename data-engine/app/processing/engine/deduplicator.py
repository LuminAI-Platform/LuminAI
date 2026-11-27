"""Production multi-stage deduplication and entity resolution engine.

Implements:
  1. Exact identifier matching (MRN, National ID, SSN, normalized email) and exact row signatures.
  2. Normalized compound attribute matching across schema aliases.
  3. Weighted multi-field fuzzy matching with Jaro-Winkler & Levenshtein.
  4. Strict Contradiction Guard: records with differing verified identifiers (e.g. MRN, SSN)
     are NEVER merged regardless of name similarity.
  5. Confidence-based classification:
     - CONFIRMED_DUPLICATE (auto-merge with full provenance)
     - PROBABLE_DUPLICATE (auto-merge with audit flag)
     - POSSIBLE_MATCH (sent to human review queue)
     - DISTINCT_ENTITY (kept separate)
  6. Blocked candidate generation and contradiction-safe Union-Find clustering.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import hashlib
import json
import re
from typing import Any, Dict, List, Optional

import jellyfish

from app.processing.engine.dedup_clustering import ClusteringOutcome, cluster_entity_records


class MatchDecision:
    CONFIRMED_DUPLICATE = "CONFIRMED_DUPLICATE"
    PROBABLE_DUPLICATE = "PROBABLE_DUPLICATE"
    POSSIBLE_MATCH = "POSSIBLE_MATCH"
    DISTINCT_ENTITY = "DISTINCT_ENTITY"


MatchState = MatchDecision

_NULL_SENTINELS = {"", "null", "none", "n/a", "na", "-", "?", "undefined", "#n/a"}
_INTERNAL_KEYS = {
    "_idx",
    "_qualityState",
    "_table",
    "_synthetic_id",
    "qualityState",
    "qualityScore",
    "confidenceScore",
    "_validationErrors",
    "_validationWarnings",
}
_NAME_ALIASES = (
    "name",
    "full_name",
    "canonical_name",
    "patient_name",
    "customer_name",
    "person_name",
    "contact_name",
    "company_name",
    "organization",
)
_EMAIL_ALIASES = ("email", "contact_email", "primary_email", "work_email", "user_email", "email_address")
_DOB_ALIASES = ("dob", "date_of_birth", "birth_date", "birthdate")
_PHONE_ALIASES = ("phone", "contact_phone", "phone_e164", "phone_number", "mobile", "telephone", "tel")


@dataclass
class MatchEvidence:
    """Detailed evidence supporting an entity resolution match or non-match decision."""

    matched_rules: List[str]
    attribute_scores: Dict[str, float]
    overall_confidence: float
    decision: str
    has_conflicting_identifiers: bool = False
    notes: Optional[str] = None


@dataclass
class MergeRecordProvenance:
    """Provenance tracking which source records contributed to a consolidated entity."""

    source_record_ids: List[str]
    source_datasets: List[str]
    matching_evidence: MatchEvidence
    merge_timestamp: str
    rule_name: str
    field_survivorship: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    conflicting_values: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)


def _clean_str(val: Any) -> str:
    if val is None:
        return ""
    s = str(val).strip()
    return "" if s.lower() in _NULL_SENTINELS else s


def _compare_emails(email_a: str, email_b: str) -> float:
    if email_a == email_b:
        return 1.0
    local_a, dom_a = email_a.split("@", 1)
    local_b, dom_b = email_b.split("@", 1)
    if re.findall(r"\d+", local_a) != re.findall(r"\d+", local_b):
        return 0.0
    if local_a != local_b and dom_a == dom_b:
        dist = jellyfish.levenshtein_distance(local_a, local_b)
        if min(len(local_a), len(local_b)) < 5 or dist > 1:
            return 0.0
    dist = jellyfish.levenshtein_distance(email_a, email_b)
    return max(0.0, 1.0 - (dist / max(len(email_a), len(email_b))))


def _compare_names(name_a: str, name_b: str) -> float:
    if re.findall(r"\d+", name_a) != re.findall(r"\d+", name_b):
        return 0.0
    return jellyfish.jaro_winkler_similarity(name_a, name_b)


class MultiStageEntityResolver:
    """Multi-stage entity resolution and deduplication engine."""

    DEFAULT_WEIGHTS = {"name": 0.35, "email": 0.25, "dob": 0.20, "phone": 0.10, "address": 0.10}
    CONFIRMED_THRESHOLD = 0.95
    PROBABLE_THRESHOLD = 0.85
    REVIEW_THRESHOLD = 0.65

    ID_FIELDS = {
        "mrn",
        "national_id",
        "ssn",
        "tax_id",
        "id_number",
        "customer_id",
        "account_id",
        "entity_id",
        "national_tin",
        "passport_number",
        "driver_license",
    }
    ID_FIELDS_CLEAN = {f.replace("_", "") for f in ID_FIELDS}

    @classmethod
    def extract_name(cls, record: Dict[str, Any]) -> str:
        for key in _NAME_ALIASES:
            val = _clean_str(record.get(key))
            if val:
                return val.lower()
        first = _clean_str(record.get("first_name"))
        last = _clean_str(record.get("last_name"))
        return f"{first} {last}".strip().lower() if (first or last) else ""

    @classmethod
    def extract_email(cls, record: Dict[str, Any]) -> str:
        for key in _EMAIL_ALIASES:
            val = _clean_str(record.get(key))
            if val:
                return val.lower()
        for k, v in record.items():
            if "email" in k.lower() and not k.startswith("_"):
                val = _clean_str(v)
                if val:
                    return val.lower()
        return ""

    @classmethod
    def extract_dob(cls, record: Dict[str, Any]) -> str:
        for key in _DOB_ALIASES:
            val = _clean_str(record.get(key))
            if val:
                return val
        return ""

    @classmethod
    def extract_phone(cls, record: Dict[str, Any]) -> str:
        for key in _PHONE_ALIASES:
            val = _clean_str(record.get(key))
            if val:
                digits = re.sub(r"\D", "", val)
                if digits:
                    return digits
        return ""

    @classmethod
    def exact_content_signature(cls, record: Dict[str, Any]) -> str:
        """Compute canonical hash over all non-internal attributes (ignoring synthetic IDs)."""
        ignore = set(_INTERNAL_KEYS)
        if record.get("_synthetic_id"):
            ignore.add("id")
        payload = {}
        for k in sorted(record.keys()):
            if k in ignore or k.startswith("_"):
                continue
            val = record.get(k)
            if isinstance(val, str):
                norm = val.strip().lower()
                payload[k] = None if norm in _NULL_SENTINELS else norm
            else:
                payload[k] = val
        if not any(v is not None for v in payload.values()):
            return ""
        encoded = json.dumps(payload, sort_keys=True, default=str)
        return hashlib.sha256(encoded.encode("utf-8")).hexdigest()[:16]

    @classmethod
    def classify_identifier_columns(cls, columns: List[str]) -> List[tuple[str, str]]:
        """Pre-map identifier column names to canonical identifier types once per schema."""
        mapped: List[tuple[str, str]] = []
        for col in columns:
            k_clean = col.lower().replace("_", "").replace("-", "")
            for id_field in cls.ID_FIELDS_CLEAN:
                if id_field in k_clean:
                    mapped.append((col, id_field))
                    break
        return mapped

    @classmethod
    def extract_identifiers(
        cls,
        record: Dict[str, Any],
        id_columns: Optional[List[tuple[str, str]]] = None,
    ) -> Dict[str, str]:
        """Extracts normalized identifiers from record attributes."""
        idents: Dict[str, str] = {}
        invalid_sentinels = ("NULL", "NONE", "N/A", "NA", "-", "?", "0", "UNKNOWN", "UNDEFINED")
        if id_columns is not None:
            for col, id_field in id_columns:
                v = record.get(col)
                if v is None or v == "":
                    continue
                s_val = str(v).strip().upper()
                if s_val and s_val not in invalid_sentinels:
                    idents.setdefault(id_field, s_val)
            return idents

        for k, v in record.items():
            if v is None or v == "":
                continue
            k_clean = k.lower().replace("_", "").replace("-", "")
            for id_field in cls.ID_FIELDS_CLEAN:
                if id_field in k_clean:
                    s_val = str(v).strip().upper()
                    if s_val and s_val not in invalid_sentinels:
                        idents[id_field] = s_val
                        break
        return idents

    @classmethod
    def have_conflicting_identifiers(cls, idents_a: Dict[str, str], idents_b: Dict[str, str]) -> bool:
        return any(idents_a[t] != idents_b[t] for t in set(idents_a.keys()) & set(idents_b.keys()))

    @classmethod
    def evaluate_pair(
        cls,
        rec_a: Dict[str, Any],
        rec_b: Dict[str, Any],
        custom_weights: Optional[Dict[str, float]] = None,
        idents_a: Optional[Dict[str, str]] = None,
        idents_b: Optional[Dict[str, str]] = None,
    ) -> MatchEvidence:
        """Evaluates a pair of records across multi-stage matching rules."""
        matched_rules: List[str] = []
        attr_scores: Dict[str, float] = {}

        if idents_a is None:
            idents_a = cls.extract_identifiers(rec_a)
        if idents_b is None:
            idents_b = cls.extract_identifiers(rec_b)

        shared_ident_types = set(idents_a.keys()) & set(idents_b.keys())
        if cls.have_conflicting_identifiers(idents_a, idents_b):
            return MatchEvidence(
                matched_rules=["IDENTIFIER_CONTRADICTION_GUARD"],
                attribute_scores={"identifier_conflict": 1.0},
                overall_confidence=0.0,
                decision="DISTINCT_ENTITY",
                has_conflicting_identifiers=True,
                notes=f"Records have contradictory verified identifiers ({shared_ident_types}); merge prohibited",
            )

        exact_ident_match = False
        for itype in shared_ident_types:
            if idents_a[itype] == idents_b[itype]:
                exact_ident_match = True
                matched_rules.append(f"EXACT_IDENTIFIER_MATCH_{itype.upper()}")

        name_a, name_b = cls.extract_name(rec_a), cls.extract_name(rec_b)
        if exact_ident_match:
            if name_a and name_b:
                sim = jellyfish.jaro_winkler_similarity(name_a, name_b)
                attr_scores["name"] = round(sim, 4)
                if sim < 0.60:
                    return MatchEvidence(
                        matched_rules=matched_rules + ["NAME_MISMATCH_ON_SHARED_ID"],
                        attribute_scores=attr_scores,
                        overall_confidence=0.75,
                        decision="POSSIBLE_MATCH",
                        notes="Identical identifier but significantly different names; flagged for human review",
                    )
            return MatchEvidence(
                matched_rules=matched_rules,
                attribute_scores={"identifier_match": 1.0},
                overall_confidence=0.99,
                decision="CONFIRMED_DUPLICATE",
                notes="Exact match on verified primary identifier with compatible attributes",
            )

        weights = dict(custom_weights or cls.DEFAULT_WEIGHTS)
        active_weight, weighted_sum = 0.0, 0.0

        email_a, email_b = cls.extract_email(rec_a), cls.extract_email(rec_b)
        if email_a and email_b and "@" in email_a and "@" in email_b:
            e_sim = _compare_emails(email_a, email_b)
            if email_a == email_b:
                matched_rules.append("EXACT_EMAIL_MATCH")
            attr_scores["email"] = round(e_sim, 4)
            w = weights.get("email", 0.25)
            weighted_sum += w * e_sim
            active_weight += w

        if name_a and name_b:
            name_sim = _compare_names(name_a, name_b)
            attr_scores["name"] = round(name_sim, 4)
            w = weights.get("name", 0.35)
            weighted_sum += w * name_sim
            active_weight += w

        dob_a, dob_b = cls.extract_dob(rec_a), cls.extract_dob(rec_b)
        if dob_a and dob_b:
            dob_sim = 1.0 if dob_a == dob_b else max(
                0.0, 1.0 - (jellyfish.levenshtein_distance(dob_a, dob_b) / max(len(dob_a), len(dob_b)))
            )
            attr_scores["dob"] = round(dob_sim, 4)
            w = weights.get("dob", 0.20)
            weighted_sum += w * dob_sim
            active_weight += w

        phone_a, phone_b = cls.extract_phone(rec_a), cls.extract_phone(rec_b)
        if len(phone_a) >= 7 and len(phone_b) >= 7:
            phone_sim = (
                1.0
                if phone_a == phone_b or phone_a.endswith(phone_b) or phone_b.endswith(phone_a)
                else 0.0
            )
            attr_scores["phone"] = phone_sim
            w = weights.get("phone", 0.10)
            weighted_sum += w * phone_sim
            active_weight += w

        score = round(weighted_sum / active_weight, 4) if active_weight > 0 else 0.0
        sig_a, sig_b = cls.exact_content_signature(rec_a), cls.exact_content_signature(rec_b)
        if sig_a and sig_a == sig_b:
            return MatchEvidence(
                matched_rules=matched_rules + ["EXACT_ROW_DUPLICATE"],
                attribute_scores={**attr_scores, "exact_row": 1.0},
                overall_confidence=1.0,
                decision="CONFIRMED_DUPLICATE",
                notes="Exact duplicate row content across all business attributes",
            )

        if "EXACT_EMAIL_MATCH" in matched_rules and attr_scores.get("name", 1.0) >= 0.70:
            score = max(score, 0.95)

        if len(attr_scores) == 1 and "name" in attr_scores and score >= 0.90:
            return MatchEvidence(
                matched_rules=["SINGLE_ATTRIBUTE_SIMILAR_NAME"],
                attribute_scores=attr_scores,
                overall_confidence=0.80,
                decision="POSSIBLE_MATCH",
                notes="High name similarity but lacks secondary corroborating attributes (DOB/email/phone); human review required",
            )

        if score >= cls.CONFIRMED_THRESHOLD:
            decision = "CONFIRMED_DUPLICATE"
            matched_rules.append("WEIGHTED_CONFIRMED_MATCH")
        elif score >= cls.PROBABLE_THRESHOLD:
            decision = "PROBABLE_DUPLICATE"
            matched_rules.append("WEIGHTED_PROBABLE_MATCH")
        elif score >= cls.REVIEW_THRESHOLD:
            decision = "POSSIBLE_MATCH"
            matched_rules.append("BORDERLINE_REVIEW_CANDIDATE")
        else:
            decision = "DISTINCT_ENTITY"

        return MatchEvidence(
            matched_rules=matched_rules,
            attribute_scores=attr_scores,
            overall_confidence=score,
            decision=decision,
            has_conflicting_identifiers=False,
            notes=f"Weighted score: {score} based on {list(attr_scores.keys())}",
        )

    @classmethod
    def cluster_records(cls, records_data: List[Dict[str, Any]]) -> ClusteringOutcome:
        """Block, evaluate candidate pairs, and cluster duplicate records safely via Union-Find."""
        return cluster_entity_records(cls, records_data)


cls_ID_FIELDS_CLEAN = [f.replace("_", "") for f in MultiStageEntityResolver.ID_FIELDS]
