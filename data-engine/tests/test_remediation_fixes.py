"""Comprehensive regression suite covering all 20 Data Engine remediation fixes."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import io
import math
import zipfile

from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI
from fastapi.testclient import TestClient
import jwt
import polars as pl
import pytest

from app.config import Settings
from app.main import app
from app.processing.analytics_engine import DuckDBAnalyticsEngine
from app.processing.dashboard_service.quality_calculator import compute_data_quality
from app.processing.engine.cleaning_engine import CleaningEngine, CleaningStepConfig
from app.processing.engine.cleaning_operations import (
    apply_fill_missing,
    apply_handle_outliers,
    apply_remove_missing,
)
from app.processing.engine.dataset_cleaner import DatasetCleaner
from app.processing.engine.eda_engine import EdaEngine
from app.processing.engine.pipeline_builder import PipelineBuilderEngine, TransformationStep
from app.processing.engine.profiler import DataProfiler
from app.processing.er.comparison import (
    calculate_pair_similarity_score,
    compare_candidate_pairs,
)
from app.processing.er.provenance import track_field_provenance
from app.processing.minio_client import MinioRawStorageClient
from app.processing.minio_client.parsers import parse_raw_data_to_dataframe
from app.processing.ml.ml_engine import MachineLearningEngine
from app.processing.pipelines.ingest_pipeline import defs
from app.processing.schema_detector import ColumnType, SchemaDetector
from app.rate_limit import RateLimitMiddleware, SlidingWindowRateLimiter, reset_rate_limits
from app.security import KeycloakTokenValidator


def _build_minimal_xlsx_bytes() -> bytes:
    """Create a valid OOXML .xlsx zip workbook purely with stdlib for fastexcel verification."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            "</Types>",
        )
        zf.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            "</Relationships>",
        )
        zf.writestr(
            "xl/_rels/workbook.xml.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            "</Relationships>",
        )
        zf.writestr(
            "xl/workbook.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>'
            "</workbook>",
        )
        zf.writestr(
            "xl/worksheets/sheet1.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            "<sheetData>"
            '<row r="1">'
            '<c r="A1" t="inlineStr"><is><t>name</t></is></c>'
            '<c r="B1" t="inlineStr"><is><t>amount</t></is></c>'
            "</row>"
            '<row r="2">'
            '<c r="A2" t="inlineStr"><is><t>Ama Mensah</t></is></c>'
            '<c r="B2"><v>420.5</v></c>'
            "</row>"
            "</sheetData>"
            "</worksheet>",
        )
    return buf.getvalue()


def test_real_jwt_with_sandbox_in_claims_not_escalated():
    """Real signed JWT containing 'sandbox' in claims must NOT bypass RBAC in dev mode."""
    priv = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": "viewer-1",
            "preferred_username": "viewer",
            "realm_access": {"roles": ["viewer"]},
            "tenant_id": "sandbox-org",
            "exp": int((now + timedelta(hours=1)).timestamp()),
        },
        priv,
        algorithm="RS256",
    )
    settings = Settings(auth_enabled=True, environment="development", enable_mock_auth=True, api_key="dev-key")
    # Validator has no JWKS/public key configured -> must attempt JWT verification (not return mock admin!)
    validator = KeycloakTokenValidator(settings)
    with pytest.raises(Exception) as exc_info:
        validator.validate_token(token)
    assert getattr(exc_info.value, "status_code", None) == 401


