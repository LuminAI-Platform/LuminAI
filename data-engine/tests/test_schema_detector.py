"""Tests for Ingest Pipeline Validation & Schema Auto-Detection (MVP-23).

Acceptance Criteria:
1. Auto-detect CSV/JSON column types (string, number, date, boolean, email, phone)
2. Suggest ontology property mappings based on column name fuzzy matching
3. Pre-flight validation report (null percentage, unique count, data type distribution)
4. Reject files with >50% null columns with clear error message
5. Tests for schema detection logic and REST validation endpoints
"""

import io
from fastapi.testclient import TestClient
import polars as pl
import pytest

from app.main import app
from app.processing.schema_detector import (
    ColumnType,
    SchemaDetector,
    get_schema_detector,
)


@pytest.fixture
def detector() -> SchemaDetector:
    return get_schema_detector()


# 1. Column Type Auto-Detection Tests
class TestColumnTypeDetection:
    """Validate auto-detection across all 6 target data types."""

    def test_detect_boolean(self, detector: SchemaDetector):
        bool_samples = ["true", "False", "TRUE", "false", "yes", "no", "1", "0", True, False]
        ctype, dist = detector.detect_column_type(bool_samples)
        assert ctype == ColumnType.BOOLEAN
        assert dist["boolean"] == 100.0

    def test_detect_email(self, detector: SchemaDetector):
        email_samples = [
            "alice@example.com",
            "bob.smith+tag@enterprise.org",
            "carol_123@sub.domain.co.uk",
            "support@luminai.io",
        ]
        ctype, dist = detector.detect_column_type(email_samples)
        assert ctype == ColumnType.EMAIL
        assert dist["email"] == 100.0

    def test_detect_phone(self, detector: SchemaDetector):
        phone_samples = [
            "+1-555-0199",
            "+44 20 7946 0919",
            "(555) 123-4567",
            "+33 1 42 68 55 00",
            "+15551234567",
        ]
        ctype, dist = detector.detect_column_type(phone_samples)
        assert ctype == ColumnType.PHONE
        assert dist["phone"] == 100.0

    def test_detect_number_integers_floats_and_currency(self, detector: SchemaDetector):
        num_samples = ["100", "250.75", "-42", "$5,000", "€120.50", "99.99", 42, 3.14]
        ctype, dist = detector.detect_column_type(num_samples)
        assert ctype == ColumnType.NUMBER
        assert dist["number"] == 100.0

    def test_detect_date_and_timestamps(self, detector: SchemaDetector):
        date_samples = [
            "2024-01-15",
            "2024-05-20 14:30:00",
            "2024-12-01T10:00:00Z",
            "15/01/2024",
            "2023/11/30",
        ]
        ctype, dist = detector.detect_column_type(date_samples)
        assert ctype == ColumnType.DATE
        assert dist["date"] == 100.0

    def test_detect_string_general(self, detector: SchemaDetector):
        str_samples = [
            "Acme Corporation",
            "Standard multi-word text description",
            "Building 4, Suite 200",
            "Alpha Beta Gamma",
        ]
        ctype, dist = detector.detect_column_type(str_samples)
        assert ctype == ColumnType.STRING
        assert dist["string"] == 100.0


