"""Unit tests for TASK S2-08: ER Pairwise Comparison Engine."""

import polars as pl

from app.processing.er.comparison import (
    calculate_pair_similarity_score,
    compare_candidate_pairs,
    jaro_winkler_similarity,
    levenshtein_distance,
    levenshtein_similarity,
)


class TestSimilarityMetrics20EdgeCases:
    """Validate comparison metrics across 20+ edge case string pairs."""

    def test_01_exact_match(self):
        assert jaro_winkler_similarity("Jonathan", "Jonathan") == 1.0
        assert levenshtein_similarity("1990-01-01", "1990-01-01") == 1.0

    def test_02_case_difference(self):
        assert jaro_winkler_similarity("alice", "ALICE") == 1.0
        assert levenshtein_similarity("abc", "ABC") == 1.0

    def test_03_single_char_typo(self):
        score = jaro_winkler_similarity("Jonathan", "Jonathon")
        assert 0.90 <= score < 1.0

    def test_04_transposition(self):
        score = jaro_winkler_similarity("Alexander", "Alexnadre")
        assert 0.80 <= score < 1.0

    def test_05_prefix_match(self):
        score = jaro_winkler_similarity("Robert", "Rob")
        assert 0.80 <= score < 1.0

    def test_06_suffix_match(self):
        score = jaro_winkler_similarity("Johnathan", "Nathan")
        assert 0.0 <= score < 0.85

    def test_07_completely_different(self):
        score = jaro_winkler_similarity("Alice", "Zachary")
        assert score < 0.60

    def test_08_both_none(self):
        assert jaro_winkler_similarity(None, None) == 0.0
        assert levenshtein_similarity(None, None) == 0.0

    def test_09_one_none(self):
        assert jaro_winkler_similarity("Alice", None) == 0.0
        assert levenshtein_similarity(None, "1990-05-10") == 0.0

    def test_10_both_empty_strings(self):
        assert jaro_winkler_similarity("", "") == 1.0
        assert levenshtein_similarity("", "") == 1.0

    def test_11_one_empty_string(self):
        assert jaro_winkler_similarity("Alice", "") == 0.0
        assert levenshtein_similarity("", "123") == 0.0

    def test_12_whitespace_padding(self):
        score = jaro_winkler_similarity("  Alice  ", "Alice")
        assert score == 1.0

    def test_13_special_characters(self):
        score = jaro_winkler_similarity("O'Connor", "OConnor")
        assert score > 0.90

    def test_14_numbers_in_string(self):
        dist = levenshtein_distance("12345", "12346")
        assert dist == 1
        assert 0.70 < levenshtein_similarity("12345", "12346") < 1.0

    def test_15_email_exact(self):
        assert jaro_winkler_similarity("alice@example.com", "alice@example.com") == 1.0

    def test_16_email_typo(self):
        score = jaro_winkler_similarity("alice@example.com", "alice@exampel.com")
        assert score > 0.90

    def test_17_dob_one_digit_diff(self):
        sim = levenshtein_similarity("1990-01-01", "1990-01-02")
        assert 0.85 <= sim < 1.0

    def test_18_dob_completely_different(self):
        sim = levenshtein_similarity("1990-01-01", "2024-12-31")
        assert sim < 0.60

    def test_19_phone_with_formatting(self):
        dist = levenshtein_distance("+1 (555) 0199", "15550199")
        assert dist > 0

    def test_20_long_string_partial_match(self):
        score = jaro_winkler_similarity("LuminAI Enterprise Data Engine Platform", "LuminAI Data Engine Platform")
        assert score > 0.80

    def test_21_unicode_characters(self):
        score = jaro_winkler_similarity("Müller", "Muller")
        assert score > 0.80


class TestWeightedConfidenceScore:
    """Tests for calculate_pair_similarity_score and weighting."""

    def test_perfect_pair_score(self):
        rec_a = {"name": "Alice Smith", "dob": "1990-01-01", "email": "alice@example.com"}
        rec_b = {"name": "Alice Smith", "dob": "1990-01-01", "email": "alice@example.com"}
        res = calculate_pair_similarity_score(rec_a, rec_b)
        assert res["confidence_score"] == 1.0
        assert 0.0 <= res["confidence_score"] <= 1.0

    def test_non_match_pair_score(self):
        rec_a = {"name": "Alice Smith", "dob": "1990-01-01", "email": "alice@example.com"}
        rec_b = {"name": "Zachary Taylor", "dob": "2020-05-15", "email": "zach@other.com"}
        res = calculate_pair_similarity_score(rec_a, rec_b)
        assert res["confidence_score"] < 0.60

    def test_partial_match_weighted(self):
        rec_a = {"name": "Alice Smith", "dob": "1990-01-01", "email": "alice@example.com"}
        rec_b = {"name": "Alice Smyth", "dob": "1990-01-01", "email": "alice@example.com"}
        res = calculate_pair_similarity_score(rec_a, rec_b)
        assert res["confidence_score"] >= 0.90

    def test_custom_weights(self):
        rec_a = {"name": "Alice Smith", "email": "alice@example.com"}
        rec_b = {"name": "Bob Jones", "email": "alice@example.com"}
        weights = {"name": 0.1, "email": 0.9}
        res = calculate_pair_similarity_score(rec_a, rec_b, weights=weights)
        assert res["confidence_score"] > 0.80

    def test_compare_candidate_pairs_dataframe(self):
        pairs_df = pl.DataFrame(
            {
                "id_a": ["1", "2"],
                "id_b": ["10", "20"],
                "name_a": ["Alice Smith", "John Doe"],
                "name_b": ["Alice Smyth", "Carol White"],
                "email_a": ["alice@example.com", "john@example.com"],
                "email_b": ["alice@example.com", "carol@example.com"],
            }
        )
        res_df = compare_candidate_pairs(pairs_df)
        assert "confidence_score" in res_df.columns
        assert res_df.height == 2
        scores = res_df["confidence_score"].to_list()
        assert all(0.0 <= s <= 1.0 for s in scores)
        assert scores[0] > scores[1]
