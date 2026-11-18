#!/usr/bin/env python3
"""
LuminAI QA Enterprise Dataset Generator (Palantir Foundry-Grade Benchmark)
Generates:
1. qa_datasets/01_positive_enterprise_master.csv (10,000 clean records with realistic distributions)
2. qa_datasets/02_negative_dirty_torture.csv (5,000 dirty records testing injections, nulls, invalid formats, duplicates)
3. qa_datasets/03_relational_archive.zip (customers.csv, orders.csv, shipments.csv)
"""

import os
import csv
import zipfile
import random
import uuid
from datetime import datetime, timedelta

OUTPUT_DIR = os.path.join(os.getcwd(), "qa_datasets")
os.makedirs(OUTPUT_DIR, exist_ok=True)

FIRST_NAMES = ["James", "Emma", "Liam", "Olivia", "Noah", "Sophia", "Lucas", "Isabella", "Mason", "Mia", "Ahmed", "Fatima", "Wei", "Mei", "José", "François", "Müller", "Björn", "Elena", "Dmitry"]
LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"]
CITIES = ["New York", "London", "Tokyo", "Berlin", "Paris", "Dubai", "Singapore", "Toronto", "Sydney", "São Paulo", "Stockholm", "Amsterdam", "Mumbai", "Seoul", "Zurich"]
COUNTRIES = ["US", "GB", "DE", "FR", "AE", "SG", "CA", "AU", "BR", "SE", "NL", "IN", "KR", "CH", "JP"]
STATUSES = ["ACTIVE", "PENDING", "SUSPENDED", "ARCHIVED", "FLAGGED"]
CARGO_TYPES = ["Electronics", "Pharmaceuticals", "Heavy Machinery", "Perishables", "Hazardous Materials", "Automotive Parts", "Textiles"]