# 2. Ontology Property Mapping Fuzzy Matching Tests
class TestOntologyPropertyFuzzyMapping:
    """Validate ontology property mapping suggestions based on column name fuzzy matching."""

    def test_person_property_suggestions(self, detector: SchemaDetector):
        # Exact / alias mappings
        ent, prop, conf = detector.suggest_ontology_mapping("email_address", ColumnType.EMAIL)
        assert ent == "Person"
        assert prop == "email"
        assert conf >= 0.85

        ent, prop, conf = detector.suggest_ontology_mapping("full_name", ColumnType.STRING)
        assert ent == "Person"
        assert prop == "name"
        assert conf >= 0.85

        ent, prop, conf = detector.suggest_ontology_mapping("telephone_number", ColumnType.PHONE)
        assert ent == "Person"
        assert prop == "phone"
        assert conf >= 0.70

        ent, prop, conf = detector.suggest_ontology_mapping("annual_salary", ColumnType.NUMBER)
        assert ent == "Person"
        assert prop == "salary"
        assert conf >= 0.70

    def test_product_and_organization_suggestions(self, detector: SchemaDetector):
        ent, prop, conf = detector.suggest_ontology_mapping("product_sku", ColumnType.STRING)
        assert ent == "Product"
        assert prop == "id"
        assert conf >= 0.70

        ent, prop, conf = detector.suggest_ontology_mapping("unit_price", ColumnType.NUMBER)
        assert ent == "Product"
        assert prop == "price"
        assert conf >= 0.80

        ent, prop, conf = detector.suggest_ontology_mapping("company_name", ColumnType.STRING)
        assert ent == "Organization"
        assert prop == "name"
        assert conf >= 0.85


# 3. Pre-Flight Validation Report & >50% Null Rejection Tests
class TestPreflightValidationAndRejection:
    """Validate report generation and rejection on high null percentages."""

    def test_valid_dataset_passes_preflight(self, detector: SchemaDetector):
        df = pl.DataFrame({
            "id": ["rec-1", "rec-2", "rec-3", "rec-4"],
            "full_name": ["Alice Smith", "Bob Jones", "Carol White", "David Brown"],
            "contact_email": ["alice@a.com", "bob@b.com", "carol@c.com", "david@d.com"],
            "phone_no": ["+1-555-0101", "+1-555-0102", "+1-555-0103", "+1-555-0104"],
            "age": [30, 25, 40, 35],
            "joined_at": ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04"],
        })

        report = detector.validate_dataframe(df)

        assert report.is_valid is True
        assert report.total_rows == 4
        assert report.total_columns == 6
        assert len(report.rejected_columns) == 0
        assert report.error_message is None
        assert report.suggested_entity_type == "Person"
        assert report.entity_confidence > 0.5

        # Check detected types in column report
        cols_by_name = {c.column_name: c for c in report.columns}
        assert cols_by_name["id"].detected_type == "string"
        assert cols_by_name["full_name"].detected_type == "string"
        assert cols_by_name["contact_email"].detected_type == "email"
        assert cols_by_name["phone_no"].detected_type == "phone"
        assert cols_by_name["age"].detected_type == "number"
        assert cols_by_name["joined_at"].detected_type == "date"

        # Unique counts
        assert cols_by_name["id"].unique_count == 4
        assert cols_by_name["contact_email"].unique_count == 4

    def test_reject_dataset_with_over_50_percent_nulls(self, detector: SchemaDetector):
        # Column 'unreliable_phone' has 4 nulls out of 5 = 80% null
        df = pl.DataFrame({
            "id": ["rec-1", "rec-2", "rec-3", "rec-4", "rec-5"],
            "name": ["Alice", "Bob", "Carol", "Dave", "Eve"],
            "unreliable_phone": ["+1-555-0101", None, "", None, None],
        })

        report = detector.validate_dataframe(df)

        assert report.is_valid is False
        assert "unreliable_phone" in report.rejected_columns
        assert report.error_message is not None
        assert "exceed the maximum allowable null threshold of 50.0%" in report.error_message

        # Verify column report details
        cols_by_name = {c.column_name: c for c in report.columns}
        phone_col = cols_by_name["unreliable_phone"]
        assert phone_col.is_rejected is True
        assert phone_col.null_percentage == 80.0
        assert "has 80.0% null values" in phone_col.rejection_reason

    def test_empty_dataset_rejection(self, detector: SchemaDetector):
        df = pl.DataFrame({"id": [], "name": []})
        report = detector.validate_dataframe(df)
        assert report.is_valid is False
        assert "empty (0 rows)" in report.error_message


