"""Unit tests for ER Classification Engine."""

import polars as pl

from app.processing.er.classification import (
    classify_candidate_pairs,
    classify_pair,
    persist_review_candidates,
)


class TestPairClassification:
    """Tests for single pair decision threshold logic."""

    def test_match_decision(self):
        assert classify_pair(0.95) == "match"
        assert classify_pair(0.90) == "match"

    def test_review_decision(self):
        assert classify_pair(0.89) == "review"
        assert classify_pair(0.70) == "review"

    def test_non_match_decision(self):
        assert classify_pair(0.69) == "non_match"
        assert classify_pair(0.10) == "non_match"

    def test_custom_thresholds(self):
        # Match >= 0.80, Review >= 0.50
        assert classify_pair(0.85, match_threshold=0.80, review_threshold=0.50) == "match"
        assert classify_pair(0.60, match_threshold=0.80, review_threshold=0.50) == "review"
        assert classify_pair(0.40, match_threshold=0.80, review_threshold=0.50) == "non_match"


class TestDataFrameClassification:
    """Tests for DataFrame classification into matches, review, non-matches."""

    def test_classify_candidate_pairs_dataframe(self):
        df = pl.DataFrame(
            {
                "id_a": ["1", "2", "3"],
                "id_b": ["10", "20", "30"],
                "confidence_score": [0.95, 0.75, 0.40],
            }
        )

        matches, review, non_matches = classify_candidate_pairs(df)

        assert matches.height == 1
        assert matches["id_a"].to_list() == ["1"]
        assert matches["decision"].to_list() == ["match"]

        assert review.height == 1
        assert review["id_a"].to_list() == ["2"]
        assert review["decision"].to_list() == ["review"]

        assert non_matches.height == 1
        assert non_matches["id_a"].to_list() == ["3"]
        assert non_matches["decision"].to_list() == ["non_match"]

    def test_empty_dataframe_classification(self):
        df = pl.DataFrame(schema={"id_a": pl.String, "id_b": pl.String, "confidence_score": pl.Float64})
        matches, review, non_matches = classify_candidate_pairs(df)
        assert matches.height == 0
        assert review.height == 0
        assert non_matches.height == 0

    def test_persist_review_candidates(self):
        review_df = pl.DataFrame(
            {
                "id_a": ["2"],
                "id_b": ["20"],
                "confidence_score": [0.78],
                "name_a": ["Alice Smith"],
                "name_b": ["Alice Smyth"],
            }
        )
        count = persist_review_candidates(review_df, tenant_id="test-tenant")
        assert count == 1