def generate_positive_dataset(count=10000):
    filepath = os.path.join(OUTPUT_DIR, "01_positive_enterprise_master.csv")
    print(f"[*] Generating Positive Master Dataset ({count} rows) -> {filepath}...")
    headers = [
        "entity_id", "canonical_name", "first_name", "last_name", "organization", 
        "primary_email", "phone_e164", "country_code", "city", "status", 
        "credit_rating", "total_revenue_usd", "compliance_score", "created_timestamp", "is_verified"
    ]
    with open(filepath, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        base_date = datetime(2023, 1, 1)
        for i in range(1, count + 1):
            fn = random.choice(FIRST_NAMES)
            ln = random.choice(LAST_NAMES)
            name = f"{fn} {ln}"
            org = f"{ln} Global Logistics Inc"
            email = f"{fn.lower()}.{ln.lower()}_{i}@luminai-qa.dev"
            phone = f"+1{random.randint(2000000000, 9999999999)}"
            country = random.choice(COUNTRIES)
            city = random.choice(CITIES)
            status = random.choice(STATUSES)
            credit = random.choice(["AAA", "AA", "A", "BBB", "BB"])
            revenue = round(random.uniform(50000.0, 50000000.0), 2)
            compliance = round(random.uniform(85.0, 100.0), 2)
            timestamp = (base_date + timedelta(days=random.randint(0, 1000), seconds=random.randint(0, 86400))).isoformat() + "Z"
            is_verified = "true" if random.random() > 0.1 else "false"

            writer.writerow([
                f"ENT-{i:07d}", name, fn, ln, org, email, phone, country, city, status,
                credit, revenue, compliance, timestamp, is_verified
            ])
    print(f"  [+] Complete: {os.path.getsize(filepath) / (1024*1024):.2f} MB")

def generate_negative_torture_dataset(count=5000):
    filepath = os.path.join(OUTPUT_DIR, "02_negative_dirty_torture.csv")
    print(f"[*] Generating Negative Torture Dataset ({count} rows) -> {filepath}...")
    headers = [
        "record_id", "full_name", "contact_email", "phone", "national_id", 
        "date_of_birth", "country", "annual_turnover", "risk_rating", "incident_notes", "raw_payload"
    ]

    dirty_null_aliases = ["", "N/A", "null", "NULL", "none", "None", "undefined", "-", "??", "   "]
    formula_injections = [
        "=cmd|' /C calc'!A0",
        "@SUM(1+1)*cmd|' /C powershell Write-Host PWNED'!'A1'",
        "+123456-999999",
        "-DDE(\"cmd\";\"/C notepad\";\"__test__\")",
        "=10+20; DROP TABLE users; --"
    ]
    weird_dates = [
        "1990/01/15", "15-01-1990", "01/15/1990", "1990.01.15", 
        "15 Jan 1990", "1990-02-30", "9999-99-99", "1716940800", "Yesterday"
    ]

    with open(filepath, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        
        # 1. Exact Duplicates group (to test deduplication and golden record resolution)
        for dup_idx in range(1, 101):
            master_name = f"Duplicate Target Alpha {dup_idx}"
            master_email = f"target.alpha.{dup_idx}@acme-corp.com"
            for rep in range(3): # 3 exact duplicates of each
                writer.writerow([
                    f"DUP-EXACT-{dup_idx}-{rep}",
                    master_name,
                    master_email if rep == 0 else f"  {master_email.upper()}  ",
                    "+1-800-555-0199",
                    f"NAT-{dup_idx:05d}",
                    "1985-06-20",
                    "US",
                    "250000.00",
                    "LOW",
                    f"Duplicate test instance {rep}",
                    "{\"type\": \"duplicate_test\"}"
                ])

        # 2. Fuzzy Duplicates group (1-letter typo or nickname)
        for fuzzy_idx in range(1, 101):
            writer.writerow([
                f"DUP-FUZZY-A-{fuzzy_idx}",
                f"Robert Jonathan Davis {fuzzy_idx}",
                f"robert.davis_{fuzzy_idx}@logistics-cloud.net",
                "555-0144",
                f"SSN-{fuzzy_idx:05d}",
                "1978-11-04",
                "usa",
                "120000",
                "MEDIUM",
                "Original entry",
                "{\"status\":\"original\"}"
            ])
            # Fuzzy candidate (typo in name: Bob Davis, different email case, dirty phone)
            writer.writerow([
                f"DUP-FUZZY-B-{fuzzy_idx}",
                f"Bob J. Davis {fuzzy_idx}",
                f"  BOB.DAVIS_{fuzzy_idx}@logistics-cloud.net ",
                "(555) 014-4",
                f"SSN-{fuzzy_idx:05d}",
                "1978/11/04",
                "US",
                "120000.00",
                "MEDIUM",
                "Fuzzy variation to merge",
                "{\"status\":\"fuzzy_match\"}"
            ])

        # 3. Security, Schema Breaks, Malformed Payloads & Injections
        remaining = count - (100 * 3) - (100 * 2)
        for i in range(1, remaining + 1):
            row_id = f"TORTURE-{i:06d}"
            
            # Injection attempt in name or notes
            if i % 15 == 0:
                name = random.choice(formula_injections)
            elif i % 25 == 0:
                name = "<script>alert('XSS_LUMINAI')</script>"
            elif i % 10 == 0:
                name = "Robert'); DROP TABLE entities;--"
            elif i % 8 == 0:
                name = "José María Müller 🚢📦 (Special Unicode Test)"
            else:
                name = f"{random.choice(FIRST_NAMES)}   {random.choice(LAST_NAMES)}  "

            # Dirty emails
            if i % 12 == 0:
                email = random.choice(dirty_null_aliases)
            elif i % 18 == 0:
                email = "invalid_email_missing_at_symbol.com"
            elif i % 7 == 0:
                email = f"  {random.choice(FIRST_NAMES)}.{i}@CORP-TEST.COM   "
            else:
                email = f"user_{i}@domain.org"

            # Dirty Phone
            phone = random.choice(["N/A", "000-000-0000", "+44 (0) 20 7946 0912", "12345", "--", "EXT: 4402"]) if i % 5 == 0 else f"+1555{random.randint(1000000, 9999999)}"

            # Dirty Dates
            dob = random.choice(weird_dates) if i % 4 == 0 else "1992-05-14"

            # Dirty Country
            country = random.choice(["united states", "U.S.A.", "DE", "de", "n/a", "UNKNOWN", "99", "FR"])

            # Numeric Overflow / Negative / String in numeric column
            if i % 10 == 0:
                turnover = random.choice(["-9999999", "NaN", "INF", "One Million Dollars", "N/A", "0.00000001"])
            else:
                turnover = str(round(random.uniform(-500.0, 15000000.0), 2))

            # Risk Rating
            risk = random.choice(["HIGH", "CRITICAL", "LOW", "MEDIUM", "UNKNOWN", "100%", ""])

            # Massive String (testing column buffer overflow)
            notes = ("CRITICAL SHIPMENT NOTE: " + ("ALERT! " * 80)) if i % 20 == 0 else f"Standard QA note #{i}"

            raw_json = "{\"corrupt\": true, \"flags\": [1,2,3]}" if i % 3 == 0 else "{malformed_json_without_quotes}"

            writer.writerow([row_id, name, email, phone, f"ID-{i}", dob, country, turnover, risk, notes, raw_json])

    print(f"  [+] Complete: {os.path.getsize(filepath) / (1024*1024):.2f} MB")

def generate_relational_archive():
    zip_path = os.path.join(OUTPUT_DIR, "03_relational_archive.zip")
    print(f"[*] Generating Multi-Table Relational Archive -> {zip_path}...")
    
    customers_path = os.path.join(OUTPUT_DIR, "customers.csv")
    orders_path = os.path.join(OUTPUT_DIR, "orders.csv")
    shipments_path = os.path.join(OUTPUT_DIR, "shipments.csv")

    # 1. Customers
    customer_ids = []
    with open(customers_path, mode="w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["customer_id", "company_name", "tier", "account_manager", "country"])
        for i in range(1, 1001):
            cid = f"CUST-{i:05d}"
            customer_ids.append(cid)
            w.writerow([cid, f"Enterprise Corp {i}", random.choice(["PLATINUM", "GOLD", "SILVER"]), f"Manager {random.randint(1, 20)}", random.choice(COUNTRIES)])

    # 2. Orders
    order_ids = []
    with open(orders_path, mode="w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["order_id", "customer_id", "order_date", "total_amount", "currency", "order_status"])
        for i in range(1, 3001):
            oid = f"ORD-{i:06d}"
            order_ids.append(oid)
            cid = random.choice(customer_ids)
            w.writerow([oid, cid, "2024-03-15", round(random.uniform(500, 250000), 2), "USD", random.choice(["FULFILLED", "PROCESSING", "CANCELLED"])])

    # 3. Shipments
    with open(shipments_path, mode="w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["shipment_id", "order_id", "carrier", "origin_hub", "dest_hub", "delivery_status", "weight_kg"])
        for i in range(1, 3001):
            sid = f"SHP-{i:06d}"
            oid = order_ids[i - 1]
            w.writerow([sid, oid, random.choice(["DHL Express", "FedEx", "Maersk", "DB Schenker"]), random.choice(CITIES), random.choice(CITIES), random.choice(["DELIVERED", "IN_TRANSIT", "DELAYED"]), round(random.uniform(10.5, 5000.0), 2)])

    # Package into ZIP
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.write(customers_path, arcname="customers.csv")
        z.write(orders_path, arcname="orders.csv")
        z.write(shipments_path, arcname="shipments.csv")

    for p in [customers_path, orders_path, shipments_path]:
        try:
            os.remove(p)
        except OSError:
            pass

    print(f"  [+] Complete: {os.path.getsize(zip_path) / 1024:.2f} KB")

if __name__ == "__main__":
    print("=" * 70)
    print("LuminAI Enterprise QA Benchmark Generator")
    print("=" * 70)
    generate_positive_dataset(count=10000)
    generate_negative_torture_dataset(count=5000)
    generate_relational_archive()
    print("=" * 70)
    print(f"All benchmark datasets generated in: {OUTPUT_DIR}")
    print("=" * 70)
