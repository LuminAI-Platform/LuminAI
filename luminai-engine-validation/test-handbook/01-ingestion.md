# Manual Test Handbook — 01: Data Ingestion (`ING-01` to `ING-07`)

> Execute **one test at a time** from your chosen tier (`<tier>` = `small`, `medium`, etc.) inside `data-engine\` using `.\.venv\Scripts\python.exe`. Do not assume `200 OK` implies accurate row/type preservation.

---

### Test 1: CSV, Non-UTF-8 (`cp1252`), & Semicolon/BOM Ingestion (`ING-01`)

**1. What is this feature?**  
Parses CSV, TSV, TXT bytes/files into Polars `DataFrame`s with UTF-8 BOM stripping, strict UTF-8 decoding, `cp1252` fallback with warning, and lenient ragged/error fallback.

**2. Why does LuminAI need it?**  
Enterprise CRM/Finance exports from Windows Excel (`cp1252`, `;` delimiters, UTF-8 BOM) often crash strict UTF-8 CSV readers or silently drop records without diagnostics.

**3. How does it work internally?**  
`data-engine/app/processing/engine/dataframe_utils.py::parse_csv_bytes_with_fallback`, called by `app/processing/minio_client/parsers.py::parse_raw_data_to_dataframe` and `app/processing/schema_detector/detector.py::SchemaDetector.validate_file_bytes`. `DatasetCleaner.clean_file` (`app/processing/engine/dataset_cleaner.py`) uses `pl.read_csv` with pandas fallback.

**4. What dataset should I use?**  
- `luminai-engine-validation/datasets/<tier>/domain_a_customers.csv` (`full_name`, `email`, `date_of_birth`, `annual_income_usd`)
- `luminai-engine-validation/datasets/<tier>/domain_a_customers_cp1252.csv` (`Renée O'Connor` in `cp1252`)
- `luminai-engine-validation/datasets/<tier>/domain_a_customers_utf8bom_semicolon.csv` (UTF-8 BOM + `;` delimiter)
- `luminai-engine-validation/datasets/<tier>/domain_s_structural_edge.csv` (ragged rows, embedded quoted newlines/commas)

**5. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
from pathlib import Path
from app.processing.schema_detector.detector import SchemaDetector
from app.processing.minio_client.parsers import parse_raw_data_to_dataframe

det = SchemaDetector()
for fn in [
    'domain_a_customers.csv',
    'domain_a_customers_cp1252.csv',
    'domain_a_customers_utf8bom_semicolon.csv',
    'domain_s_structural_edge.csv',
]:
    p = Path('../luminai-engine-validation/datasets/small') / fn
    raw = p.read_bytes()
    rep = det.validate_file_bytes(raw, fn, reject_on_violation=False)
    df = parse_raw_data_to_dataframe(raw, fn)
    print(fn, '-> rows:', df.height, 'cols:', df.width, 'warnings:', rep.warnings)