def test_rate_limit_ignores_spoofed_headers_when_auth_enabled():
    """Rotating X-Tenant-ID / X-Forwarded-For cannot bypass rate limits in protected mode."""
    reset_rate_limits()
    test_app = FastAPI()
    test_app.add_middleware(RateLimitMiddleware, limiter=SlidingWindowRateLimiter(window_seconds=60.0))

    @test_app.get("/analytics/ml/train")
    def heavy():
        return {"ok": True}

    tc = TestClient(test_app)
    with pytest.MonkeyPatch.context() as m:
        m.setattr(
            "app.rate_limit.get_settings",
            lambda: Settings(
                auth_enabled=True,
                rate_limit_enabled=True,
                rate_limit_pipeline_per_minute=2,
                api_key="real-secret",
            ),
        )
        assert tc.get("/analytics/ml/train", headers={"X-Tenant-ID": "t1", "X-Forwarded-For": "1.1.1.1"}).status_code == 200
        assert tc.get("/analytics/ml/train", headers={"X-Tenant-ID": "t2", "X-Forwarded-For": "2.2.2.2"}).status_code == 200
        assert tc.get("/analytics/ml/train", headers={"X-Tenant-ID": "t3", "X-Forwarded-For": "3.3.3.3"}).status_code == 429


def test_sql_studio_hardening_and_trailing_semicolon():
    """SQL Studio allows string literals/trailing ';' with exact total_count and blocks CALL/multi-statements."""
    tc = TestClient(app)
    tables = {"items": [{"id": 1, "label": "DROP"}, {"id": 2, "label": "KEEP"}, {"id": 3, "label": "TEST"}]}

    # Valid trailing semicolon + 'DROP' string literal + limit=1 must report total_count=3
    res = tc.post(
        "/analytics/sql/execute",
        json={"query": "SELECT id, label FROM items WHERE label = 'DROP' OR id > 0;", "tables": tables, "limit": 1},
    )
    assert res.status_code == 200
    assert res.json()["total_count"] == 3
    assert res.json()["row_count"] == 1

    # Multi-statement or READ_CSV_AUTO/CALL must be rejected
    for bad in ("SELECT 1; SELECT 2", "CALL duckdb_tables()", "SELECT * FROM READ_CSV_AUTO('x.csv')"):
        r = tc.post("/analytics/sql/execute", json={"query": bad, "tables": tables})
        assert r.status_code == 400


def test_minio_sibling_prefix_and_dual_failure_safety(tmp_path):
    """Sibling prefix traversal is rejected and failing both MinIO and local write returns False (never UnboundLocalError)."""
    base_dir = tmp_path / "minio"
    sibling_dir = tmp_path / "minio_evil"
    base_dir.mkdir()
    sibling_dir.mkdir()

    client = MinioRawStorageClient(endpoint="127.0.0.1:59999", local_fallback_dir=str(base_dir))
    with pytest.raises(ValueError):
        client._safe_local_path("../minio_evil", "secret.csv")

    # Simulate unwritable local fallback dir + unreachable MinIO -> must return False cleanly
    client_bad = MinioRawStorageClient(endpoint="127.0.0.1:59999", local_fallback_dir=str(tmp_path / "missing_file"))
    (tmp_path / "missing_file").write_text("not-a-directory", encoding="utf-8")
    assert client_bad.put_object_bytes("bucket", "k.csv", b"a,b\n1,2\n") is False


def test_dagster_hourly_schedule_selection_valid():
    """hourly_cleaning_pipeline_job resolves 'raw_ingestion_data' without AssetSelection errors."""
    job_def = defs.get_job_def("hourly_cleaning_pipeline_job")
    assert job_def is not None
    keys = {k.to_user_string() for k in job_def.asset_layer_config.asset_keys} if hasattr(job_def, "asset_layer_config") else {k.to_user_string() for k in defs.resolve_asset_graph().get_all_asset_keys()}
    assert "raw_ingestion_data" in keys


