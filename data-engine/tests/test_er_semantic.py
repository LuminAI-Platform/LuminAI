"""Unit and integration tests for semantic Entity Resolution & vectorized comparison.

Covers:
1. Nickname canonicalization (Bob -> robert, Bill -> william, etc.).
2. Acronym matching (IBM vs International Business Machines).
3. N-gram cosine similarity.
4. Combined semantic name similarity scoring.
5. Blocking key alignment for nickname variants (Bob Jones vs Robert Jones).
6. Vectorized candidate pair comparison speed & schema conformance.
"""

import polars as pl

from app.processing.er.blocking import generate_blocking_key
from app.processing.er.comparison import calculate_pair_similarity_score, compare_candidate_pairs
from app.processing.er.semantic import (
    canonicalize_name,
    is_acronym_match,
    ngram_cosine_similarity,
    semantic_name_similarity,
)


class TestSemanticMatching:
    """Test suite for semantic ER algorithms."""

    def test_canonicalize_name_nicknames(self):
        assert canonicalize_name("Bob") == "robert"
        assert canonicalize_name("Bobby") == "robert"
        assert canonicalize_name("Rob") == "robert"
        assert canonicalize_name("Bill") == "william"
        assert canonicalize_name("Billy") == "william"
        assert canonicalize_name("Jim") == "james"
        assert canonicalize_name("Jimmy") == "james"
        assert canonicalize_name("Dick") == "richard"
        assert canonicalize_name("Peggy") == "margaret"
        assert canonicalize_name("Beth") == "elizabeth"
        assert canonicalize_name("Alexander") == "alexander"

    def test_is_acronym_match(self):
        assert is_acronym_match("IBM", "International Business Machines")
        assert is_acronym_match("International Business Machines", "IBM")
        assert is_acronym_match("GE", "General Electric")
        assert is_acronym_match("MIT", "Massachusetts Institute of Technology")
        assert not is_acronym_match("IBM", "Microsoft Corporation")
        assert not is_acronym_match("ABC", "Apple Banana")

    def test_ngram_cosine_similarity(self):
        score_identical = ngram_cosine_similarity("Jonathan", "Jonathan")
        assert score_identical == 1.0

        score_similar = ngram_cosine_similarity("Jonathan", "Johnathan")
        assert score_similar > 0.65

        score_diff = ngram_cosine_similarity("Jonathan", "Alexander")
        assert score_diff < 0.3

    def test_semantic_name_similarity_nicknames(self):
        # Bob vs Robert should yield a high similarity score (> 0.90)
        score = semantic_name_similarity("Bob Jones", "Robert Jones")
        assert score >= 0.90

        # Bill Smith vs William Smith
        score_bill = semantic_name_similarity("Bill Smith", "William Smith")
        assert score_bill >= 0.90

        # Acronym match
        score_acronym = semantic_name_similarity("IBM Corp", "International Business Machines Corp")
        assert score_acronym >= 0.90

    def test_blocking_key_canonicalization(self):
        # Bob Jones and Robert Jones should yield the exact same blocking key
        key_bob = generate_blocking_key("Bob Jones", "US", "PERSON")
        key_robert = generate_blocking_key("Robert Jones", "US", "PERSON")
        assert key_bob == key_robert
        assert "US" in key_bob


class TestVectorizedComparison:
    """Test suite for vectorized candidate pair comparison."""

    def test_calculate_pair_similarity_score_with_semantics(self):
        row_a = {"full_name": "Bob Smith", "dob": "1985-05-12", "email": "bsmith@example.com"}
        row_b = {"full_name": "Robert Smith", "dob": "1985-05-12", "email": "bsmith@example.com"}

        score_res = calculate_pair_similarity_score(row_a, row_b)
        assert score_res["score_name"] >= 0.90
        assert score_res["score_dob"] == 1.0
        assert score_res["score_email"] == 1.0
        assert score_res["confidence_score"] >= 0.90

    def test_compare_candidate_pairs_vectorized(self):
        candidate_pairs = pl.DataFrame({
            "record_id_l": ["r1", "r2", "r3"],
            "full_name_l": ["Bob Smith", "Alice Johnson", "IBM"],
            "dob_l": ["1985-05-12", "1990-01-01", None],
            "email_l": ["bsmith@example.com", "alice@test.com", None],
            "record_id_r": ["r1-dup", "r2-diff", "r3-long"],
            "full_name_r": ["Robert Smith", "Zachary Taylor", "International Business Machines"],
            "dob_r": ["1985-05-12", "2020-05-15", None],
            "email_r": ["robert.smith@example.com", "zach@corp.io", None],
        })

        scored_df = compare_candidate_pairs(candidate_pairs)

        # Check required schema columns
        expected_cols = {
            "record_id_l",
            "record_id_r",
            "score_name",
            "score_dob",
            "score_email",
            "confidence_score",
        }
        for col in expected_cols:
            assert col in scored_df.columns

        assert scored_df.height == 3

        # Bob vs Robert pair confidence should be high (> 0.85)
        row_bob = scored_df.filter(pl.col("record_id_l") == "r1").to_dicts()[0]
        assert row_bob["score_name"] >= 0.90
        assert row_bob["confidence_score"] > 0.85

        # Alice vs Zachary should be non-match (< 0.60, below review threshold 0.70)
        row_alice = scored_df.filter(pl.col("record_id_l") == "r2").to_dicts()[0]
        assert row_alice["score_name"] < 0.70
        assert row_alice["confidence_score"] < 0.60