"
```

**6. What should happen internally?**  
1. `domain_a_customers.csv` parses under strict UTF-8 (or lenient if embedded quotes/mixed types trigger schema mismatch).  
2. `domain_a_customers_cp1252.csv` fails strict UTF-8 decode, converts via `cp1252`, appends an encoding fallback warning to `rep.warnings`, and preserves `"Renée O'Connor"`.  
3. `domain_s_structural_edge.csv` triggers lenient `truncate_ragged_lines`/`ignore_errors` warning rather than silent exceptionless dropping.

**7. What output should I expect?**  
Check row counts against `reference-data/expected-results/<tier>/expected_domain_a.json` (`messy_customer_rows`) and confirm `Renée` renders properly on `cp1252` (no mojibake). Note: `domain_a_customers_utf8bom_semicolon.csv` is expected to expose LuminAI's **delimiter-sniffing limitation** (`ING-01`: `;` is treated as single wide string unless handled upstream).

**8. How do I verify correctness?**  
Compare `df.height` to `expected_domain_a.json["messy_customer_rows"]`, print `df["full_name"][0..10]` on `cp1252`, and inspect column count on semicolon CSV (`cols == 1` confirms semicolon limit is still active and accurately surfaces `warnings` or narrow schema).

**9. What can go wrong?**  
- Semicolon delimiter collapse into 1 column (known limitation).  
- `ignore_errors` coercing invalid strings like `"-5"` or ragged rows silently without checking `rep.warnings`.

**10. What does a successful result look like?**  
Zero crashes, `cp1252` accented characters intact with warning surfaced, `domain_a_customers.csv` row count matches `expected_domain_a.json` 100%, and any structural/encoding fallback produces an explicit warning.

**11. What should I record?**  
Record `PASS`/`FAIL`/`PARTIAL`, actual vs expected row counts, warnings printed, and semicolon behavior in `test-results/execution-log.md`.

---

### Test 2: Parquet & JSON / NDJSON Multi-Format Ingestion (`ING-02`, `ING-03`)

**1. What is this feature?**  
Ingests binary `.parquet` files, JSON arrays, and `.ndjson`/`.jsonl` streams into Polars DataFrames via `parse_raw_data_to_dataframe`, `validate_file_bytes`, and `DatasetCleaner.clean_file`.

**2. Why does LuminAI need it?**  
Upstream lakehouse tables and webhook event dumps use Parquet and NDJSON rather than flat CSV.

**3. How does it work internally?**  
`parsers.py::parse_raw_data_to_dataframe` and `detector.py::SchemaDetector.validate_file_bytes` branch by lowercase file extension to `pl.read_parquet`, `pl.read_json`, or `pl.read_ndjson`.

**4. What dataset should I use?**  
- `datasets/<tier>/domain_a_customers.parquet`
- `datasets/<tier>/domain_a_customers.ndjson`
- `datasets/<tier>/domain_a_customers_crm_b.json`
- `datasets/<tier>/domain_s_nested.json` & `domain_s_malformed.json`

**5. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
from pathlib import Path
from app.processing.minio_client.parsers import parse_raw_data_to_dataframe

base = Path('../luminai-engine-validation/datasets/small')
for fn in ['domain_a_customers.parquet', 'domain_a_customers.ndjson', 'domain_a_customers_crm_b.json', 'domain_s_nested.json']:
    df = parse_raw_data_to_dataframe((base / fn).read_bytes(), fn)
    print(fn, df.height, df.width, df.dtypes[:5])
"
```

**6. What should happen internally?**  
Parquet preserves typed floats (`annual_income_usd` including `NaN`/`None`), NDJSON streams line-by-line JSON objects, and nested JSON loads struct/list dtypes safely.

**7. What output should I expect?**  
- `domain_a_customers.parquet` & `.ndjson`: height matches `expected_domain_a.json["messy_customer_rows"]`, width `16`.  
- `domain_a_customers_crm_b.json`: matches `crm_b_total_records`.  
- `domain_s_nested.json`: `height == 2`. Then test `domain_s_malformed.json` inside `try/except` expecting clean exception (no hung process).

**8. How do I verify correctness?**  
Compare counts against `expected_domain_a.json` and check Parquet float `NaN` count matches `reference-calculations/<tier>/stats_domain_a.json["messy_customers"]["numeric_summaries"]["annual_income_usd"]["missing_breakdown"]["nan"]`.

**9. What can go wrong?**  
- Nested JSON structs breaking downstream string/SQL conversion.  
- Mixed types in NDJSON causing Polars schema inference failure if chunk window misses later types.

**10. What does a successful result look like?**  
Exact row/column fidelity across Parquet, JSON array, and NDJSON, and clean error on `domain_s_malformed.json`.

**11. What should I record?**  
Log format comparison parity (CSV vs Parquet vs NDJSON row count and dtype diffs).

---

### Test 3: Excel (`.xlsx`) Ingestion (`ING-04`)

**1. What is this feature?**  
Reads `.xlsx`/`.xls` workbooks uploaded to the engine using Polars + `fastexcel`.

**2. Why does LuminAI need it?**  
Business teams upload Excel spreadsheets directly to Data Connection and schema preflight endpoints.