def test_excel_and_resilient_csv_ingestion():
    """Excel bytes parse via fastexcel; cp1252/sentinel-heavy CSVs emit warnings and detect numbers vs booleans."""
    xlsx_bytes = _build_minimal_xlsx_bytes()
    detector = SchemaDetector()
    xlsx_report = detector.validate_file_bytes(xlsx_bytes, file_name="sales.xlsx")
    assert xlsx_report.is_valid is True
    assert xlsx_report.total_rows == 1

    parsed_df = parse_raw_data_to_dataframe(xlsx_bytes, "sales.xlsx", "luminai-raw")
    assert parsed_df["name"][0] == "Ama Mensah"

    # cp1252 CSV with >50% NULL sentinels
    cp1252_csv = "id,name,notes\n1,Kofi,N/A\n2,Ama,NULL\n3,Yaw,valid\n".encode("cp1252")
    cp1252_csv_bad_byte = b"id,name,notes\n1,M\xfcller,N/A\n2,Ama,NULL\n3,Yaw,NULL\n"
    rep = detector.validate_file_bytes(cp1252_csv_bad_byte, file_name="messy.csv")
    assert rep.is_valid is False
    assert "notes" in rep.rejected_columns
    assert any("cp1252" in w for w in rep.warnings)
    assert cp1252_csv  # ensure variable used cleanly

    # Numeric 0/1/2/3 must NOT be split by boolean check
    ctype, dist = detector.detect_column_type(["0", "1", "2", "3"])
    assert ctype == ColumnType.NUMBER
    assert dist["number"] == 100.0


def test_flyway_analytics_and_dashboard_quality_compatibility():
    """Flyway properties/id columns normalize cleanly in DuckDBAnalyticsEngine & quality calculator."""
    flyway_df = pl.DataFrame(
        [
            {
                "id": "11111111-1111-1111-1111-111111111111",
                "tenant_id": "acme",
                "entity_type": "Person",
                "canonical_name": "Kofi Boateng",
                "source_count": 2,
                "properties": '{"entity_type": "Person", "name": "Kofi Boateng", "email": "kofi@gh.org", "country": "Ghana"}',
                "updated_at": datetime.now(timezone.utc),
            }
        ]
    )
    engine = DuckDBAnalyticsEngine(override_df=flyway_df)
    exported = engine.export_data(tenant_id="acme", entity_type="Person", columns=["name", "country"])
    assert exported.height == 1
    assert exported["name"][0] == "Kofi Boateng"

    dq = compute_data_quality(flyway_df)
    assert dq["completeness"] == 100.0
    assert dq["validity"] == 100.0


def test_pipeline_status_does_not_fabricate_quality_scores():
    """Pipeline status with no computed quality_scores returns {} instead of hardcoded 96.5."""
    tc = TestClient(app)
    resp = tc.get("/process/status/nonexistent-run-check")
    assert resp.status_code == 200
    assert resp.json()["quality_scores"] == {}


def test_eda_and_profiler_exact_math_and_row_counts():
    """Even-length median, interpolated percentiles, constant correlation None, and distinct invalid rows."""
    df = pl.DataFrame(
        {
            "val": [10.0, 20.0, 30.0, 40.0],
            "const": [5.0, 5.0, 5.0, 5.0],
            "bad_date": ["31/02/1990", "2024-01-01", "2024-01-02", "2024-01-03"],
            "bad_int": ["oops", "1", "2", "3"],
        }
    )
    eda = EdaEngine.generate_eda_report(df)
    stats = eda["numeric_statistics"]["val"]
    assert stats["median"] == 25.0
    assert stats["percentiles"]["p25"] == 17.5
    assert stats["percentiles"]["p75"] == 32.5
    assert eda["correlation_matrix"]["val"]["const"] is None

    prof = DataProfiler().profile_dataset(df)
    assert prof.columns["val"].median == 25.0
    assert prof.columns["val"].q1 == 17.5
    assert prof.columns["val"].q3 == 32.5
    # Row 0 has BOTH an invalid date and invalid int -> must count as 1 invalid record, not 2
    assert prof.invalid_record_count == 1
    assert prof.valid_record_count == 3


