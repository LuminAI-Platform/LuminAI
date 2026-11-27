"""
Domain A (Enterprise Customer & Transactions + Cross-Source ER),
Domain B (Financial P&L & Accounting Operations),
Domain C (E-Commerce Catalog & Denormalized Orders), and
Domain D (Operational Sensor Time-Series Telemetry).

Strictly independent of `data-engine/app/`.
"""

from __future__ import annotations

import json
import math
import random
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List

import pyarrow as pa

from corruption_rules import (
    COUNTRY_MESSY_GHANA,
    COUNTRY_MESSY_UK,
    COUNTRY_MESSY_US,
    CorruptionManifest,
    FORMULA_INJECTION_PAYLOADS,
    GENDER_INVALID,
    GENDER_MESSY_FEMALE,
    GENDER_MESSY_MALE,
    GHANA_CITIES,
    GHANA_FIRST_NAMES,
    GHANA_LAST_NAMES,
    INTERNATIONAL_CITIES,
    INVALID_DATE_STRINGS,
    INVALID_EMAIL_STRINGS,
    MOJIBAKE_NAMES,
    NICKNAME_PAIRS,
    NULL_SENTINEL_STRINGS,
    SMART_CASE_NAMES,
    STATUS_MESSY,
    StreamingMultiWriter,
    format_currency_messy,
    format_date_messy,
    write_csv_variant,
    write_minimal_xlsx,
)
from reference_calculator import DomainStatsCollector


# ---------------------------------------------------------------------------
# Domain A: Enterprise Customer & Transaction Data (+ Cross-Source ER CRM B)
# ---------------------------------------------------------------------------

