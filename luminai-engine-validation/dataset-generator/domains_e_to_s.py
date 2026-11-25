"""
Domain E (Geographic & Demographic Data),
Domain F (Survey, Categorical & Binary-vs-Numeric Disambiguation + >50% Null Reject),
Domain G (ML Classification, Regression, Clustering with Leakage/Collinearity/Scale), and
Domain S (Adversarial Security Test Strings & Structural CSV/JSON Edge Cases).

Strictly independent of `data-engine/app/`.
"""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any, Dict, List

import pyarrow as pa

from corruption_rules import (
    COUNTRY_MESSY_GHANA,
    COUNTRY_MESSY_UK,
    CorruptionManifest,
    FORMULA_INJECTION_PAYLOADS,
    GENDER_INVALID,
    GENDER_MESSY_FEMALE,
    GENDER_MESSY_MALE,
    GHANA_CITIES,
    INTERNATIONAL_CITIES,
    MOJIBAKE_NAMES,
    NULL_SENTINEL_STRINGS,
    SQLI_TEST_PAYLOADS,
    StreamingMultiWriter,
    XSS_TEST_PAYLOADS,
)
from reference_calculator import DomainStatsCollector


# ---------------------------------------------------------------------------
# Domain E: Geographic & Demographic Data (Ghanaian & International)
# ---------------------------------------------------------------------------

def generate_domain_e(
    tier: str,
    n_rows: int,
    seed: int,
    chunk_size: int,
    datasets_dir: Path,
    ref_dir: Path,
) -> Dict[str, Any]:
    rng = random.Random(seed + 505)
    manifest = CorruptionManifest("domain_e_geo_demographics", tier)
    headers = [
        "geo_id",
        "admin_code",
        "country",
        "region",
        "city",
        "latitude",
        "longitude",
        "population",
        "area_km2",
        "population_density",
        "survey_year",
    ]
    schema = pa.schema(
        [
            ("geo_id", pa.string()),
            ("admin_code", pa.string()),
            ("country", pa.string()),
            ("region", pa.string()),
            ("city", pa.string()),
            ("latitude", pa.float64()),
            ("longitude", pa.float64()),
            ("population", pa.int64()),
            ("area_km2", pa.float64()),
            ("population_density", pa.float64()),
            ("survey_year", pa.int64()),
        ]
    )

    writer = StreamingMultiWriter(
        headers=headers,
        csv_path=datasets_dir / tier / "domain_e_geo_demographics.csv",
        parquet_path=datasets_dir / tier / "domain_e_geo_demographics.parquet",
        json_array_path=datasets_dir / tier / "domain_e_geo_boundaries.json",
        json_array_limit=min(n_rows, 5000),
        parquet_schema=schema,
    )
    stats = DomainStatsCollector(
        numeric_cols=["latitude", "longitude", "population", "area_km2", "population_density"],
        categorical_cols=["country", "region", "city"],
    )

    chunk: List[Dict[str, Any]] = []
    invalid_coords = 0
    neg_pop = 0
    missing_regions_mnar = 0

    for i in range(n_rows):
        if i % 10 < 7:
            city, region, base_lat, base_lon = GHANA_CITIES[i % len(GHANA_CITIES)]
            country = "Ghana"
        else:
            country, region, city, base_lat, base_lon = INTERNATIONAL_CITIES[i % len(INTERNATIONAL_CITIES)]

        lat = round(base_lat + rng.uniform(-0.08, 0.08), 5)
        lon = round(base_lon + rng.uniform(-0.08, 0.08), 5)
        area = round(rng.uniform(25.0, 450.0), 2)
        pop = int(rng.randint(15_000, 3_200_000))
        density = round(pop / area, 2)

        row = {
            "geo_id": f"GEO-{i + 1:07d}",
            "admin_code": f"0{(i % 9) + 1}{(i % 89) + 10}",  # leading zero admin ID
            "country": country,
            "region": region,
            "city": city,
            "latitude": lat,
            "longitude": lon,
            "population": pop,
            "area_km2": area,
            "population_density": density,
            "survey_year": 2021 + (i % 5),
        }

        if country == "Ghana" and i % 3 == 0:
            row["country"] = COUNTRY_MESSY_GHANA[i % len(COUNTRY_MESSY_GHANA)]
        elif country == "United Kingdom" and i % 3 == 0:
            row["country"] = COUNTRY_MESSY_UK[i % len(COUNTRY_MESSY_UK)]

        if city == "Kumasi" and i % 25 == 0:
            row["city"] = "Kumasii"  # Intentional typo for difflib fuzzy suggestion
            manifest.record(i, "city", "fuzzy_city_misspelling", "Kumasi", "Kumasii", "Standardizer suggests 'Kumasi'")
        elif city == "Accra" and i % 4 == 0:
            row["city"] = "  accra "

        if city == "Tamale" and i % 2 == 0:
            # MNAR missing region in Northern districts
            row["region"] = ""
            missing_regions_mnar += 1
            manifest.record(i, "region", "missing_mnar", region, "", "Non-random missing region in Tamale")

        if i % 80 == 0:
            row["latitude"] = 95.45 if (i % 2 == 0) else -102.3
            row["longitude"] = -215.1
            invalid_coords += 1
            manifest.record(i, "latitude", "invalid_coordinate", lat, row["latitude"], "Impossible WGS84 coordinate outside [-90,90]")
        if i % 95 == 0:
            row["population"] = -pop
            neg_pop += 1
            manifest.record(i, "population", "negative_population", pop, -pop, "Impossible negative population")

        stats.observe_row(row, track_exact_dups=False)
        chunk.append(row)
        if len(chunk) >= chunk_size:
            writer.write_chunk(chunk)
            chunk.clear()

    if chunk:
        writer.write_chunk(chunk)
    writer.close()

    return {
        "domain": "E",
        "manifest": manifest.to_dict(total_clean_rows=n_rows, total_output_rows=n_rows),
        "reference_stats": {"geo_demographics": stats.to_dict()},
        "expected": {
            "total_rows": n_rows,
            "invalid_coordinate_rows": invalid_coords,
            "negative_population_rows": neg_pop,
            "missing_regions_mnar_tamale": missing_regions_mnar,
            "files": [
                "domain_e_geo_demographics.csv",
                "domain_e_geo_demographics.parquet",
                "domain_e_geo_boundaries.json",
            ],
        },
    }