**3. How does it work internally?**  
`detector.py::SchemaDetector.validate_file_bytes` & `parsers.py::parse_raw_data_to_dataframe` invoke `pl.read_excel(io.BytesIO(raw_bytes))`, powered by `fastexcel==0.21.0` added to `pyproject.toml`.

**4. What dataset should I use?**  
- `datasets/<tier>/domain_a_customers_excel.xlsx`

**5. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
from pathlib import Path
from app.processing.schema_detector.detector import SchemaDetector
p = Path('../luminai-engine-validation/datasets/small/domain_a_customers_excel.xlsx')
rep = SchemaDetector().validate_file_bytes(p.read_bytes(), p.name, reject_on_violation=False)
print('passed:', rep.passed, 'rows:', rep.total_rows, 'cols:', rep.total_columns, 'warnings:', rep.warnings)
"
```

**6. What should happen internally?**  
`fastexcel` decodes OOXML `xl/worksheets/sheet1.xml`, builds Polars columns, and profiles all rows.

**7. What output should I expect?**  
`total_rows` equals `min(messy_customer_rows, 10000)` (`10000` for Small/Medium), `total_columns == 16`, `passed == True`.

**8. How do I verify correctness?**  
Check column schema matches CSV counterpart (`16` columns, string/float values match first `N` rows of `domain_a_customers.csv`).

**9. What can go wrong?**  
Formula cells or leading-zero `account_code` columns getting parsed as numeric integers (stripping leading `"00"`). Inspect `account_code` dtype!

**10. What does a successful result look like?**  
Workbook loads without `ModuleNotFoundError`, exact row count & 16 columns reported, and leading-zero codes inspected.

**11. What should I record?**  
Record status, row count, and whether numeric coercion stripped `"00"` on `account_code` in `.xlsx`.

---

### Test 4: Multipart Pre-Flight API & Local MinIO Fallback (`ING-05`, `ING-06`)

**1. What is this feature?**  
Tests `POST /process/validate-schema/upload` and `MinioRawStorageClient` safe local storage fallback when MinIO is offline.

**2. Why does LuminAI need it?**  
API callers upload raw files before triggering expensive pipelines; object storage helpers must safely store/retrieve bytes locally in dev and enforce strict path boundaries.

**3. How does it work internally?**  
`app/api/processing/schemas.py` calls `SchemaDetector.validate_file_bytes`. `app/processing/minio_client/client.py` uses `_safe_bucket` + `os.path.commonpath` and writes under `storage/raw/<bucket>/<key>` when MinIO is offline (and fails loudly if both remote and local writes fail, or remote fails in production).

**4. What dataset should I use?**  
- `datasets/<tier>/domain_a_customers.csv`
- `datasets/<tier>/domain_s_empty.csv`

**5. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
with open('../luminai-engine-validation/datasets/small/domain_a_customers.csv', 'rb') as f:
    r = client.post('/process/validate-schema/upload', files={'file': ('domain_a_customers.csv', f, 'text/csv')})
print('valid upload:', r.status_code, r.json().get('passed'), r.json().get('total_rows'))

with open('../luminai-engine-validation/datasets/small/domain_s_empty.csv', 'rb') as f2:
    r2 = client.post('/process/validate-schema/upload', files={'file': ('empty.csv', f2, 'text/csv')})
print('empty upload:', r2.status_code, r2.json())
"
```

**6. What should happen internally?**  
Multipart stream is read into bytes, parsed, profiled across all columns, and returned as `PreflightValidationReport`; 0-byte CSV is rejected cleanly.

**7. What output should I expect?**  
Valid CSV returns `200`, `passed: True`, exact `total_rows`; empty CSV returns `422`.

**8. How do I verify correctness?**  
Check `r.json()["total_rows"]` equals `expected_domain_a.json["messy_customer_rows"]`.

**9. What can go wrong?**  
Large multipart files (>50MB) buffering entirely in memory; 0-byte CSV raising unhandled `500` instead of `422`.

**10. What does a successful result look like?**  
Clean `200` on messy valid CSV and clean `422` rejection on 0-byte CSV.

**11. What should I record?**  
Record status codes, response schema, and `ING-07` status (`BLOCKED` on live broker unless Kafka Docker service is started; `Dry-Run` pass if verified locally).
