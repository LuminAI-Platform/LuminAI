"""Production Golden Record generation and explainable survivorship engine.

Replaces naive timestamp/length overwriting with a multi-criteria survivorship hierarchy:
  1. Validation Status: Valid, verified values strictly win over unvalidated or invalid values.
  2. Source Priority: High-reliability source systems beat low-reliability feeds.
  3. Completeness: Richer, non-truncated values beat sparse entries.
  4. Recency: More recent updates take precedence when validity and reliability are tied.
  5. Field-Level Provenance: Tracks source record ID, source file, rule used, and timestamp.
  6. Conflict Preservation: Stores unresolved competing values in '_conflicts' metadata.
"""

from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.processing.engine.date_cleaner import DateCleaner
from app.processing.engine.text_cleaner import TextCleaner
from app.processing.engine.type_inference import TypeInferenceEngine


@dataclass
class FieldProvenance:
    """Detailed lineage and survivorship explanation for an individual field."""
    field_name: str
    selected_value: Any
    source_record_id: str
    source_dataset: str
    survivorship_rule: str
    selection_reason: str
    is_verified: bool
    confidence: float
    timestamp: str


@dataclass
class GoldenRecordOutput:
    """Consolidated Golden Record with field-level provenance and preserved conflicts."""
    golden_id: str
    tenant_id: str
    version: int
    canonical_name: str
    entity_type: str
    quality_state: str  # "VERIFIED", "NEEDS_REVIEW", "REJECTED"
    quality_score: float
    confidence_score: float
    source_record_ids: List[str]
    cluster_size: int
    attributes: Dict[str, Any]
    field_provenance: Dict[str, FieldProvenance]
    conflicts: Dict[str, List[Dict[str, Any]]]
    created_at: str
    updated_at: str

    def to_dict(self) -> Dict[str, Any]:
        """Converts output to dictionary for persistence or JSON response."""
        res = {
            "golden_id": self.golden_id,
            "tenant_id": self.tenant_id,
            "version": self.version,
            "canonical_name": self.canonical_name,
            "entity_type": self.entity_type,
            "quality_state": self.quality_state,
            "quality_score": self.quality_score,
            "confidence_score": self.confidence_score,
            "source_record_ids": self.source_record_ids,
            "cluster_size": self.cluster_size,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "attributes": self.attributes,
            "_field_provenance": {k: asdict(v) for k, v in self.field_provenance.items()},
            "_conflicts": self.conflicts,
        }
        return res


