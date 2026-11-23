# LuminAI Dataset Quality & Anomaly Report

## 1. Executive Summary

This report establishes the independent ground-truth baseline of all deliberate anomalies, data quality dimensions, and statistical invariants injected into the synthetic test suite.

When conducting manual tests on LuminAI:
- **LuminAI's Data Profiler** must report values matching these tables within rounding precision.
- **LuminAI's Cleaning Engine** must accurately isolate and rectify the specific anomalies listed below.
- **LuminAI's Quality Framework** must flag the deliberate dimension violations.

---

## 2. Injected Anomalies Summary Table

| Dataset | Injected Anomaly Type | Target Columns | Expected Count / Percentage | Testing Objective |
| :--- | :--- | :--- | :--- | :--- |
| `customers_small.csv` | Exact Duplicate Rows | All columns | Exactly 10 duplicated rows | Verify `deduplicate` cleaning operation removes duplicates. |
| `customers_small.csv` | Missing Values | `email`, `phone` | ~6% missing email, ~4% missing phone | Test `fill_missing` (constant, mode) and `remove_missing`. |
| `customers_small.csv` | Whitespace Padding | `full_name` | ~5% leading/trailing spaces (`"  Kwesi Mensah "`) | Test `standardize_text` (trim) operation. |
| `customers_small.csv` | Inconsistent Casing | `full_name` | ~4% UPPERCASE / lowercase | Test `standardize_text` (case: Title Case). |
| `customers_small.csv` | Outlier Credit Limits | `credit_limit` | ~2% negative (-1000) or extreme (9999999) | Test `handle_outliers` (IQR / Z-Score clipping & filtering). |
| `transactions_small.csv` | Negative Monetary Amounts | `amount` | ~3% negative values | Test filter transformations (`amount > 0`). |
| `transactions_small.csv` | Extreme Outliers | `amount` | ~1.5% values between 500,000 and 950,000 | Verify quantile and IQR outlier detection. |
| `transactions_small.csv` | Relational Orphans | `customer_id` | Exactly 86 orphan records | Verify foreign-key integrity validation and inner vs left joins. |
| `identifiers_leading_zeros.csv` | Leading Zero Strings | `national_tin`, `branch_code` | 100% of rows have values like `"00001"` | Verify type inference preserves String instead of casting to Int. |
| `fuzzy_duplicates_er.csv` | Fuzzy Entity Match Pairs | `name`, `phone`, `city` | 4 distinct match pairs, 2 non-match controls | Test Entity Resolution scanning and candidate generation. |

---

## 3. Statistical Ground-Truth Baselines (Sample Preview)

### 3.1 `customers_small.csv` (2,010 total rows)
- **Distinct Customers**: 2,000 unique records (10 exact duplicates).
- **Regions Distribution**: Greater Accra, Ashanti, Western, Central, Eastern, Volta, Northern, Upper East, Upper West, Bono (~10% each).
- **Active Customers**: ~88% active (`is_active = true`), ~12% inactive (`is_active = false`).

### 3.2 `transactions_small.csv` (5,000 total rows)
- **Currency Distribution**: GHS (~50%), USD (~12.5%), EUR (~12.5%), NGN (~12.5%), KES (~12.5%).
- **Transaction Status**:
  - `COMPLETED`: ~88%
  - `FAILED`: ~5%
  - `PENDING`: ~4%
  - `REVERSED`: ~3%
- **Customer Relational Match**:
  - Valid matches in `customers_small.csv`: 4,914 transactions
  - Orphan references (`CUST-999xxx`): 86 transactions
