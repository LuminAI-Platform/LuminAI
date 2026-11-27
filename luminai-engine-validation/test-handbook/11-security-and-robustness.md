# Manual Test Handbook — 11: Security & Adversarial Robustness (`INF-01` to `INF-05`)

> All payloads in this section are strictly synthetic, static test strings evaluated offline against input validators. Never execute or point probes at external hosts.

---

### Test 27: Authentication & Rate Limit Header Spoofing Safeguards (`INF-02`, `INF-03`)

**1. What is this feature?**  
Verifies:
- Real JWT-formatted tokens containing `"sandbox"` in headers/claims cannot escalate or bypass auth via substring matching (`security.py`).
- `RateLimitMiddleware` ignores spoofed `X-Forwarded-For` when `trust_proxy_headers=False` and refuses untrusted `X-Tenant-ID` buckets when auth or production mode is active.

**2. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
import jwt
from fastapi.testclient import TestClient
from app.main import app
from app.config import get_settings

s = get_settings()
orig_auth = s.auth_enabled
try:
    s.auth_enabled = True
    client = TestClient(app)
    forged = jwt.encode({'sub': 'sandbox-user', 'tenant': 'sandbox'}, 'wrong-secret', algorithm='HS256')
    r = client.post('/analytics/eda/report', headers={'Authorization': f'Bearer {forged}'}, json={'records': [{'a': 1}]})
    print('Forged JWT with sandbox claim -> HTTP:', r.status_code, r.json())
finally:
    s.auth_enabled = orig_auth
"
```

**3. What does a successful result look like?**  
Forged JWT (`header.payload.sig` format) containing `'sandbox'` is strictly rejected with `401 Unauthorized`!

---

### Test 28: Adversarial Data Payloads — Formula Injection, SQLi, XSS, Null Bytes & RTL (`INF-05`)

**1. What is this feature?**  
Tests safe ingestion, profiling, cleaning, and CSV export of `datasets/<tier>/domain_s_adversarial.csv` and `domain_s_nested.json`.

**2. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
from pathlib import Path
import polars as pl
from app.processing.schema_detector.detector import SchemaDetector
from app.processing.engine.text_cleaner import TextCleaner
from app.processing.engine.profiler import DataProfiler

base = Path('../luminai-engine-validation/datasets/small')
df = pl.read_csv(base / 'domain_s_adversarial.csv')
print('Profiled adversarial rows:', DataProfiler().profile_dataset(df).total_rows)

tc = TextCleaner()
for row in df.to_dicts():
    res = tc.clean_text(row['name'])
    print(row['id'], 'cleaned name:', repr(res.cleaned[:60]), 'formulas/html:', res.changes)

raw_json = (base / 'domain_s_nested.json').read_bytes()
rep_json = SchemaDetector().validate_file_bytes(raw_json, 'domain_s_nested.json', reject_on_violation=False)
print('Nested + null-byte JSON -> passed:', rep_json.passed, 'rows:', rep_json.total_rows)
"
```

**3. What to examine carefully (Bug-Hunting!):**  
- Does `TextCleaner` neutralize `=CMD|...`, `@SUM(...)`, AND `\t=1+1` (or notice if leading `\t` is stripped before `=` neutralization)?  
- Does `TextCleaner` preserve benign mathematical expressions like `x < y and y > z`, or does its `<[^>]+>` HTML regex delete `< y and y >`? Record the exact finding!  
- Does `MinioRawStorageClient._safe_local_path` reject `../../etc/passwd` and sibling prefix `storage/raw_evil`? Verify via unit probe below:
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
from app.processing.minio_client.client import MinioRawStorageClient
c = MinioRawStorageClient()
for bad_b, bad_k in [('../raw_evil', 'secret.csv'), ('luminai-raw', '../../etc/passwd')]:
    try:
        p = c._safe_local_path(bad_b, bad_k)
        print('VULNERABLE:', bad_b, bad_k, '->', p)
    except Exception as e:
        print('BLOCKED safely:', bad_b, bad_k, '->', type(e).__name__, e)
"
```

---

### Test 29: Structural Malformed Inputs (`INF-05`)

Test `domain_s_malformed.json` and `domain_s_structural_edge.csv`:
- Confirm `domain_s_malformed.json` raises a clean, structured error (`ValueError`/`HTTP 400/422`) without hanging.
- Confirm `domain_s_structural_edge.csv` either parses cleanly with explicit truncation/schema warnings or logs row-length anomalies visibly instead of failing silently.