def generate_domain_a(
    tier: str,
    n_rows: int,
    seed: int,
    chunk_size: int,
    datasets_dir: Path,
    ref_dir: Path,
    full_json_cap: int | None,
    xlsx_cap: int,
) -> Dict[str, Any]:
    rng = random.Random(seed + 101)
    manifest = CorruptionManifest("domain_a_customers_transactions", tier)
    cust_headers = [
        "customer_id",
        "account_code",
        "national_id",
        "full_name",
        "email",
        "phone",
        "gender",
        "age",
        "date_of_birth",
        "country",
        "city",
        "segment",
        "account_status",
        "annual_income_usd",
        "is_verified",
        "created_at",
    ]
    cust_schema = pa.schema(
        [
            ("customer_id", pa.string()),
            ("account_code", pa.string()),
            ("national_id", pa.string()),
            ("full_name", pa.string()),
            ("email", pa.string()),
            ("phone", pa.string()),
            ("gender", pa.string()),
            ("age", pa.string()),  # mixed invalid/numeric in messy file
            ("date_of_birth", pa.string()),
            ("country", pa.string()),
            ("city", pa.string()),
            ("segment", pa.string()),
            ("account_status", pa.string()),
            ("annual_income_usd", pa.float64()),
            ("is_verified", pa.string()),
            ("created_at", pa.string()),
        ]
    )

    clean_cust_headers = cust_headers
    messy_stats = DomainStatsCollector(
        numeric_cols=["annual_income_usd"],
        categorical_cols=["country", "segment", "account_status", "gender"],
    )
    clean_stats = DomainStatsCollector(
        numeric_cols=["age", "annual_income_usd"],
        categorical_cols=["country", "segment", "account_status", "gender"],
    )

    clean_writer = StreamingMultiWriter(
        headers=clean_cust_headers,
        csv_path=ref_dir / "clean-data" / tier / "domain_a_customers_clean.csv",
    )
    messy_writer = StreamingMultiWriter(
        headers=cust_headers,
        csv_path=datasets_dir / tier / "domain_a_customers.csv",
        ndjson_path=datasets_dir / tier / "domain_a_customers.ndjson",
        parquet_path=datasets_dir / tier / "domain_a_customers.parquet",
        parquet_schema=cust_schema,
    )

    # Track CRM Source B & Excel / cp1252 / BOM samples (bounded for low RAM)
    crm_b_records: List[Dict[str, Any]] = []
    crm_b_expected_matches = 0
    crm_b_contradiction_pairs = 0
    xlsx_rows: List[List[Any]] = []
    cp1252_sample: List[Dict[str, Any]] = []
    bom_semi_sample: List[Dict[str, Any]] = []

    segments = ("Retail", "SMB", "Enterprise", "PublicSector")
    seg_income_mu = {"Retail": 9.8, "SMB": 10.6, "Enterprise": 11.8, "PublicSector": 10.2}
    quarantined_expected_ids: set[str] = set()
    duplicate_rows_added = 0
    near_dup_rows_added = 0
    crm_b_cap = min(max(200, n_rows // 10), 5000)

    tx_headers = [
        "transaction_id",
        "customer_id",
        "product_id",
        "tx_timestamp",
        "currency",
        "quantity",
        "amount_usd",
        "payment_method",
        "is_flagged",
    ]
    tx_schema = pa.schema(
        [
            ("transaction_id", pa.string()),
            ("customer_id", pa.string()),
            ("product_id", pa.string()),
            ("tx_timestamp", pa.string()),
            ("currency", pa.string()),
            ("quantity", pa.int64()),
            ("amount_usd", pa.float64()),
            ("payment_method", pa.string()),
            ("is_flagged", pa.int64()),
        ]
    )
    tx_writer = StreamingMultiWriter(
        headers=tx_headers,
        parquet_path=datasets_dir / tier / "domain_a_transactions.parquet",
        csv_path=datasets_dir / tier / "domain_a_transactions.csv" if n_rows <= 100_000 else None,
        parquet_schema=tx_schema,
    )
    tx_stats = DomainStatsCollector(
        numeric_cols=["quantity", "amount_usd", "is_flagged"],
        categorical_cols=["currency", "payment_method"],
    )

    prod_max = min(max(200, n_rows // 10), 50_000)
    clean_chunk: List[Dict[str, Any]] = []
    messy_chunk: List[Dict[str, Any]] = []
    tx_chunk: List[Dict[str, Any]] = []
    tx_seq = 0
    orphaned_tx_count = 0

    for i in range(n_rows):
        cid = f"CUST-{i + 1:07d}"
        acct_code = f"00{(i % 99999) + 1:05d}"  # leading-zero identifier protection
        nat_id = f"GHA-{1000000 + i:09d}"

        if i < len(SMART_CASE_NAMES):
            full_name = SMART_CASE_NAMES[i]
            first, last = "Kwame", f"Smart{i}"
        else:
            first = GHANA_FIRST_NAMES[i % len(GHANA_FIRST_NAMES)]
            last = GHANA_LAST_NAMES[(i // len(GHANA_FIRST_NAMES) + i) % len(GHANA_LAST_NAMES)]
            full_name = f"{first} {last}"

        gender = "Male" if (i % 2 == 0) else "Female"
        age = 18 + (i * 7) % 62
        dob = date(2026 - age, ((i * 3) % 12) + 1, ((i * 5) % 28) + 1)

        if i % 10 < 7:
            city, _, _, _ = GHANA_CITIES[i % len(GHANA_CITIES)]
            country = "Ghana"
        else:
            country, _, city, _, _ = INTERNATIONAL_CITIES[i % len(INTERNATIONAL_CITIES)]

        seg = segments[i % len(segments)]
        income = round(min(2_500_000.0, math.exp(rng.gauss(seg_income_mu[seg], 0.55))), 2)
        email = f"{first.lower()}.{last.lower().replace('-', '')}{i}@enterprise.gh"
        phone = f"+23324{1000000 + (i % 8999999):07d}"
        status = ("ACTIVE", "INACTIVE", "PENDING", "SUSPENDED")[i % 4]
        verified_bool = (i % 5 != 0)
        created = date(2022, 1, 1) + timedelta(days=i % 1400)

        clean_row = {
            "customer_id": cid,
            "account_code": acct_code,
            "national_id": nat_id,
            "full_name": full_name,
            "email": email,
            "phone": phone,
            "gender": gender,
            "age": age,
            "date_of_birth": dob.isoformat(),
            "country": country,
            "city": city,
            "segment": seg,
            "account_status": status,
            "annual_income_usd": income,
            "is_verified": str(verified_bool).lower(),
            "created_at": created.isoformat(),
        }
        clean_stats.observe_row(clean_row, track_exact_dups=False)
        clean_chunk.append(clean_row)

        # Build messy row
        m = dict(clean_row)
        m["age"] = str(age)
        row_out_idx = len(messy_chunk) + i + duplicate_rows_added + near_dup_rows_added

        # Deliberate mixed-representation missingness (non-random + sentinels + NaN)
        r_defect = rng.random()
        if i % 37 == 0:
            sentinel = NULL_SENTINEL_STRINGS[i % len(NULL_SENTINEL_STRINGS)]
            manifest.record(row_out_idx, "email", "missing_sentinel", email, sentinel, "Detect/treat as missing")
            m["email"] = sentinel
            quarantined_expected_ids.add(cid)
        elif i % 43 == 0:
            manifest.record(row_out_idx, "annual_income_usd", "missing_nan", income, "NaN", "Exclude NaN from stats; mean imputation if requested")
            m["annual_income_usd"] = float("nan")
        elif i % 59 == 0:
            manifest.record(row_out_idx, "annual_income_usd", "missing_none", income, None, "Treat None as null")
            m["annual_income_usd"] = None
        elif i % 67 == 0 and city == "Tamale":
            # Non-random missingness concentrated in Tamale
            manifest.record(row_out_idx, "date_of_birth", "missing_mnar", dob.isoformat(), "   ", "Whitespace missing value")
            m["date_of_birth"] = "   "

        # Invalid values
        if i % 83 == 0:
            bad_age = "-5" if (i % 2 == 0) else "210"
            manifest.record(row_out_idx, "age", "invalid_range", age, bad_age, "Flag out-of-range age [0,150]")
            m["age"] = bad_age
        if i % 97 == 0:
            bad_dob = INVALID_DATE_STRINGS[i % len(INVALID_DATE_STRINGS)]
            manifest.record(row_out_idx, "date_of_birth", "invalid_date", dob.isoformat(), bad_dob, "Quarantine or mark invalid date")
            m["date_of_birth"] = bad_dob
        if i % 71 == 0 and m["email"] == email:
            bad_email = INVALID_EMAIL_STRINGS[i % len(INVALID_EMAIL_STRINGS)]
            manifest.record(row_out_idx, "email", "invalid_email", email, bad_email, "Quarantine via EMAIL_REGEX")
            m["email"] = bad_email
            quarantined_expected_ids.add(cid)

        # Inconsistencies: casing, whitespace, dates, booleans
        if i % 3 == 0:
            if country == "Ghana":
                m["country"] = COUNTRY_MESSY_GHANA[i % len(COUNTRY_MESSY_GHANA)]
            elif country == "United Kingdom":
                m["country"] = COUNTRY_MESSY_UK[i % len(COUNTRY_MESSY_UK)]
            elif country == "United States":
                m["country"] = COUNTRY_MESSY_US[i % len(COUNTRY_MESSY_US)]
            m["gender"] = (
                GENDER_MESSY_MALE[i % len(GENDER_MESSY_MALE)]
                if gender == "Male"
                else GENDER_MESSY_FEMALE[i % len(GENDER_MESSY_FEMALE)]
            )
            m["account_status"] = STATUS_MESSY[i % len(STATUS_MESSY)]
            if i >= len(SMART_CASE_NAMES):
                m["full_name"] = f"  {first.lower()}   {last.upper()}  "
            manifest.record(row_out_idx, "country", "inconsistent_casing_whitespace", country, m["country"], "Standardize category & trim spaces")
        elif i % 103 == 0:
            m["gender"] = GENDER_INVALID[i % len(GENDER_INVALID)]
            manifest.record(row_out_idx, "gender", "invalid_category_code", gender, m["gender"], "Numeric gender rejected -> UNKNOWN")

        if i % 4 == 0 and m["date_of_birth"] == dob.isoformat():
            m["date_of_birth"] = format_date_messy(dob, rng)
            manifest.record(row_out_idx, "date_of_birth", "inconsistent_date_format", dob.isoformat(), m["date_of_birth"], "Parse to YYYY-MM-DD")

        bool_style = i % 6
        if bool_style == 1:
            m["is_verified"] = "Yes" if verified_bool else "no"
        elif bool_style == 2:
            m["is_verified"] = "1" if verified_bool else "0"
        elif bool_style == 3:
            m["is_verified"] = "TRUE" if verified_bool else "FALSE"

        # Legitimate extreme enterprise income vs erroneous income outlier
        if seg == "Enterprise" and i % 199 == 0 and isinstance(m["annual_income_usd"], float) and not math.isnan(m["annual_income_usd"]):
            m["annual_income_usd"] = 1_950_000.0
            manifest.record(row_out_idx, "annual_income_usd", "legitimate_extreme_value", income, 1_950_000.0, "High Enterprise earner; flag statistically without blind deletion")

        # Mojibake / formula injection probe in selected non-header sample rows
        if i in (25, 26, 27):
            m["full_name"] = MOJIBAKE_NAMES[i - 25]
            manifest.record(row_out_idx, "full_name", "mojibake_encoding", full_name, m["full_name"], "Repair mojibake")
        elif i == 28:
            m["full_name"] = FORMULA_INJECTION_PAYLOADS[0]
            manifest.record(row_out_idx, "full_name", "formula_injection_test", full_name, m["full_name"], "Neutralize spreadsheet formula")

        messy_stats.observe_row(m)
        messy_chunk.append(m)

        if len(xlsx_rows) < xlsx_cap:
            xlsx_rows.append([m.get(h) for h in cust_headers])
        if len(cp1252_sample) < min(2000, n_rows):
            cp_row = dict(m)
            if i < 50:
                cp_row["full_name"] = "Renée O'Connor"
            cp1252_sample.append(cp_row)
        if len(bom_semi_sample) < min(1000, n_rows):
            bom_semi_sample.append(m)

        # ER Cross-Source CRM B (matches + intentional ID contradiction traps)
        if i < crm_b_cap:
            if i % 10 == 9:
                # Contradiction pair: SAME name & city, DIFFERENT national_id -> MUST NOT MERGE
                crm_b_contradiction_pairs += 1
                crm_b_records.append(
                    {
                        "source_system": "CRM_B",
                        "record_id": f"CRMB-{i + 1:06d}",
                        "national_id": f"GHA-999{100000 + i:06d}",
                        "name": full_name,
                        "email": f"other.{i}@secondary.gh",
                        "phone": phone,
                        "city": city,
                        "date_of_birth": dob.isoformat(),
                    }
                )
            else:
                crm_b_expected_matches += 1
                nick_first, nick_alt = NICKNAME_PAIRS[i % len(NICKNAME_PAIRS)]
                alt_name = f"{nick_alt} {last}" if (i % 5 == 0) else (
                    f"{last}, {first}" if (i % 3 == 0 and "," not in full_name) else full_name.upper()
                )
                crm_b_records.append(
                    {
                        "source_system": "CRM_B",
                        "record_id": f"CRMB-{i + 1:06d}",
                        "national_id": nat_id,
                        "name": alt_name,
                        "email": email.upper(),
                        "phone": "0" + phone[4:] if phone.startswith("+233") else phone,
                        "city": city,
                        "date_of_birth": dob.strftime("%d/%m/%Y"),
                    }
                )

        # Exact duplicate & near-duplicate rows
        if r_defect < 0.015:
            dup = dict(m)
            manifest.record(row_out_idx + 1, "customer_id", "exact_duplicate_row", cid, cid, "Deduplicate exact row")
            messy_stats.observe_row(dup)
            messy_chunk.append(dup)
            duplicate_rows_added += 1
        elif r_defect < 0.030:
            near = dict(m)
            near["created_at"] = (created + timedelta(days=2)).isoformat()
            manifest.record(row_out_idx + 1, "created_at", "near_duplicate_timestamp_drift", created.isoformat(), near["created_at"], "Near-duplicate; resolve rather than blind delete")
            messy_stats.observe_row(near)
            messy_chunk.append(near)
            near_dup_rows_added += 1

        # Linked transactions (2 per customer on <=500k tiers, 1 per customer on 1M+ tiers to stay safe on disk)
        tx_per_cust = 2 if n_rows <= 500_000 else 1
        for _ in range(tx_per_cust):
            tx_seq += 1
            tx_cid = cid
            if tx_seq % 100 == 0:
                tx_cid = f"CUST-ORPHAN-{tx_seq:06d}"
                orphaned_tx_count += 1
            tx_prod = f"PROD-{((tx_seq * 7) % prod_max) + 1:06d}"
            qty = -2 if (tx_seq % 250 == 0) else (1 + (tx_seq % 8))
            base_amt = round(max(1.5, income * 0.002 * qty * (0.7 + rng.random() * 0.6)), 2)
            cur = ("GHS", "USD", "EUR", "GBP")[tx_seq % 4]
            tx_row = {
                "transaction_id": f"TX-{tx_seq:08d}",
                "customer_id": tx_cid,
                "product_id": tx_prod,
                "tx_timestamp": (
                    datetime(2025, 1, 1, tzinfo=timezone.utc) + timedelta(hours=tx_seq % 8760)
                ).isoformat(),
                "currency": cur,
                "quantity": qty,
                "amount_usd": base_amt,
                "payment_method": ("MobileMoney", "Card", "BankTransfer", "Cash")[tx_seq % 4],
                "is_flagged": 1 if (qty < 0 or base_amt > 10_000) else 0,
            }
            tx_stats.observe_row(tx_row, track_exact_dups=False)
            tx_chunk.append(tx_row)

        if len(clean_chunk) >= chunk_size:
            clean_writer.write_chunk(clean_chunk)
            clean_chunk.clear()
        if len(messy_chunk) >= chunk_size:
            messy_writer.write_chunk(messy_chunk)
            messy_chunk.clear()
        if len(tx_chunk) >= chunk_size:
            tx_writer.write_chunk(tx_chunk)
            tx_chunk.clear()

    if clean_chunk:
        clean_writer.write_chunk(clean_chunk)
    if messy_chunk:
        messy_writer.write_chunk(messy_chunk)
    if tx_chunk:
        tx_writer.write_chunk(tx_chunk)

    clean_writer.close()
    messy_writer.close()
    tx_writer.close()

    # Auxiliary encoding/format test files
    crm_b_path = datasets_dir / tier / "domain_a_customers_crm_b.json"
    crm_b_path.write_text(json.dumps(crm_b_records, indent=2), encoding="utf-8")
    write_minimal_xlsx(datasets_dir / tier / "domain_a_customers_excel.xlsx", cust_headers, xlsx_rows)
    write_csv_variant(
        datasets_dir / tier / "domain_a_customers_cp1252.csv",
        cust_headers,
        cp1252_sample,
        delimiter=",",
        encoding="cp1252",
        bom=False,
    )
    write_csv_variant(
        datasets_dir / tier / "domain_a_customers_utf8bom_semicolon.csv",
        cust_headers,
        bom_semi_sample,
        delimiter=";",
        encoding="utf-8",
        bom=True,
    )

    total_messy = n_rows + duplicate_rows_added + near_dup_rows_added
    return {
        "domain": "A",
        "manifest": manifest.to_dict(total_clean_rows=n_rows, total_output_rows=total_messy),
        "reference_stats": {
            "clean_customers": clean_stats.to_dict(),
            "messy_customers": messy_stats.to_dict(),
            "transactions": tx_stats.to_dict(),
        },
        "expected": {
            "clean_customer_rows": n_rows,
            "messy_customer_rows": total_messy,
            "exact_duplicate_rows_added": duplicate_rows_added,
            "near_duplicate_rows_added": near_dup_rows_added,
            "crm_b_total_records": len(crm_b_records),
            "crm_b_expected_true_matches": crm_b_expected_matches,
            "crm_b_expected_contradiction_splits": crm_b_contradiction_pairs,
            "expected_min_quarantined_invalid_emails": len(quarantined_expected_ids),
            "transaction_rows": tx_seq,
            "orphaned_transaction_fk_count": orphaned_tx_count,
            "files": [
                "domain_a_customers.csv",
                "domain_a_customers.ndjson",
                "domain_a_customers.parquet",
                "domain_a_customers_crm_b.json",
                "domain_a_customers_excel.xlsx",
                "domain_a_customers_cp1252.csv",
                "domain_a_customers_utf8bom_semicolon.csv",
                "domain_a_transactions.parquet",
            ],
        },
    }


# ---------------------------------------------------------------------------
# Domain B: Financial & Business Operations (P&L Equations & Period Gaps)
# ---------------------------------------------------------------------------

def generate_domain_b(
    tier: str,
    n_rows: int,
    seed: int,
    chunk_size: int,
    datasets_dir: Path,
    ref_dir: Path,
    full_json_cap: int | None,
) -> Dict[str, Any]:
    rng = random.Random(seed + 202)
    manifest = CorruptionManifest("domain_b_financial_ops", tier)
    headers = [
        "ledger_id",
        "entity_code",
        "fiscal_period",
        "transaction_date",
        "currency",
        "exchange_rate_to_usd",
        "gross_revenue",
        "discount_amount",
        "net_revenue",
        "cogs",
        "operating_expense",
        "tax_rate_pct",
        "tax_amount",
        "net_profit",
        "late_fee_usd",
        "formatted_amount",
        "refund_flag",
        "is_manual_override",
        "audit_version",
    ]
    schema = pa.schema(
        [
            ("ledger_id", pa.string()),
            ("entity_code", pa.string()),
            ("fiscal_period", pa.string()),
            ("transaction_date", pa.string()),
            ("currency", pa.string()),
            ("exchange_rate_to_usd", pa.float64()),
            ("gross_revenue", pa.float64()),
            ("discount_amount", pa.float64()),
            ("net_revenue", pa.float64()),
            ("cogs", pa.float64()),
            ("operating_expense", pa.float64()),
            ("tax_rate_pct", pa.float64()),
            ("tax_amount", pa.float64()),
            ("net_profit", pa.float64()),
            ("late_fee_usd", pa.float64()),
            ("formatted_amount", pa.string()),
            ("refund_flag", pa.string()),
            ("is_manual_override", pa.float64()),
            ("audit_version", pa.string()),
        ]
    )

    clean_writer = StreamingMultiWriter(
        headers=headers,
        csv_path=ref_dir / "clean-data" / tier / "domain_b_ledger_clean.csv",
    )
    messy_writer = StreamingMultiWriter(
        headers=headers,
        csv_path=datasets_dir / tier / "domain_b_ledger.csv",
        ndjson_path=datasets_dir / tier / "domain_b_ledger.ndjson",
        json_array_path=datasets_dir / tier / "domain_b_ledger_sample.json",
        json_array_limit=full_json_cap or 10_000,
        parquet_path=datasets_dir / tier / "domain_b_ledger.parquet",
        parquet_schema=schema,
    )

    # Note: 2025-Q3 is DELIBERATELY omitted to verify missing accounting period detection
    available_periods = ("2025-Q1", "2025-Q2", "2025-Q4", "2026-Q1", "2026-Q2")
    currencies = {"USD": 1.0, "EUR": 1.08, "GBP": 1.27, "GHS": 0.068}
    cur_keys = tuple(currencies.keys())

    messy_stats = DomainStatsCollector(
        numeric_cols=[
            "gross_revenue",
            "discount_amount",
            "net_revenue",
            "net_profit",
            "tax_rate_pct",
            "late_fee_usd",
            "is_manual_override",
        ],
        categorical_cols=["fiscal_period", "currency", "audit_version"],
    )

    clean_chunk: List[Dict[str, Any]] = []
    messy_chunk: List[Dict[str, Any]] = []
    dup_count = 0
    invalid_currency_count = 0
    reconciled_pl_mismatch_count = 0

    for i in range(n_rows):
        period = available_periods[i % len(available_periods)]
        cur = cur_keys[i % len(cur_keys)]
        fx = currencies[cur]
        gross = round(math.exp(rng.gauss(7.6, 0.75)), 2)
        disc_pct = rng.choice((0.0, 0.05, 0.10, 0.15))
        disc = round(gross * disc_pct, 2)
        net_rev = round(gross - disc, 2)
        cogs = round(net_rev * rng.uniform(0.35, 0.60), 2)
        opex = round(net_rev * rng.uniform(0.10, 0.25), 2)
        tax_rate = 15.0 if cur == "GHS" else 20.0
        tax_amt = round(net_rev * (tax_rate / 100.0), 2)
        net_profit = round(net_rev - cogs - opex - tax_amt, 2)
        late_fee = round(rng.uniform(15.0, 120.0), 2) if (i % 5 == 0) else 0.0  # 80% zero-inflated!
        tx_date = date(2025, 1, 1) + timedelta(days=i % 500)

        clean_row = {
            "ledger_id": f"LED-{i + 1:07d}",
            "entity_code": f"BU-{(i % 12) + 1:02d}",
            "fiscal_period": period,
            "transaction_date": tx_date.isoformat(),
            "currency": cur,
            "exchange_rate_to_usd": fx,
            "gross_revenue": gross,
            "discount_amount": disc,
            "net_revenue": net_rev,
            "cogs": cogs,
            "operating_expense": opex,
            "tax_rate_pct": tax_rate,
            "tax_amount": tax_amt,
            "net_profit": net_profit,
            "late_fee_usd": late_fee,
            "formatted_amount": format_currency_messy(net_rev, cur, rng),
            "refund_flag": "false",
            "is_manual_override": 1.0 if (i % 500 == 0) else 0.0,  # near-constant (99.8% zero)
            "audit_version": "v2.1",  # constant zero-variance column
        }
        clean_chunk.append(clean_row)

        m = dict(clean_row)
        idx = i + dup_count

        # Inject valid negative refunds vs corrupted accounting mismatches
        if i % 40 == 0:
            m["refund_flag"] = "TRUE"
            m["gross_revenue"] = -gross
            m["net_revenue"] = -net_rev
            m["net_profit"] = -abs(net_profit)
            m["formatted_amount"] = format_currency_messy(-net_rev, cur, rng)
            manifest.record(idx, "gross_revenue", "valid_negative_refund", gross, -gross, "Preserve negative refund ledger row")
        elif i % 111 == 0:
            # Deliberate accounting inconsistency: net_revenue != gross - discount
            m["net_revenue"] = round(net_rev + 500.0, 2)
            reconciled_pl_mismatch_count += 1
            manifest.record(idx, "net_revenue", "inconsistent_financial_total", net_rev, m["net_revenue"], "Audit rule catches P&L equation breach")

        if i % 53 == 0:
            m["tax_rate_pct"] = 145.0 if (i % 2 == 0) else -4.0
            manifest.record(idx, "tax_rate_pct", "invalid_percentage", tax_rate, m["tax_rate_pct"], "Out-of-bounds tax percentage [0,100]")

        if i % 31 == 0:
            m["formatted_amount"] = "invalid-amt" if (i % 2 == 0) else ""
            invalid_currency_count += 1
            manifest.record(idx, "formatted_amount", "invalid_currency_string", clean_row["formatted_amount"], m["formatted_amount"], "_parse_currency_string must return (None, None)")

        if i % 61 == 0:
            m["net_profit"] = float("nan")
            manifest.record(idx, "net_profit", "missing_nan", net_profit, "NaN", "Exclude NaN before EDA statistics")

        messy_stats.observe_row(m)
        messy_chunk.append(m)

        if i % 75 == 0:
            dup = dict(m)
            dup_count += 1
            manifest.record(idx + 1, "ledger_id", "duplicate_invoice", m["ledger_id"], m["ledger_id"], "Duplicate accounting entry")
            messy_stats.observe_row(dup)
            messy_chunk.append(dup)

        if len(clean_chunk) >= chunk_size:
            clean_writer.write_chunk(clean_chunk)
            clean_chunk.clear()
        if len(messy_chunk) >= chunk_size:
            messy_writer.write_chunk(messy_chunk)
            messy_chunk.clear()

    if clean_chunk:
        clean_writer.write_chunk(clean_chunk)
    if messy_chunk:
        messy_writer.write_chunk(messy_chunk)
    clean_writer.close()
    messy_writer.close()

    return {
        "domain": "B",
        "manifest": manifest.to_dict(total_clean_rows=n_rows, total_output_rows=n_rows + dup_count),
        "reference_stats": {"messy_ledger": messy_stats.to_dict()},
        "expected": {
            "clean_rows": n_rows,
            "messy_rows": n_rows + dup_count,
            "duplicate_invoices": dup_count,
            "missing_fiscal_periods": ["2025-Q3"],
            "zero_variance_columns": ["audit_version"],
            "near_constant_columns": ["is_manual_override"],
            "zero_inflated_columns": ["late_fee_usd"],
            "invalid_currency_strings_for_none_check": invalid_currency_count,
            "accounting_pl_mismatches": reconciled_pl_mismatch_count,
            "files": [
                "domain_b_ledger.csv",
                "domain_b_ledger.ndjson",
                "domain_b_ledger.parquet",
                "domain_b_ledger_sample.json",
            ],
        },
    }


# ---------------------------------------------------------------------------
# Domain C: E-Commerce Catalog & Denormalized Orders (Decomposition + Pipeline Builder)
# ---------------------------------------------------------------------------

def generate_domain_c(
    tier: str,
    n_rows: int,
    seed: int,
    chunk_size: int,
    datasets_dir: Path,
    ref_dir: Path,
) -> Dict[str, Any]:
    manifest = CorruptionManifest("domain_c_ecommerce_retail", tier)

    n_products = min(max(200, n_rows // 10), 50_000)
    n_customers_ref = min(max(100, n_rows // 5), 100_000)
    n_stores = 15
    n_vendors = 25
    categories = ("Electronics", "Fashion", "HomeGoods", "Groceries", "Health")

    prod_headers = [
        "product_id",
        "sku_code",
        "product_name",
        "product_category",
        "unit_price",
        "vendor_id",
        "vendor_name",
        "inventory_qty",
    ]
    prod_schema = pa.schema(
        [
            ("product_id", pa.string()),
            ("sku_code", pa.string()),
            ("product_name", pa.string()),
            ("product_category", pa.string()),
            ("unit_price", pa.float64()),
            ("vendor_id", pa.string()),
            ("vendor_name", pa.string()),
            ("inventory_qty", pa.int64()),
        ]
    )

    prod_writer = StreamingMultiWriter(
        headers=prod_headers,
        csv_path=datasets_dir / tier / "domain_c_products.csv",
        parquet_path=datasets_dir / tier / "domain_c_products.parquet",
        parquet_schema=prod_schema,
    )
    products_lookup: List[Dict[str, Any]] = []
    prod_chunk: List[Dict[str, Any]] = []
    for p in range(n_products):
        pid = f"PROD-{p + 1:06d}"
        vid = f"VEND-{(p % n_vendors) + 1:03d}"
        cat = categories[p % len(categories)]
        price = round(12.0 + ((p * 17) % 900) * 1.15, 2)
        prod_row = {
            "product_id": pid,
            "sku_code": f"000{p + 1001:06d}",  # leading-zero SKU
            "product_name": f"{cat} Item {p + 1}",
            "product_category": cat,
            "unit_price": price,
            "vendor_id": vid,
            "vendor_name": f"WestAfrica Supply Co {(p % n_vendors) + 1}",
            "inventory_qty": 25 + (p * 11) % 500,
        }
        products_lookup.append(prod_row)
        prod_chunk.append(prod_row)
        if len(prod_chunk) >= chunk_size:
            prod_writer.write_chunk(prod_chunk)
            prod_chunk.clear()
    if prod_chunk:
        prod_writer.write_chunk(prod_chunk)
    prod_writer.close()

    # Orders denormalized (clean + messy) for PipelineBuilder JOIN/DERIVE/GROUP_BY & RelationalDecomposer
    order_headers = [
        "order_id",
        "order_date",
        "customer_id",
        "customer_name",
        "customer_email",
        "product_id",
        "product_name",
        "product_category",
        "store_id",
        "store_name",
        "store_city",
        "vendor_id",
        "vendor_name",
        "unit_price",
        "quantity",
        "discount_pct",
        "order_total",
        "return_flag",
        "review_score",
    ]
    order_schema = pa.schema(
        [
            ("order_id", pa.string()),
            ("order_date", pa.string()),
            ("customer_id", pa.string()),
            ("customer_name", pa.string()),
            ("customer_email", pa.string()),
            ("product_id", pa.string()),
            ("product_name", pa.string()),
            ("product_category", pa.string()),
            ("store_id", pa.string()),
            ("store_name", pa.string()),
            ("store_city", pa.string()),
            ("vendor_id", pa.string()),
            ("vendor_name", pa.string()),
            ("unit_price", pa.float64()),
            ("quantity", pa.int64()),
            ("discount_pct", pa.float64()),
            ("order_total", pa.float64()),
            ("return_flag", pa.string()),
            ("review_score", pa.int64()),
        ]
    )
    clean_writer = StreamingMultiWriter(
        headers=order_headers,
        csv_path=ref_dir / "clean-data" / tier / "domain_c_orders_clean.csv",
    )
    messy_writer = StreamingMultiWriter(
        headers=order_headers,
        csv_path=datasets_dir / tier / "domain_c_orders_denormalized.csv",
        parquet_path=datasets_dir / tier / "domain_c_orders_denormalized.parquet",
        parquet_schema=order_schema,
    )
    order_stats = DomainStatsCollector(
        numeric_cols=["unit_price", "quantity", "discount_pct", "order_total", "review_score"],
        categorical_cols=["product_category", "store_city", "return_flag"],
    )

    clean_chunk: List[Dict[str, Any]] = []
    messy_chunk: List[Dict[str, Any]] = []
    orphaned_products = 0
    invalid_reviews = 0
    cat_totals_clean: Dict[str, float] = {c: 0.0 for c in categories}
    cat_counts_clean: Dict[str, int] = {c: 0 for c in categories}

    for i in range(n_rows):
        prod = products_lookup[i % n_products]
        cust_idx = (i * 3) % n_customers_ref
        cid = f"CUST-{cust_idx + 1:07d}"
        cname = f"{GHANA_FIRST_NAMES[cust_idx % len(GHANA_FIRST_NAMES)]} {GHANA_LAST_NAMES[cust_idx % len(GHANA_LAST_NAMES)]}"
        store_idx = i % n_stores
        scity, _, _, _ = GHANA_CITIES[store_idx % len(GHANA_CITIES)]
        qty = 1 + (i % 6)
        disc_pct = float((0, 5, 10, 15, 20)[i % 5])
        total = round(prod["unit_price"] * qty * (1.0 - disc_pct / 100.0), 2)
        rev = 1 + (i % 5)
        cat_totals_clean[prod["product_category"]] += total
        cat_counts_clean[prod["product_category"]] += 1

        clean_row = {
            "order_id": f"ORD-{i + 1:07d}",
            "order_date": (date(2025, 1, 1) + timedelta(days=i % 365)).isoformat(),
            "customer_id": cid,
            "customer_name": cname,
            "customer_email": f"buyer{cust_idx}@shop.gh",
            "product_id": prod["product_id"],
            "product_name": prod["product_name"],
            "product_category": prod["product_category"],
            "store_id": f"STR-{store_idx + 1:03d}",
            "store_name": f"LuminMart {scity} #{store_idx + 1}",
            "store_city": scity,
            "vendor_id": prod["vendor_id"],
            "vendor_name": prod["vendor_name"],
            "unit_price": prod["unit_price"],
            "quantity": qty,
            "discount_pct": disc_pct,
            "order_total": total,
            "return_flag": "true" if (i % 20 == 0) else "false",
            "review_score": rev,
        }
        clean_chunk.append(clean_row)

        m = dict(clean_row)
        if i % 90 == 0:
            m["product_id"] = f"PROD-MISSING-{i:04d}"
            orphaned_products += 1
            manifest.record(i, "product_id", "orphaned_foreign_key", prod["product_id"], m["product_id"], "Unmatched FK tests JOIN(outer) -> full null enrichment")
        if i % 120 == 0:
            m["review_score"] = 9 if (i % 2 == 0) else 0
            invalid_reviews += 1
            manifest.record(i, "review_score", "invalid_rating", rev, m["review_score"], "Out of valid [1,5] range")
        if i % 85 == 0:
            m["quantity"] = -qty
            manifest.record(i, "quantity", "negative_quantity", qty, m["quantity"], "Invalid negative order quantity")

        order_stats.observe_row(m, track_exact_dups=False)
        messy_chunk.append(m)

        if len(clean_chunk) >= chunk_size:
            clean_writer.write_chunk(clean_chunk)
            clean_chunk.clear()
        if len(messy_chunk) >= chunk_size:
            messy_writer.write_chunk(messy_chunk)
            messy_chunk.clear()

    if clean_chunk:
        clean_writer.write_chunk(clean_chunk)
    if messy_chunk:
        messy_writer.write_chunk(messy_chunk)
    clean_writer.close()
    messy_writer.close()

    return {
        "domain": "C",
        "manifest": manifest.to_dict(total_clean_rows=n_rows, total_output_rows=n_rows),
        "reference_stats": {"messy_orders": order_stats.to_dict()},
        "expected": {
            "product_catalog_rows": n_products,
            "orders_rows": n_rows,
            "distinct_customers_in_orders": n_customers_ref,
            "distinct_stores": n_stores,
            "distinct_vendors": n_vendors,
            "orphaned_product_fk_orders": orphaned_products,
            "invalid_review_scores": invalid_reviews,
            "clean_category_sum_order_total": {k: round(v, 2) for k, v in cat_totals_clean.items()},
            "clean_category_order_counts": cat_counts_clean,
            "files": [
                "domain_c_products.csv",
                "domain_c_products.parquet",
                "domain_c_orders_denormalized.csv",
                "domain_c_orders_denormalized.parquet",
            ],
        },
    }


# ---------------------------------------------------------------------------
# Domain D: Operational Sensor & Time-Series Telemetry
# ---------------------------------------------------------------------------

def generate_domain_d(
    tier: str,
    n_rows: int,
    seed: int,
    chunk_size: int,
    datasets_dir: Path,
    ref_dir: Path,
) -> Dict[str, Any]:
    rng = random.Random(seed + 404)
    manifest = CorruptionManifest("domain_d_timeseries", tier)
    headers = [
        "reading_id",
        "sensor_id",
        "recorded_at",
        "temperature_c",
        "vibration_rms",
        "power_kw",
        "latency_ms",
        "uptime_flag",
    ]
    schema = pa.schema(
        [
            ("reading_id", pa.string()),
            ("sensor_id", pa.string()),
            ("recorded_at", pa.string()),
            ("temperature_c", pa.float64()),
            ("vibration_rms", pa.float64()),
            ("power_kw", pa.float64()),
            ("latency_ms", pa.float64()),
            ("uptime_flag", pa.int64()),
        ]
    )

    writer = StreamingMultiWriter(
        headers=headers,
        csv_path=datasets_dir / tier / "domain_d_timeseries.csv",
        parquet_path=datasets_dir / tier / "domain_d_timeseries.parquet",
        parquet_schema=schema,
    )
    stats = DomainStatsCollector(
        numeric_cols=["temperature_c", "vibration_rms", "power_kw", "latency_ms", "uptime_flag"],
        categorical_cols=["sensor_id"],
    )

    base_ts = datetime(2025, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    tz_offsets = ("Z", "+00:00", "+02:00", "-05:00")
    chunk: List[Dict[str, Any]] = []
    spike_count = 0
    impossible_count = 0
    dup_ts_count = 0
    skipped_hours = 0

    for i in range(n_rows):
        sensor = f"SENS-{(i % 5) + 1:02d}"
        # Deliberate 6-hour outage window every 1000 rows
        extra_gap_hours = (i // 1000) * 6
        if i > 0 and i % 1000 == 0:
            skipped_hours += 6
        ts = base_ts + timedelta(hours=(i // 5) + extra_gap_hours, minutes=(i * 13) % 45 if (i % 7 == 0) else 0)
        hour = ts.hour
        # Trend + 24h seasonal temperature
        temp = 38.0 + 0.0005 * (i % 10_000) + 7.5 * math.sin(2.0 * math.pi * hour / 24.0) + rng.gauss(0, 0.8)
        # Bimodal power_kw: day shift (~220kW) vs night shift (~65kW)
        power = rng.gauss(220.0, 12.0) if (7 <= hour <= 19) else rng.gauss(65.0, 6.0)
        vib = max(0.05, rng.gauss(1.2, 0.25))
        # Heavy-tailed Pareto latency
        latency = round(10.0 * (rng.paretovariate(1.8)), 2)

        tz_str = tz_offsets[i % len(tz_offsets)]
        if tz_str == "Z":
            ts_str = ts.strftime("%Y-%m-%dT%H:%M:%SZ")
        else:
            ts_str = ts.isoformat() if tz_str == "+00:00" else f"{ts.strftime('%Y-%m-%dT%H:%M:%S')}{tz_str}"

        row = {
            "reading_id": f"READ-{i + 1:08d}",
            "sensor_id": sensor,
            "recorded_at": ts_str,
            "temperature_c": round(temp, 2),
            "vibration_rms": round(vib, 3),
            "power_kw": round(power, 2),
            "latency_ms": latency,
            "uptime_flag": 1 if power > 20.0 else 0,
        }

        if i % 167 == 0:
            row["temperature_c"] = round(temp + 42.0, 2)  # Genuine sudden operational heat spike
            spike_count += 1
            manifest.record(i + dup_ts_count, "temperature_c", "genuine_operational_spike", round(temp, 2), row["temperature_c"], "Outlier flagged accurately as sudden spike")
        elif i % 251 == 0:
            row["temperature_c"] = -999.0  # Sensor dropout sentinel impossible reading
            impossible_count += 1
            manifest.record(i + dup_ts_count, "temperature_c", "impossible_sensor_reading", round(temp, 2), -999.0, "Impossible physical temperature anomaly")
        elif i % 89 == 0:
            row["vibration_rms"] = float("nan")
            manifest.record(i + dup_ts_count, "vibration_rms", "missing_nan", vib, "NaN", "Exclude NaN from statistics")

        stats.observe_row(row, track_exact_dups=False)
        chunk.append(row)

        if i % 120 == 0:
            dup = dict(row)
            dup_ts_count += 1
            manifest.record(i + dup_ts_count, "recorded_at", "repeated_sensor_reading", ts_str, ts_str, "Duplicate timestamp reading")
            stats.observe_row(dup, track_exact_dups=False)
            chunk.append(dup)

        if len(chunk) >= chunk_size:
            writer.write_chunk(chunk)
            chunk.clear()

    if chunk:
        writer.write_chunk(chunk)
    writer.close()

    return {
        "domain": "D",
        "manifest": manifest.to_dict(total_clean_rows=n_rows, total_output_rows=n_rows + dup_ts_count),
        "reference_stats": {"timeseries": stats.to_dict()},
        "expected": {
            "total_rows": n_rows + dup_ts_count,
            "repeated_readings_added": dup_ts_count,
            "genuine_spike_anomalies": spike_count,
            "impossible_minus_999_readings": impossible_count,
            "planned_outage_hours_inserted": skipped_hours,
            "distributions": {
                "temperature_c": "trend_plus_24h_sinusoid_with_spikes",
                "power_kw": "bimodal_day_220_night_65",
                "latency_ms": "heavy_tailed_pareto",
            },
            "files": ["domain_d_timeseries.csv", "domain_d_timeseries.parquet"],
        },
    }
