# LuminAI Security & Vulnerability Testing Guide

## 1. Scope & Guidelines

This guide outlines security verification procedures for testing the **LuminAI** platform.
All payloads provided here are benign test probes designed to confirm defensive sanitization and validation without causing service degradation.

---

## 2. Security Test Matrix

### SEC-01: CSV Formula Injection (Formula / DDE Injection)
- **Vulnerability**: Spreadsheet applications (Excel, LibreOffice) executing formulas prefixed with `=`, `+`, `-`, `@`.
- **Payload**: `=cmd|' /C calc'!A0` or `=SUM(1+1)*cmd` or `@HYPERLINK("http://attacker.com","Click Me")`
- **Injection Point**: Column `note` or `full_name` in a CSV upload.
- **Verification**:
  1. Upload `luminai-testing/datasets/edge-cases/extreme_values_outliers.csv`.
  2. In `/connections`, export the cleaned CSV.
  3. Open exported file in text editor: values starting with `=`, `@`, `+`, `-` should be prefixed with a single quote `'` or properly escaped, preventing spreadsheet formula execution.
- **Expected Outcome**: Export sanitization neutralizes formula triggers.

---

### SEC-02: Stored Cross-Site Scripting (XSS) in Tabular Fields
- **Vulnerability**: Unescaped user-supplied strings rendered as HTML in UI tables or modals.
- **Payload**: `<script>alert('xss')</script>` and `<img src="x" onerror="alert(1)">`
- **Injection Point**: File name, column names, or string cells.
- **Verification**:
  1. Upload `extreme_values_outliers.csv` (contains `<script>alert('xss')</script>`).
  2. Inspect the table preview in Dataset Detail, Clean Data modal, and Explorer.
  3. Confirm that the script tag renders as plain text `"<script>alert('xss')</script>"` and does NOT execute any modal dialog or console execution.
- **Expected Outcome**: React JSX auto-escapes all HTML entities. No script execution occurs.

---

### SEC-03: SQL Injection Prevention in SQL Studio & Search APIs
- **Vulnerability**: SQL injection via raw query execution or search filter inputs.
- **Test Scenarios**:
  1. In SQL Studio (`/analytics/sql`), enter:
     `SELECT * FROM customers WHERE name = 'Kwesi' OR '1'='1';`
     Verify parameterized evaluation.
  2. Attempt multi-statement execution:
     `SELECT 1; DROP TABLE customers;`
     Verify that multi-statement queries are strictly rejected by the AST analyzer.
  3. In Explorer search bar (`/explorer`), enter:
     `' UNION SELECT null, username, password FROM users --`
     Verify query treats string as literal text without error backtrace or data leakage.
- **Expected Outcome**: AST validator rejects non-SELECT and multi-statement queries.

---

### SEC-04: Path Traversal in File Upload & Download Endpoints
- **Vulnerability**: Arbitrary file read/write via filenames like `../../app.py` or `..\..\..\windows\win.ini`.
- **Injection Point**: Ingestion file name multipart header (`filename="../evil.csv"`).
- **Verification**:
  1. Upload a file named `../../test_traversal.csv`.
  2. Check backend logs and MinIO storage paths.
  3. Verify the file path is sanitized to `test_traversal.csv` with alphanumeric uuid prefix, and stays strictly within the tenant's designated storage prefix.
- **Expected Outcome**: Backend rejects or strips path separators (`/`, `\`, `..`).

---

### SEC-05: Multi-Tenant Header Spoofing (`X-Tenant-ID`)
- **Vulnerability**: Unauthorized tenant context switching by modifying request headers.
- **Verification**:
  1. Log in with user credentials assigned to Tenant 1.
  2. In browser DevTools Network tab, copy request as cURL.
  3. Manually edit header to `X-Tenant-ID: tenant-2-id`.
  4. Send request to `GET /api/v1/connections`.
  5. Verify backend responds with `403 Forbidden` or `401 Unauthorized` because the JWT token's user identity is not a member of Tenant 2.
- **Expected Outcome**: Backend enforces cryptographic token-to-tenant verification.

---

### SEC-06: XML External Entity (XXE) Injection Prevention
- **Vulnerability**: Parsing malicious XML files containing external entity definitions (`<!ENTITY xxe SYSTEM "file:///etc/passwd">`).
- **Injection Point**: `suppliers_small.xml` parser.
- **Verification**:
  1. Attempt to upload an XML file containing a DTD entity declaration.
  2. Verify parser rejects external entities using `defusedxml` or disables entity expansion (`XMLConstants.FEATURE_SECURE_PROCESSING`).
- **Expected Outcome**: XML parser fails safely without reading host files.
