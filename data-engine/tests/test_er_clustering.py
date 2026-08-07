"""Unit tests for ER Clustering & Golden Record Merge Engine."""

import polars as pl

from app.processing.er.clustering import (
    cluster_record_dictionaries,
    find_connected_components,
)
from app.processing.er.golden_record import (
    merge_cluster_to_golden_record,
    merge_clusters_to_golden_records,
    persist_golden_records,
)


class TestConnectedComponentsClustering:
    """Tests for graph clustering and transitive closure (A=B, B=C => {A,B,C})."""

    def test_simple_pair(self):
        matches = pl.DataFrame({"id_a": ["1"], "id_b": ["2"]})
        clusters = find_connected_components(matches)
        assert len(clusters) == 1
        assert clusters[0] == {"1", "2"}

    def test_transitive_closure(self):
        """A=B and B=C resolves into single cluster {A, B, C}."""
        matches = pl.DataFrame({"id_a": ["A", "B"], "id_b": ["B", "C"]})
        clusters = find_connected_components(matches)
        assert len(clusters) == 1
        assert clusters[0] == {"A", "B", "C"}

    def test_disjoint_clusters(self):
        """Separate components remain distinct clusters."""
        matches = pl.DataFrame({"id_a": ["1", "3"], "id_b": ["2", "4"]})
        clusters = find_connected_components(matches)
        assert len(clusters) == 2
        cluster_sets = [c for c in clusters]
        assert {"1", "2"} in cluster_sets
        assert {"3", "4"} in cluster_sets

    def test_cluster_record_dictionaries_includes_singles(self):
        matches = pl.DataFrame({"id_a": ["1"], "id_b": ["2"]})
        all_records = [
            {"id": "1", "name": "Alice Smith"},
            {"id": "2", "name": "Alice Smyth"},
            {"id": "3", "name": "Carol White"},
        ]
        clustered_groups = cluster_record_dictionaries(matches, all_records)
        assert len(clustered_groups) == 2  # {1,2} and {3}
        group_sizes = sorted([len(g) for g in clustered_groups])
        assert group_sizes == [1, 2]


class TestGoldenRecordMerge:
    """Tests for merging record clusters into canonical Golden Records."""

    def test_merge_selects_non_null_and_longest_string(self):
        cluster = [
            {"id": "1", "name": "Alice", "country": "UK", "email": None},
            {"id": "2", "name": "Alice Smith", "country": None, "email": "alice@example.com"},
        ]
        gr = merge_cluster_to_golden_record(cluster, tenant_id="acme")
        assert gr["name"] == "Alice Smith"
        assert gr["country"] == "UK"
        assert gr["email"] == "alice@example.com"
        assert gr["cluster_size"] == 2
        assert set(gr["source_record_ids"]) == {"1", "2"}

    def test_merge_selects_latest_timestamp(self):
        cluster = [
            {"id": "1", "name": "Old Name", "joined_at": "2020-01-01"},
            {"id": "2", "name": "New Name", "joined_at": "2024-06-01"},
        ]
        gr = merge_cluster_to_golden_record(cluster)
        assert gr["name"] == "New Name"

    def test_merge_clusters_to_golden_records_dataframe(self):
        clusters = [
            [{"id": "1", "name": "Alice Smith"}, {"id": "2", "name": "Alice Smyth"}],
            [{"id": "3", "name": "Bob Jones"}],
        ]
        df = merge_clusters_to_golden_records(clusters, tenant_id="test-tenant")
        assert isinstance(df, pl.DataFrame)
        assert df.height == 2
        assert "golden_id" in df.columns
        assert "cluster_size" in df.columns

    def test_persist_golden_records(self):
        clusters = [[{"id": "1", "name": "Alice Smith"}, {"id": "2", "name": "Alice Smyth"}]]
        df = merge_clusters_to_golden_records(clusters, tenant_id="test-tenant")
        count = persist_golden_records(df, tenant_id="test-tenant")
        assert count == 1
