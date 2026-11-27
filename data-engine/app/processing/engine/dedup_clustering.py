"""Blocked candidate generation and contradiction-safe Union-Find clustering."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Dict, List, Set

from app.processing.er.clustering import UnionFind

if TYPE_CHECKING:
    from app.processing.engine.deduplicator import MultiStageEntityResolver


@dataclass
class ClusteringOutcome:
    """Result of blocked entity resolution clustering over a batch of records."""

    clusters: List[List[int]]
    merge_logs: List[Dict[str, Any]]
    review_candidates: List[Dict[str, Any]]


def _build_candidate_pairs_map(
    resolver: type[MultiStageEntityResolver],
    records_data: List[Dict[str, Any]],
    idents_by_idx: List[Dict[str, str]],
) -> Dict[int, Set[int]]:
    n = len(records_data)
    blocks: Dict[str, List[int]] = {}

    for idx, rec in enumerate(records_data):
        for itype, ival in idents_by_idx[idx].items():
            if ival:
                blocks.setdefault(f"id:{itype}:{ival}", []).append(idx)

        raw_name = resolver.extract_name(rec)
        if len(raw_name) >= 2:
            blocks.setdefault(f"nam:{raw_name[:4]}", []).append(idx)

        raw_email = resolver.extract_email(rec)
        if "@" in raw_email:
            blocks.setdefault(f"eml_full:{raw_email}", []).append(idx)
            uname = raw_email.split("@")[0]
            if len(uname) >= 3:
                blocks.setdefault(f"eml:{uname}", []).append(idx)

        raw_dob = resolver.extract_dob(rec)
        if len(raw_dob) >= 4:
            blocks.setdefault(f"dob:{raw_dob[:10]}", []).append(idx)

        raw_phone = resolver.extract_phone(rec)
        if len(raw_phone) >= 7:
            blocks.setdefault(f"phn:{raw_phone[-7:]}", []).append(idx)

        sig = resolver.exact_content_signature(rec)
        if sig:
            blocks.setdefault(f"exact:{sig}", []).append(idx)

    candidate_pairs_map: Dict[int, Set[int]] = {i: set() for i in range(n)}
    max_exact_block = 200
    sorted_window = 20

    for idx_list in blocks.values():
        if len(idx_list) <= 1:
            continue
        if len(idx_list) < max_exact_block:
            for a_pos in range(len(idx_list)):
                ia = idx_list[a_pos]
                for b_pos in range(a_pos + 1, len(idx_list)):
                    ib = idx_list[b_pos]
                    candidate_pairs_map[min(ia, ib)].add(max(ia, ib))
        else:
            ordered = sorted(
                idx_list,
                key=lambda k: (
                    resolver.extract_email(records_data[k]),
                    resolver.extract_name(records_data[k]),
                    resolver.extract_dob(records_data[k]),
                    k,
                ),
            )
            for a_pos in range(len(ordered)):
                ia = ordered[a_pos]
                upper = min(len(ordered), a_pos + sorted_window + 1)
                for b_pos in range(a_pos + 1, upper):
                    ib = ordered[b_pos]
                    candidate_pairs_map[min(ia, ib)].add(max(ia, ib))

    return candidate_pairs_map


def cluster_entity_records(
    resolver: type[MultiStageEntityResolver],
    records_data: List[Dict[str, Any]],
) -> ClusteringOutcome:
    """Block, evaluate candidate pairs, and cluster duplicate records safely via Union-Find."""
    n = len(records_data)
    if n == 0:
        return ClusteringOutcome(clusters=[], merge_logs=[], review_candidates=[])
    if n == 1:
        return ClusteringOutcome(clusters=[[0]], merge_logs=[], review_candidates=[])

    id_cols = resolver.classify_identifier_columns(list(records_data[0].keys()))
    idents_by_idx = [resolver.extract_identifiers(rec, id_columns=id_cols) for rec in records_data]
    candidate_pairs_map = _build_candidate_pairs_map(resolver, records_data, idents_by_idx)

    uf = UnionFind()
    for i in range(n):
        uf.find(str(i))
    cluster_idents: Dict[str, Dict[str, str]] = {str(i): dict(idents_by_idx[i]) for i in range(n)}

    merge_logs: List[Dict[str, Any]] = []
    review_candidates: List[Dict[str, Any]] = []

    for i in range(n):
        for j in sorted(candidate_pairs_map.get(i, set())):
            evidence = resolver.evaluate_pair(
                records_data[i],
                records_data[j],
                idents_a=idents_by_idx[i],
                idents_b=idents_by_idx[j],
            )
            if evidence.decision in ("CONFIRMED_DUPLICATE", "PROBABLE_DUPLICATE"):
                ri = uf.find(str(i))
                rj = uf.find(str(j))
                if ri == rj:
                    continue
                if resolver.have_conflicting_identifiers(cluster_idents[ri], cluster_idents[rj]):
                    review_candidates.append({
                        "candidate_pair": (records_data[i].get("id"), records_data[j].get("id")),
                        "confidence_score": 0.0,
                        "matched_rules": ["TRANSITIVE_IDENTIFIER_CONTRADICTION_GUARD"],
                        "reason": "Transitive cluster conflict on verified identifiers",
                        "record_a": records_data[i],
                        "record_b": records_data[j],
                    })
                    continue
                uf.union(ri, rj)
                new_root = uf.find(ri)
                cluster_idents[new_root] = {**cluster_idents[ri], **cluster_idents[rj]}
                merge_logs.append({
                    "lead_idx": int(new_root),
                    "merged_idx": j,
                    "lead_record_id": records_data[i].get("id"),
                    "merged_record_id": records_data[j].get("id"),
                    "decision": evidence.decision,
                    "confidence_score": evidence.overall_confidence,
                    "rules_triggered": evidence.matched_rules,
                    "reason": evidence.notes or "High multi-attribute similarity",
                })
            elif evidence.decision == "POSSIBLE_MATCH":
                review_candidates.append({
                    "candidate_pair": (records_data[i].get("id"), records_data[j].get("id")),
                    "confidence_score": evidence.overall_confidence,
                    "matched_rules": evidence.matched_rules,
                    "reason": evidence.notes,
                    "record_a": records_data[i],
                    "record_b": records_data[j],
                })

    grouped: Dict[str, List[int]] = {}
    for i in range(n):
        grouped.setdefault(uf.find(str(i)), []).append(i)

    clusters = sorted((sorted(indices) for indices in grouped.values()), key=lambda c: c[0])
    return ClusteringOutcome(
        clusters=clusters,
        merge_logs=merge_logs,
        review_candidates=review_candidates,
    )