# 4. Multi-Format Byte Ingestion Tests (CSV and JSON)
class TestMultiFormatByteIngestion:
    """Validate parsing and schema detection from raw bytes."""

    def test_validate_csv_bytes(self, detector: SchemaDetector):
        csv_data = (
            b"id,name,email,score\n"
            b"1,Alice,alice@example.com,95.5\n"
            b"2,Bob,bob@example.com,88.0\n"
            b"3,Carol,carol@example.com,92.3\n"
        )
        report = detector.validate_file_bytes(csv_data, file_name="data.csv")
        assert report.is_valid is True
        assert report.total_rows == 3
        cols = {c.column_name: c for c in report.columns}
        assert cols["email"].detected_type == "email"
        assert cols["score"].detected_type == "number"

    def test_validate_json_bytes(self, detector: SchemaDetector):
        json_data = b"""[
            {"id": "p-1", "title": "Laptop Pro", "price": "$1299.99", "in_stock": true},
            {"id": "p-2", "title": "Wireless Mouse", "price": "$29.99", "in_stock": false}
        ]"""
        report = detector.validate_file_bytes(json_data, file_name="products.json")
        assert report.is_valid is True
        assert report.total_rows == 2
        cols = {c.column_name: c for c in report.columns}
        assert cols["in_stock"].detected_type == "boolean"
        assert cols["price"].detected_type == "number"
        assert report.suggested_entity_type == "Product"


# 5. REST API Endpoints Tests (/process/validate-schema)
class TestSchemaValidationAPI:
    """Validate REST endpoints for schema validation and pre-flight checks."""

    @pytest.fixture
    def client(self):
        return TestClient(app)

    def test_api_validate_schema_inline_content(self, client: TestClient):
        valid_csv = (
            "id,full_name,contact_email,telephone,age\n"
            "1,User One,user1@test.com,+15551234567,29\n"
            "2,User Two,user2@test.com,+15557654321,34\n"
        )
        resp = client.post(
            "/process/validate-schema",
            json={
                "content": valid_csv,
                "file_name": "users.csv",
                "reject_on_violation": True,
            },
            headers={"X-API-Key": "test-api-key-12345"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_valid"] is True
        assert data["total_rows"] == 2
        assert len(data["columns"]) == 5
        assert data["suggested_entity_type"] == "Person"

    def test_api_validate_schema_rejects_high_nulls_with_422(self, client: TestClient):
        # CSV with column 'bad_col' having 75% nulls (3 nulls out of 4)
        invalid_csv = (
            "id,name,bad_col\n"
            "1,Alice,valid\n"
            "2,Bob,\n"
            "3,Carol,\n"
            "4,David,\n"
        )
        resp = client.post(
            "/process/validate-schema",
            json={
                "content": invalid_csv,
                "file_name": "corrupt.csv",
                "reject_on_violation": True,
            },
            headers={"X-API-Key": "test-api-key-12345"},
        )
        assert resp.status_code == 422
        assert "exceed the maximum allowable null threshold of 50.0%" in resp.json()["detail"]

    def test_api_validate_schema_returns_report_when_rejection_disabled(self, client: TestClient):
        invalid_csv = (
            "id,name,bad_col\n"
            "1,Alice,valid\n"
            "2,Bob,\n"
            "3,Carol,\n"
            "4,David,\n"
        )
        resp = client.post(
            "/process/validate-schema",
            json={
                "content": invalid_csv,
                "file_name": "corrupt.csv",
                "reject_on_violation": False,
            },
            headers={"X-API-Key": "test-api-key-12345"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_valid"] is False
        assert "bad_col" in data["rejected_columns"]

    def test_api_validate_schema_file_upload(self, client: TestClient):
        csv_file = io.BytesIO(
            b"id,name,email\n"
            b"10,Jane Doe,jane@doe.org\n"
            b"11,John Doe,john@doe.org\n"
        )
        resp = client.post(
            "/process/validate-schema/upload",
            files={"file": ("upload.csv", csv_file, "text/csv")},
            params={"reject_on_violation": True},
            headers={"X-API-Key": "test-api-key-12345"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_valid"] is True
        assert data["total_rows"] == 2