# ---------------------------------------------------------------------------
# Domain F: Survey, Categorical & SchemaDetector Ambiguity Probes
# ---------------------------------------------------------------------------

def generate_domain_f(
    tier: str,
    n_rows: int,
    seed: int,
    chunk_size: int,
    datasets_dir: Path,
) -> Dict[str, Any]:
    rng = random.Random(seed + 606)
    manifest = CorruptionManifest("domain_f_survey_categorical", tier)
    headers = [
        "respondent_id",
        "age_group",
        "gender",
        "country",
        "city",
        "satisfaction_score",
        "binary_mixed_str",
        "numeric_digit_str",
        "pure_binary_int",
        "income_mnar",
        "free_text_comment",
    ]
    writer = StreamingMultiWriter(
        headers=headers,
        csv_path=datasets_dir / tier / "domain_f_survey.csv",
        ndjson_path=datasets_dir / tier / "domain_f_survey.ndjson",
    )
    stats = DomainStatsCollector(
        numeric_cols=["pure_binary_int", "income_mnar"],
        categorical_cols=["age_group", "gender", "country", "binary_mixed_str", "numeric_digit_str"],
    )

    age_groups = ("18-24", "25-34", "35-44", "45-54", "55+")
    comments_clean = (
        "Service in Accra branch was timely and helpful.",
        "Mobile app worked well during peak hours.",
        "Queue time at Kumasi counter could be faster.",
        "Good transparency on fees and settlement timing.",
    )
    chunk: List[Dict[str, Any]] = []
    mnar_missing = 0

    for i in range(n_rows):
        ag = age_groups[i % len(age_groups)]
        g = GENDER_MESSY_MALE[i % len(GENDER_MESSY_MALE)] if i % 2 == 0 else GENDER_MESSY_FEMALE[i % len(GENDER_MESSY_FEMALE)]
        if i % 60 == 0:
            g = GENDER_INVALID[i % len(GENDER_INVALID)]
        city, _, _, _ = GHANA_CITIES[i % len(GHANA_CITIES)]

        # Critical SchemaDetector disambiguation columns:
        # binary_mixed_str -> must infer BOOLEAN (["true", "false", "1", "0"])
        # numeric_digit_str -> must infer NUMBER (["0", "1", "2", "3"])
        bin_str = ("true", "false", "1", "0")[i % 4]
        num_str = ("0", "1", "2", "3")[i % 4]
        pure_int = i % 2

        sat: Any = 1 + (i % 5)
        if i % 20 == 0:
            sat = "Very Satisfied"  # Mixed ordinal text & numeric rating

        # Missing Not At Random (MNAR): >65% missing when age_group == "18-24"
        inc: Any = round(rng.uniform(450.0, 5500.0), 2)
        if ag == "18-24" and (i % 3 != 0):
            inc = None if (i % 2 == 0) else "N/A"
            mnar_missing += 1

        txt = comments_clean[i % len(comments_clean)]
        if i % 25 == 0:
            txt = f"<b>{txt}</b>  {MOJIBAKE_NAMES[i % len(MOJIBAKE_NAMES)]}"
        elif i % 35 == 0:
            txt = "Rating is x < y and y > z in Accra — Nyɛŋmɔ Café"
        elif i % 50 == 0:
            txt = NULL_SENTINEL_STRINGS[i % len(NULL_SENTINEL_STRINGS)]

        row = {
            "respondent_id": f"RESP-{i + 1:07d}",
            "age_group": ag,
            "gender": g,
            "country": COUNTRY_MESSY_GHANA[i % len(COUNTRY_MESSY_GHANA)],
            "city": city,
            "satisfaction_score": sat,
            "binary_mixed_str": bin_str,
            "numeric_digit_str": num_str,
            "pure_binary_int": pure_int,
            "income_mnar": inc,
            "free_text_comment": txt,
        }
        stats.observe_row(row, track_exact_dups=False)
        chunk.append(row)
        if len(chunk) >= chunk_size:
            writer.write_chunk(chunk)
            chunk.clear()

    if chunk:
        writer.write_chunk(chunk)
    writer.close()

    # Dedicated >50% sentinel-null pre-flight rejection trigger file (500 rows, 75% sentinels)
    reject_headers = ["id", "name", "sparse_sentinel_col"]
    reject_writer = StreamingMultiWriter(
        headers=reject_headers,
        csv_path=datasets_dir / tier / "domain_f_high_null_reject.csv",
    )
    reject_rows = []
    for i in range(500):
        sparse_val = NULL_SENTINEL_STRINGS[i % len(NULL_SENTINEL_STRINGS)] if (i % 4 != 0) else f"ok_{i}"
        reject_rows.append({"id": f"R-{i:04d}", "name": f"User {i}", "sparse_sentinel_col": sparse_val})
    reject_writer.write_chunk(reject_rows)
    reject_writer.close()

    return {
        "domain": "F",
        "manifest": manifest.to_dict(total_clean_rows=n_rows, total_output_rows=n_rows),
        "reference_stats": {"survey": stats.to_dict()},
        "expected": {
            "survey_rows": n_rows,
            "income_mnar_missing_in_18_24": mnar_missing,
            "schema_detector_types": {
                "binary_mixed_str": "boolean",
                "numeric_digit_str": "number",
                "pure_binary_int": "number",
                "income_mnar": "number",
            },
            "high_null_reject_file_expected_null_pct": 75.0,
            "high_null_reject_expected_passed_preflight": False,
            "files": [
                "domain_f_survey.csv",
                "domain_f_survey.ndjson",
                "domain_f_high_null_reject.csv",
            ],
        },
    }


