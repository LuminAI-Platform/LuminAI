"""Entity Resolution (ER) Connected Components Graph Clustering Engine.

Groups matched pairs into clusters using connected components graph clustering
to resolve transitive equivalence (if A=B and B=C, cluster is {A, B, C}).
"""

from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any

import polars as pl

logger = logging.getLogger(__name__)


class UnionFind:
    """Disjoint-set data structure with path compression and union by rank."""

    def __init__(self) -> None:
        self.parent: dict[str, str] = {}
        self.rank: dict[str, int] = {}

    def find(self, item: str) -> str:
        if item not in self.parent:
            self.parent[item] = item
            self.rank[item] = 0
            return item
        if self.parent[item] != item:
            self.parent[item] = self.find(self.parent[item])  # Path compression
        return self.parent[item]

    def union(self, item1: str, item2: str) -> None:
        root1 = self.find(item1)
        root2 = self.find(item2)

        if root1 != root2:
            # Union by rank
            if self.rank[root1] < self.rank[root2]:
                self.parent[root1] = root2
            elif self.rank[root1] > self.rank[root2]:
                self.parent[root2] = root1
            else:
                self.parent[root2] = root1
                self.rank[root1] += 1


def find_connected_components(matches_df: pl.DataFrame, id_a_col: str = "id_a", id_b_col: str = "id_b") -> list[set[str]]:
    """Compute connected components graph clusters from a DataFrame of matched record pairs."""
    if matches_df.height == 0:
        return []

    uf = UnionFind()
    for row in matches_df.iter_rows(named=True):
        rec_a = str(row[id_a_col])
        rec_b = str(row[id_b_col])
        uf.union(rec_a, rec_b)

    clusters_map: dict[str, set[str]] = defaultdict(set)
    for node in uf.parent.keys():
        root = uf.find(node)
        clusters_map[root].add(node)

    clusters = list(clusters_map.values())
    logger.info(
        "Connected components clustering complete — total matches=%d, resolved clusters=%d",
        matches_df.height,
        len(clusters),
    )
    return clusters


def cluster_record_dictionaries(
    matches_df: pl.DataFrame,
    all_records: list[dict[str, Any]],
    id_col: str = "id",
) -> list[list[dict[str, Any]]]:
    """Group record dictionaries into clusters based on connected components of matches_df.

    Includes single-node clusters for records that had no matches.
    """
    records_by_id = {str(rec[id_col]): rec for rec in all_records if id_col in rec}

    clusters_id_sets = find_connected_components(matches_df)

    clustered_ids: set[str] = set()
    clustered_record_groups: list[list[dict[str, Any]]] = []

    for id_set in clusters_id_sets:
        group = [records_by_id[rid] for rid in id_set if rid in records_by_id]
        if group:
            clustered_record_groups.append(group)
            clustered_ids.update(id_set)

    # Add single-record clusters for unclustered records
    for rid, rec in records_by_id.items():
        if rid not in clustered_ids:
            clustered_record_groups.append([rec])

    return clustered_record_groups
