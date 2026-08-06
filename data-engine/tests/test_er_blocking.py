"""Unit tests for TASK S2-07: ER Blocking Engine."""

import polars as pl

from app.processing.er.blocking import (
    calculate_blocking_reduction_ratio,
    generate_blocking_key,
    generate_blocking_keys_frame,
    generate_candidate_pairs,
)


class TestBlockingKeyGeneration:
    """Tests for generate_blocking_key logic and edge cases."""

    def test_standard_name(self):
        """Standard name produces valid Metaphone key."""
        key = generate_blocking_key("Alice Smith", "UK", "Person")
        assert key.endswith("_UK_Person")
        assert not key.startswith("EMPTY")

    def test_phonetic_equivalence(self):
        """Phonetically similar names produce matching blocking keys."""
        key1 = generate_blocking_key("Smith", "US", "Person")
        key2 = generate_blocking_key("Smyth", "US", "Person")
        assert key1 == key2

    def test_case_and_whitespace_normalization(self):
        """Whitespace and casing in country/entity type are normalized."""
        key1 = generate_blocking_key("  Bob Jones  ", " us ", " person ")
        key2 = generate_blocking_key("Bob Jones", "US", "Person")
        assert key1 == key2

    def test_null_name(self):
        """Null or None name defaults to EMPTY."""
        key = generate_blocking_key(None, "CA", "Person")
        assert key == "EMPTY_CA_Person"

    def test_empty_string_name(self):
        """Empty string name defaults to EMPTY."""
        key = generate_blocking_key("   ", "CA", "Person")
        assert key == "EMPTY_CA_Person"

    def test_special_characters_and_punctuation(self):
        """Special characters in names are stripped cleanly."""
        key1 = generate_blocking_key("O'Connor-Smith!", "IE", "Person")
        key2 = generate_blocking_key("OConnorSmith", "IE", "Person")
        assert key1 == key2

    def test_numeric_name(self):
        """Pure numeric names default to EMPTY."""
        key = generate_blocking_key("12345", "US", "Person")
        assert key == "EMPTY_US_Person"

    def test_null_country_and_entity(self):
        """Null country and entity_type fall back to GLOBAL and DEFAULT."""
        key = generate_blocking_key("Alice", None, None)
        assert key.endswith("_GLOBAL_DEFAULT")


class TestCandidatePairGeneration:
    """Tests for DataFrame blocking and candidate pair generation."""

    def test_generate_blocking_keys_frame(self):
        """Adds block_key column to DataFrame."""
        df = pl.DataFrame(
            {
                "id": ["1", "2"],
                "name": ["Alice Smith", "Bob Jones"],
                "country": ["UK", "US"],
                "entity_type": ["Person", "Person"],
            }
        )
        result = generate_blocking_keys_frame(df)
        assert "block_key" in result.columns
        assert result.height == 2

    def test_candidate_pairs_groups_matching_blocks(self):
        """Generates candidate pairs for records sharing block keys."""
        df = pl.DataFrame(
            {
                "id": ["1", "2", "3"],
                "name": ["Alice Smith", "Alice Smyth", "Carol White"],
                "country": ["UK", "UK", "US"],
                "entity_type": ["Person", "Person", "Person"],
            }
        )
        pairs = generate_candidate_pairs(df)
        assert pairs.height == 1  # Record 1 and 2
        row = pairs.to_dicts()[0]
        assert row["id_a"] == "1"
        assert row["id_b"] == "2"

    def test_blocking_space_reduction_ratio(self):
        """Blocking drops pair comparison space by > 90% on benchmark dataset."""
        # Create 100 records split across 10 distinct countries/names
        records = []
        for i in range(100):
            group = i % 10
            records.append(
                {
                    "id": f"rec-{i:03d}",
                    "name": f"NameGroup{group}",
                    "country": f"C{group}",
                    "entity_type": "Person",
                }
            )
        df = pl.DataFrame(records)
        pairs = generate_candidate_pairs(df)

        total_records = 100
        # N * (N - 1) / 2 = 4950
        candidate_count = pairs.height
        reduction = calculate_blocking_reduction_ratio(total_records, candidate_count)

        assert reduction > 0.90, f"Expected reduction > 90%, got {reduction:.2%}"

    def test_reduction_ratio_edge_cases(self):
        """Calculation helper returns 1.0 for small or empty record sets."""
        assert calculate_blocking_reduction_ratio(0, 0) == 1.0
        assert calculate_blocking_reduction_ratio(1, 0) == 1.0
        assert calculate_blocking_reduction_ratio(10, 0) == 1.0