# ---------------------------------------------------------------------------
# Domain G: ML Classification, Regression & Clustering
# ---------------------------------------------------------------------------

def generate_domain_g(
    tier: str,
    n_rows: int,
    seed: int,
    chunk_size: int,
    datasets_dir: Path,
) -> Dict[str, Any]:
    rng = random.Random(seed + 707)
    # Keep ML files bounded reasonably for HTTP ML API at <= 100k while testing full Polars/sklearn at tier scale
    ml_n = min(n_rows, 250_000)

    # 1. Classification (Imbalanced ~15% positive, Collinear, High-Cardinality, Leakage col, 5% missing targets)
    cls_headers = [
        "record_id",
        "age",
        "tenure_months",
        "annual_income_usd",
        "annual_income_k_collinear",
        "support_tickets",
        "merchant_code_high_card",
        "leakage_post_churn_refund",
        "churn",
    ]
    cls_writer = StreamingMultiWriter(
        headers=cls_headers,
        csv_path=datasets_dir / tier / "domain_g_ml_classification.csv",
    )
    cls_stats = DomainStatsCollector(
        numeric_cols=["age", "tenure_months", "annual_income_usd", "annual_income_k_collinear", "support_tickets", "churn"],
        categorical_cols=["merchant_code_high_card"],
    )
    cls_chunk: List[Dict[str, Any]] = []
    cls_missing_targets = 0
    cls_pos = 0
    cls_neg = 0

    for i in range(ml_n):
        age = 20 + (i * 11) % 55
        tenure = 1 + (i * 5) % 72
        inc = round(20_000.0 + ((i * 313) % 90_000) + rng.gauss(0, 1500), 2)
        inc_k = round((inc / 1000.0) + rng.gauss(0, 0.25), 3)  # >0.99 collinearity
        tickets = (i % 10) if (i % 6 == 0) else (i % 3)
        merchant = f"MRCH-{(i * 7) % 60:03d}"  # 60 categories (tests top-10 OHE inside train split)
        # Deterministic separable latent score (~15% churn=1)
        score = (0.9 * tickets) - (0.04 * tenure) - (0.000015 * inc) + rng.gauss(0, 0.4)
        label = 1 if score > 1.35 else 0
        leak = 1 if (label == 1 and rng.random() < 0.96) else 0  # Explicit data leakage feature

        target_out: Any = label
        if i % 20 == 0:  # 5% missing targets -> ml_engine must drop these rows BEFORE split!
            target_out = None if (i % 40 == 0) else "N/A"
            cls_missing_targets += 1
        elif label == 1:
            cls_pos += 1
        else:
            cls_neg += 1

        row = {
            "record_id": f"MLC-{i + 1:07d}",
            "age": float("nan") if (i % 50 == 1) else age,
            "tenure_months": tenure,
            "annual_income_usd": inc,
            "annual_income_k_collinear": inc_k,
            "support_tickets": tickets,
            "merchant_code_high_card": merchant,
            "leakage_post_churn_refund": leak,
            "churn": target_out,
        }
        cls_stats.observe_row(row, track_exact_dups=False)
        cls_chunk.append(row)
        if len(cls_chunk) >= chunk_size:
            cls_writer.write_chunk(cls_chunk)
            cls_chunk.clear()
    if cls_chunk:
        cls_writer.write_chunk(cls_chunk)
    cls_writer.close()

    # 2. Regression (Wildly different scales + 5% missing targets)
    reg_headers = [
        "property_id",
        "square_feet",
        "micro_risk_index",
        "bedrooms",
        "city_tier",
        "target_price_usd",
    ]
    reg_writer = StreamingMultiWriter(
        headers=reg_headers,
        csv_path=datasets_dir / tier / "domain_g_ml_regression.csv",
    )
    reg_stats = DomainStatsCollector(
        numeric_cols=["square_feet", "micro_risk_index", "bedrooms", "target_price_usd"],
        categorical_cols=["city_tier"],
    )
    reg_chunk: List[Dict[str, Any]] = []
    reg_missing_targets = 0
    for i in range(ml_n):
        sqft = round(650.0 + ((i * 37) % 3400), 1)
        micro = round(0.001 + ((i % 50) * 0.001), 4)
        beds = 1 + (i % 5)
        ctier = ("Accra-Prime", "Kumasi-Metro", "Regional")[i % 3]
        ctier_bonus = {"Accra-Prime": 35000.0, "Kumasi-Metro": 12000.0, "Regional": 0.0}[ctier]
        price = round(50_000.0 + 180.0 * sqft + 12_000.0 * beds - 450_000.0 * micro + ctier_bonus + rng.gauss(0, 2500.0), 2)
        t_out: Any = price
        if i % 20 == 0:
            t_out = "" if (i % 40 == 0) else "corrupt_price"
            reg_missing_targets += 1
        row = {
            "property_id": f"MLR-{i + 1:07d}",
            "square_feet": sqft,
            "micro_risk_index": micro,
            "bedrooms": beds,
            "city_tier": ctier,
            "target_price_usd": t_out,
        }
        reg_stats.observe_row(row, track_exact_dups=False)
        reg_chunk.append(row)
        if len(reg_chunk) >= chunk_size:
            reg_writer.write_chunk(reg_chunk)
            reg_chunk.clear()
    if reg_chunk:
        reg_writer.write_chunk(reg_chunk)
    reg_writer.close()

    # 3. Clustering (3 clean isotropic clusters on extreme mismatched scales; NO target_column!)
    clu_headers = ["entity_id", "feature_scale_100k", "feature_scale_unit", "feature_scale_neg", "true_cluster_ref"]
    clu_schema = pa.schema(
        [
            ("entity_id", pa.string()),
            ("feature_scale_100k", pa.float64()),
            ("feature_scale_unit", pa.float64()),
            ("feature_scale_neg", pa.float64()),
            ("true_cluster_ref", pa.int64()),
        ]
    )
    clu_n = min(ml_n, 50_000)
    clu_writer = StreamingMultiWriter(
        headers=clu_headers,
        parquet_path=datasets_dir / tier / "domain_g_ml_clustering.parquet",
        csv_path=datasets_dir / tier / "domain_g_ml_clustering.csv",
        parquet_schema=clu_schema,
    )
    clu_chunk: List[Dict[str, Any]] = []
    centers = ((10_000.0, 0.1, -50.0), (50_000.0, 0.5, 0.0), (90_000.0, 0.9, 50.0))
    for i in range(clu_n):
        c_id = i % 3
        c0, c1, c2 = centers[c_id]
        clu_chunk.append(
            {
                "entity_id": f"CLU-{i + 1:06d}",
                "feature_scale_100k": round(rng.gauss(c0, 1200.0), 2),
                "feature_scale_unit": round(rng.gauss(c1, 0.03), 5),
                "feature_scale_neg": round(rng.gauss(c2, 3.0), 2),
                "true_cluster_ref": c_id,
            }
        )
        if len(clu_chunk) >= chunk_size:
            clu_writer.write_chunk(clu_chunk)
            clu_chunk.clear()
    if clu_chunk:
        clu_writer.write_chunk(clu_chunk)
    clu_writer.close()

    return {
        "domain": "G",
        "reference_stats": {
            "classification": cls_stats.to_dict(),
            "regression": reg_stats.to_dict(),
        },
        "expected": {
            "classification": {
                "total_rows": ml_n,
                "missing_target_rows_must_be_dropped": cls_missing_targets,
                "expected_trained_valid_rows": ml_n - cls_missing_targets,
                "valid_class_1_count": cls_pos,
                "valid_class_0_count": cls_neg,
                "collinear_pair": ["annual_income_usd", "annual_income_k_collinear"],
                "leakage_feature_to_exclude_in_honest_run": "leakage_post_churn_refund",
            },
            "regression": {
                "total_rows": ml_n,
                "missing_target_rows_must_be_dropped": reg_missing_targets,
                "expected_trained_valid_rows": ml_n - reg_missing_targets,
                "true_r2_without_leakage_min": 0.90,
            },
            "clustering": {
                "total_rows": clu_n,
                "true_k": 3,
                "note": "Drop 'entity_id' and 'true_cluster_ref' when passing features to K-Means WITHOUT target_column; StandardScaler should give silhouette > 0.70.",
            },
            "files": [
                "domain_g_ml_classification.csv",
                "domain_g_ml_regression.csv",
                "domain_g_ml_clustering.parquet",
                "domain_g_ml_clustering.csv",
            ],
        },
    }