def test_ml_engine_missing_targets_clustering_and_predict_api():
    """ML filters missing/corrupt targets, supports targetless clustering, and predicts from saved artifacts."""
    reg_records = [
        {"x": 1.0, "y": 2.0},
        {"x": 2.0, "y": 4.0},
        {"x": 3.0, "y": 6.0},
        {"x": 4.0, "y": 8.0},
        {"x": 5.0, "y": 10.0},
        {"x": 6.0, "y": 12.0},
        {"x": 100.0, "y": None},
        {"x": 200.0, "y": "corrupt"},
    ]
    res = MachineLearningEngine.train_and_evaluate(
        records=reg_records,
        target_column="y",
        feature_columns=["x"],
        algorithm="Linear Regression",
        task_type="REGRESSION",
        test_size=0.33,
    )
    assert res["dropped_missing_target_rows"] == 2
    assert res["metrics"]["r2_score"] > 0.99

    tc = TestClient(app)
    clust_resp = tc.post(
        "/analytics/ml/train",
        json={
            "tenant_id": "test_tenant",
            "model_name": "Customer Segments",
            "task_type": "CLUSTERING",
            "algorithm": "K-Means",
            "records": [{"a": 1, "b": 100}, {"a": 2, "b": 120}, {"a": 50, "b": 10}, {"a": 55, "b": 15}, {"a": 60, "b": 20}],
            "hyperparameters": {"n_clusters": 2},
        },
    )
    assert clust_resp.status_code == 200
    run_id = clust_resp.json()["run_id"]
    pred_resp = tc.post("/analytics/ml/predict", json={"run_id": run_id, "records": [{"a": 1.5, "b": 110}, {"a": 52, "b": 12}]})
    assert pred_resp.status_code == 200
    assert pred_resp.json()["count"] == 2


def test_cleaning_ops_nan_whitespace_int_clip_and_preview_diffs():
    """Cleaning operations handle NaN, empty/whitespace, non-integer IQR fences, and row-deletion preview diffs."""
    df_ws = pl.DataFrame({"s": ["Alice", "", "   ", "N/A", None], "num": [10.0, float("nan"), 20.0, 30.0, 40.0]})
    rem_df, rem_cnt = apply_remove_missing(df_ws, ["s"])
    assert rem_cnt == 4
    assert rem_df["s"].to_list() == ["Alice"]

    fill_df, fill_cnt = apply_fill_missing(df_ws, "num", strategy="mean")
    assert fill_cnt == 1
    assert math.isclose(fill_df["num"][1], 25.0)

    df_int = pl.DataFrame({"x": [10, 11, 12, 13, 1000]})
    capped_df, cap_cnt = apply_handle_outliers(df_int, "x", method="IQR", threshold=1.25, action="cap")
    assert cap_cnt == 1
    assert capped_df["x"][4] == 15.5

    preview_res = CleaningEngine().preview_step(
        df_ws, CleaningStepConfig(step_id="rm", operation="remove_missing", column="s")
    )
    assert preview_res.affected_rows == 4
    assert len(preview_res.sample_diffs) == 4
    assert preview_res.sample_diffs[0].proposed_value == "<ROW_REMOVED>"


def test_pipeline_builder_derive_scientific_negative_and_outer_join():
    """DERIVE supports negative/scientific literals and outer JOIN maps to Polars 'full' without error."""
    left = pl.DataFrame({"id": [1, 2], "val": [100.0, 200.0]})
    right = pl.DataFrame({"id": [2, 3], "tag": ["b", "c"]})
    out_df, report = PipelineBuilderEngine.execute_pipeline(
        left,
        steps=[
            TransformationStep("s1", "JOIN", {"right_dataset": "right", "on": "id", "how": "outer"}),
            TransformationStep("s2", "DERIVE", {"column_name": "scaled", "expression": "val * -1e-2"}),
        ],
        secondary_datasets={"right": right},
    )
    assert report.status == "COMPLETED"
    assert out_df.height == 3
    assert out_df.filter(pl.col("id") == 1)["scaled"][0] == pytest.approx(-1.0)


def test_dataset_cleaner_handles_blocks_over_200():
    """Blocks >= 200 records sharing name prefix still deduplicate duplicates instead of skipping."""
    rows = [{"id": f"r-{i}", "name": "John Unique", "email": f"user{i}@example.com"} for i in range(210)]
    rows.append({"id": "r-dup-1", "name": "John Unique", "email": "user5@example.com"})
    res = DatasetCleaner(tenant_id="ghana-test").process_dataframe(pl.DataFrame(rows))
    assert res.duplicates_merged >= 1