class GoldenRecordEngine:
    """Engine for generating explainable canonical Golden Records with field-level lineage."""

    # Configurable source priority: higher value = higher trust
    DEFAULT_SOURCE_PRIORITY: Dict[str, int] = {
        "ehr": 100,
        "emr": 100,
        "hospital_master": 95,
        "crm": 80,
        "portal": 70,
        "csv_upload": 60,
        "external_feed": 50,
        "default": 50,
    }

    def __init__(self, source_priorities: Optional[Dict[str, int]] = None):
        self.source_priorities = {**self.DEFAULT_SOURCE_PRIORITY, **(source_priorities or {})}

    def _get_source_priority(self, source_name: Optional[str]) -> int:
        if not source_name:
            return self.source_priorities.get("default", 50)
        s_lower = source_name.lower()
        for k, prio in self.source_priorities.items():
            if k in s_lower:
                return prio
        return self.source_priorities.get("default", 50)

    @staticmethod
    def _parse_timestamp(val: Any) -> float:
        """Safely parses timestamp into epoch seconds for recency comparison."""
        if not val:
            return 0.0
        if isinstance(val, (int, float)):
            return float(val)
        if isinstance(val, datetime):
            if val.tzinfo is None:
                val = val.replace(tzinfo=timezone.utc)
            return val.timestamp()
        s = str(val).strip()
        try:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            return dt.timestamp()
        except Exception:
            return 0.0

    def select_best_field_value(
        self,
        field_name: str,
        candidates: List[Dict[str, Any]],  # list of {"value": v, "rec_id": id, "source": src, "ts": epoch, "valid": bool}
    ) -> Tuple[Any, FieldProvenance, List[Dict[str, Any]]]:
        """Applies field survivorship rules to select the single best attribute value."""
        if not candidates:
            prov = FieldProvenance(
                field_name=field_name,
                selected_value=None,
                source_record_id="",
                source_dataset="",
                survivorship_rule="NO_CANDIDATE",
                selection_reason="No non-null values present in source records",
                is_verified=False,
                confidence=0.0,
                timestamp=datetime.now(timezone.utc).isoformat(),
            )
            return None, prov, []

        # If only 1 candidate, select it
        if len(candidates) == 1:
            c = candidates[0]
            prov = FieldProvenance(
                field_name=field_name,
                selected_value=c["value"],
                source_record_id=c["rec_id"],
                source_dataset=c["source"],
                survivorship_rule="SINGLE_CANDIDATE",
                selection_reason="Single available value across source records",
                is_verified=c["valid"],
                confidence=1.0 if c["valid"] else 0.5,
                timestamp=datetime.now(timezone.utc).isoformat(),
            )
            return c["value"], prov, []

        # Filter candidates: separate valid from invalid
        valid_candidates = [c for c in candidates if c["valid"]]
        pool = valid_candidates if valid_candidates else candidates

        # Multi-factor score for each candidate:
        # Score = (validity * 1000) + (source_priority * 10) + (completeness_len * 0.1) + (recency_epoch * 1e-8)
        scored_candidates = []
        for c in pool:
            val_str = str(c["value"]).strip()
            score = (
                (1000.0 if c["valid"] else 0.0)
                + (self._get_source_priority(c["source"]) * 10.0)
                + (min(100, len(val_str)) * 0.1)
                + (c["ts"] * 1e-8)
            )
            scored_candidates.append((score, c))

        scored_candidates.sort(key=lambda x: x[0], reverse=True)
        winner = scored_candidates[0][1]

        # Determine explanation
        reasons = []
        if winner["valid"] and not all(c["valid"] for c in candidates):
            reasons.append("Validation status priority (clean value beats invalid)")
        if self._get_source_priority(winner["source"]) > 50:
            reasons.append(f"Source trust priority ('{winner['source']}')")
        if winner["ts"] > 0:
            reasons.append("Temporal recency priority")
        reasons.append("Maximum completeness")
        selection_reason = " > ".join(reasons)

        # Collect distinct competing conflicting values
        conflicts = []
        winner_val_str = str(winner["value"]).strip().lower()
        for _, c in scored_candidates[1:]:
            c_str = str(c["value"]).strip().lower()
            if c_str != winner_val_str:
                conflicts.append({
                    "value": c["value"],
                    "source_record_id": c["rec_id"],
                    "source_dataset": c["source"],
                    "is_valid": c["valid"],
                })

        prov = FieldProvenance(
            field_name=field_name,
            selected_value=winner["value"],
            source_record_id=winner["rec_id"],
            source_dataset=winner["source"],
            survivorship_rule="VALIDATION_SOURCE_RECENCY_COMPLETENESS",
            selection_reason=selection_reason,
            is_verified=winner["valid"],
            confidence=0.95 if winner["valid"] else 0.60,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

        return winner["value"], prov, conflicts

    def build_golden_record(
        self,
        cluster_records: List[Dict[str, Any]],
        tenant_id: str,
        golden_id: Optional[str] = None,
        entity_type: Optional[str] = None,
        matching_confidence: float = 1.0,
    ) -> GoldenRecordOutput:
        """Consolidates a cluster of records into a single verified Golden Record with provenance."""
        if not cluster_records:
            raise ValueError("Cannot generate Golden Record from empty cluster")

        if not golden_id:
            golden_id = f"gr-{uuid.uuid4()}"

        source_record_ids = [
            str(r.get("id") or r.get("record_id") or r.get("raw_id") or f"src-{i}")
            for i, r in enumerate(cluster_records)
        ]

        # Determine canonical entity type
        inferred_type = entity_type or cluster_records[0].get("entity_type") or "Person"

        # Pre-process candidate values per field
        field_candidates: Dict[str, List[Dict[str, Any]]] = {}
        exclude_keys = {
            "id", "record_id", "raw_id", "tenant_id", "confidence_score",
            "quality_state", "quality_score", "_table", "_is_valid", "_rowQuality",
        }

        for rec in cluster_records:
            rec_id = str(rec.get("id") or rec.get("record_id") or rec.get("raw_id") or "")
            src = str(rec.get("_table") or rec.get("source_id") or "default")
            ts = self._parse_timestamp(rec.get("updated_at") or rec.get("created_at") or rec.get("staged_at"))

            for k, v in rec.items():
                if k in exclude_keys or k.startswith("_"):
                    continue
                if TypeInferenceEngine.is_null_value(v):
                    continue

                # Check field-level validity
                is_field_valid = True
                if "date" in k.lower() or k.lower() in ("dob", "birth_date", "joined_at"):
                    dres = DateCleaner.clean_date(v, field_name=k)
                    is_field_valid = dres.is_valid and not dres.is_ambiguous
                elif "email" in k.lower():
                    is_field_valid = "@" in str(v)

                field_candidates.setdefault(k, []).append({
                    "value": v,
                    "rec_id": rec_id,
                    "source": src,
                    "ts": ts,
                    "valid": is_field_valid,
                })

        # Apply survivorship across all fields
        consolidated_attrs: Dict[str, Any] = {}
        provenance_map: Dict[str, FieldProvenance] = {}
        conflicts_map: Dict[str, List[Dict[str, Any]]] = {}

        has_critical_error = False
        has_ambiguity_or_conflict = False

        for field_name, candidates in field_candidates.items():
            best_val, prov, conflicts = self.select_best_field_value(field_name, candidates)
            consolidated_attrs[field_name] = best_val
            provenance_map[field_name] = prov
            if conflicts:
                conflicts_map[field_name] = conflicts
                has_ambiguity_or_conflict = True

            if not prov.is_verified:
                has_critical_error = True

        # Extract Canonical Name
        name_val = (
            consolidated_attrs.get("name")
            or consolidated_attrs.get("full_name")
            or consolidated_attrs.get("canonical_name")
            or consolidated_attrs.get("title")
            or source_record_ids[0]
        )
        canonical_name = str(name_val).strip()

        # Determine Record Quality State
        if has_critical_error:
            quality_state = "REJECTED"
            quality_score = 45.0
        elif has_ambiguity_or_conflict or matching_confidence < 0.90:
            quality_state = "NEEDS_REVIEW"
            quality_score = 78.5
        else:
            quality_state = "VERIFIED"
            quality_score = 98.0

        now_iso = datetime.now(timezone.utc).isoformat()

        return GoldenRecordOutput(
            golden_id=golden_id,
            tenant_id=tenant_id,
            version=1,
            canonical_name=canonical_name,
            entity_type=inferred_type,
            quality_state=quality_state,
            quality_score=quality_score,
            confidence_score=matching_confidence,
            source_record_ids=source_record_ids,
            cluster_size=len(cluster_records),
            attributes=consolidated_attrs,
            field_provenance=provenance_map,
            conflicts=conflicts_map,
            created_at=now_iso,
            updated_at=now_iso,
        )

    def generate_golden_record(
        self,
        cluster_records: List[Dict[str, Any]],
        tenant_id: str = "default_tenant",
        golden_id: Optional[str] = None,
        entity_type: Optional[str] = None,
        matching_confidence: float = 1.0,
        source_priorities: Optional[Dict[str, int]] = None,
    ) -> Dict[str, Any]:
        """Convenience method returning a flat merged record dict with metadata."""
        if source_priorities:
            self.source_priorities.update(source_priorities)
        output = self.build_golden_record(
            cluster_records=cluster_records,
            tenant_id=tenant_id,
            golden_id=golden_id,
            entity_type=entity_type,
            matching_confidence=matching_confidence,
        )
        res = output.to_dict()
        res.update(output.attributes)
        res["_provenance"] = res.get("_field_provenance", {})
        return res