# ---------------------------------------------------------------------------
# Domain S: Security Payloads & Structural Format Edge Cases
# ---------------------------------------------------------------------------

def generate_domain_s(tier: str, datasets_dir: Path) -> Dict[str, Any]:
    out = datasets_dir / tier
    out.mkdir(parents=True, exist_ok=True)

    # 1. Adversarial string payloads (strictly static synthetic test data, NEVER executed)
    adv_headers = ["id", "name", "email", "notes"]
    adv_writer = StreamingMultiWriter(
        headers=adv_headers,
        csv_path=out / "domain_s_adversarial.csv",
    )
    adv_rows = [
        {"id": "SEC-001", "name": FORMULA_INJECTION_PAYLOADS[0], "email": "sec1@test.gh", "notes": FORMULA_INJECTION_PAYLOADS[1]},
        {"id": "SEC-002", "name": SQLI_TEST_PAYLOADS[0], "email": "sec2@test.gh", "notes": SQLI_TEST_PAYLOADS[1]},
        {"id": "SEC-003", "name": XSS_TEST_PAYLOADS[0], "email": "sec3@test.gh", "notes": XSS_TEST_PAYLOADS[3]},
        {"id": "SEC-004", "name": "Alice\u202ebob RTL", "email": "sec4@test.gh", "notes": "Control\x00NullByte + Long:" + ("A" * 8192)},
        {"id": "SEC-005", "name": "  Kwame  Mensah ", "email": "kwame@test.gh", "notes": "Benign string containing DROP and SELECT"},
    ]
    adv_writer.write_chunk(adv_rows)
    adv_writer.close()

    # 2. Structural chaos CSV: ragged rows, empty column, embedded quoted comma/newline, unexpected col
    struct_csv = out / "domain_s_structural_edge.csv"
    struct_csv.write_text(
        "id, name ,email,always_empty,amount\n"
        "1,\"Mensah, Kwame\",kwame@example.gh,,100.5\n"
        "2,\"Line1\nLine2\",abena@example.gh,,200.0\n"
        "3,ShortRow\n"
        "4,ExtraCol,kofi@example.gh,,300.0,UNEXPECTED_EXTRA\n",
        encoding="utf-8",
    )

    # 3. Unexpected nested JSON + Malformed JSON + Empty 0-byte CSV
    (out / "domain_s_nested.json").write_text(
        json.dumps(
            [
                {"id": "N1", "meta": {"nested": {"deep": [1, 2, {"x": "val"}]}}, "null_byte_str": "abc\u0000def"},
                {"id": "N2", "meta": None, "tags": ["a", "b"]},
            ],
            indent=2,
        ),
        encoding="utf-8",
    )
    (out / "domain_s_malformed.json").write_text('[{"id": "M1", "broken": ', encoding="utf-8")
    (out / "domain_s_empty.csv").write_bytes(b"")

    return {
        "domain": "S",
        "expected": {
            "adversarial_rows": len(adv_rows),
            "files": [
                "domain_s_adversarial.csv",
                "domain_s_structural_edge.csv",
                "domain_s_nested.json",
                "domain_s_malformed.json",
                "domain_s_empty.csv",
            ],
        },
    }