def test_er_comparison_empty_strings_contradiction_and_provenance():
    """Vectorized ER comparison ignores empty strings, rejects conflicting MRNs, and excludes provenance metadata."""
    score_dict = calculate_pair_similarity_score(
        {"name": "Alice Smith", "email": "", "mrn": "MRN-1"},
        {"name": "Alice Smith", "email": "", "mrn": "MRN-2"},
    )
    assert score_dict["confidence_score"] == 0.0

    pairs_df = pl.DataFrame(
        {
            "id_a": ["1"],
            "id_b": ["2"],
            "name_a": ["Alice Smith"],
            "name_b": ["Alice Smith"],
            "email_a": [""],
            "email_b": [""],
            "mrn_a": ["MRN-100"],
            "mrn_b": ["MRN-200"],
        }
    )
    scored = compare_candidate_pairs(pairs_df)
    assert scored["confidence_score"][0] == 0.0

    prov = track_field_provenance(
        {
            "golden_id": "gr-1",
            "version": 2,
            "quality_state": "VERIFIED",
            "quality_score": 98.0,
            "_conflicts": {},
            "name": "Alice",
            "children_count": 0,
        },
        [{"id": "r-1", "source_id": "crm", "name": "Alice", "children_count": 0}],
        tenant_id="acme",
    )
    attrs = {e["attribute_name"] for e in prov}
    assert attrs == {"name", "children_count"}


def test_keycloak_issuer_decoupling_and_prod_compose_config():
    """Verify KEYCLOAK_ISSUER_URI decouples JWT issuer from internal JWKS URL and prod compose sets safeguards."""
    from datetime import datetime, timedelta, timezone
    from pathlib import Path
    import jwt
    import yaml
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from fastapi import HTTPException
    from app.config import Settings
    from app.security import get_keycloak_validator

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_pem = (
        private_key.public_key()
        .public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode("utf-8")
    )

    s_prod = Settings(
        environment="production",
        keycloak_url="http://keycloak:8180",
        keycloak_issuer_uri="https://auth.prod.example.com/realms/luminai/",
        keycloak_realm="luminai",
        keycloak_public_key=public_pem,
    )
    assert s_prod.keycloak_jwks_url == "http://keycloak:8180/realms/luminai/protocol/openid-connect/certs"
    assert s_prod.keycloak_issuer == "https://auth.prod.example.com/realms/luminai"

    now = datetime.now(timezone.utc)
    ext_token = jwt.encode(
        {
            "sub": "u1",
            "preferred_username": "alice",
            "iss": "https://auth.prod.example.com/realms/luminai",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=15)).timestamp()),
        },
        private_key,
        algorithm="RS256",
    )
    validator = get_keycloak_validator(s_prod)
    claims = validator.validate_token(ext_token)
    assert claims["sub"] == "u1"

    bad_iss_token = jwt.encode(
        {
            "sub": "u1",
            "iss": "http://keycloak:8180/realms/luminai",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=15)).timestamp()),
        },
        private_key,
        algorithm="RS256",
    )
    try:
        validator.validate_token(bad_iss_token)
        assert False, "Expected InvalidIssuerError HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 401

    root = Path(__file__).resolve().parents[2]
    prod_cfg = yaml.safe_load((root / "docker-compose.prod.yml").read_text(encoding="utf-8"))
    de = prod_cfg["services"]["data-engine"]
    env = de["environment"]
    assert "ENVIRONMENT" in env
    assert "AUTH_ENABLED" in env
    assert "KEYCLOAK_ISSUER_URI" in env
    assert "data_engine_storage:/app/storage" in de["volumes"]
    assert "data_engine_storage" in prod_cfg["volumes"]
    assert de["deploy"]["resources"]["limits"]["memory"] == "1024m"
    kc = prod_cfg["services"]["keycloak"]
    assert kc["command"][0] == "start", "Production Keycloak must run 'start', not 'start-dev'"
    assert "01234567890123456789012345678901" not in (
        prod_cfg["services"]["core-backend"]["environment"].get("VAULT_ENCRYPTION_KEY") or ""
    )
