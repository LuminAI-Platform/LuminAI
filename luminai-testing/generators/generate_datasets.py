#!/usr/bin/env python3
"""
LuminAI Synthetic Enterprise Dataset Generator
==============================================
Generates multi-tier, multi-format, realistic synthetic enterprise datasets for
"Afrilink Logistics & Retail Ltd." (Accra, Ghana).

Includes deliberate data quality issues (nulls, duplicates, outliers, casing, leading zeros)
and edge cases across CSV, TSV, JSON, JSONL, Parquet, XLSX, and XML.
"""

import os
import sys
import json
import random
import datetime
from pathlib import Path

# Seed for absolute determinism
SEED = 42
random.seed(SEED)

ROOT_DIR = Path(__file__).resolve().parent.parent
DATASETS_DIR = ROOT_DIR / "datasets"

SMALL_DIR = DATASETS_DIR / "small"
MEDIUM_DIR = DATASETS_DIR / "medium"
LARGE_DIR = DATASETS_DIR / "large"
EDGE_DIR = DATASETS_DIR / "edge-cases"

for d in [SMALL_DIR, MEDIUM_DIR, LARGE_DIR, EDGE_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Domain Knowledge: Afrilink Logistics & Retail Ltd.
FIRST_NAMES = [
    "Kwesi", "Ama", "Kofi", "Abena", "Kwame", "Akua", "Yaw", "Yaa",
    "Kojo", "Afia", "Kwaku", "Esi", "Emmanuel", "Grace", "Samuel",
    "Mercy", "John", "Mary", "Michael", "Dorothy", "David", "Elizabeth",
    "Joseph", "Patience", "Daniel", "Comfort", "Peter", "Gladys", "Francis",
    "Beatrice", "Yao", "Koku", "Fatima", "Ibrahim", "Amina", "Mohammed",
    "Zainab", "Chidi", "Ngozi", "Emeka", "Kehinde", "Oluwaseun", "Kiprono"
]

LAST_NAMES = [
    "Mensah", "Osei", "Boateng", "Appiah", "Owusu", "Asante", "Agyemang",
    "Addison", "Kwarteng", "Antwi", "Frimpong", "Acheampong", "Amponsah",
    "Darko", "Quaye", "Lamptey", "Tetteh", "Tagoe", "Lartey", "Anang",
    "Dzogbe", "Gbeho", "Kpodo", "Bello", "Abubakar", "Danjuma", "Okafor",
    "Adeyemi", "Mwangi", "Otieno", "Traore", "Coulibaly", "Kone"
]

GHANA_REGIONS = [
    "Greater Accra", "Ashanti", "Western", "Central", "Eastern",
    "Volta", "Northern", "Upper East", "Upper West", "Bono"
]

CITIES_BY_REGION = {
    "Greater Accra": ["Accra", "Tema", "Madina", "Kasoa", "Spintex", "East Legon"],
    "Ashanti": ["Kumasi", "Obuasi", "Ejisu", "Mampong"],
    "Western": ["Takoradi", "Sekondi", "Tarkwa"],
    "Central": ["Cape Coast", "Winneba", "Elmina"],
    "Eastern": ["Koforidua", "Nkawkaw", "Nsawam"],
    "Volta": ["Ho", "Aflao", "Keta"],
    "Northern": ["Tamale", "Yendi"],
    "Upper East": ["Bolgatanga", "Navrongo"],
    "Upper West": ["Wa"],
    "Bono": ["Sunyani", "Berekum"]
}

STREET_NAMES = [
    "Independence Ave", "High Street", "Ring Road Central", "Oxford Street",
    "Liberation Road", "Graphic Road", "Spintex Road", "Barnes Road",
    "Kojo Thompson Road", "Giffard Road", "Achimota Road", "Prempeh II Ave",
    "Harper Road", "Commercial Street", "Harbour Road", "Tamale Highway"
]

CURRENCIES = ["GHS", "GHS", "GHS", "GHS", "USD", "EUR", "NGN", "KES"]
PAYMENT_METHODS = ["MTN Mobile Money", "Telecel Cash", "AT Money", "Visa", "Mastercard", "Bank Wire Transfer"]
CUSTOMER_TIERS = ["Standard", "Silver", "Gold", "Platinum", "Enterprise"]
PRODUCT_CATEGORIES = [
    "Freight Forwarding", "Cold Chain Logistics", "Warehousing",
    "Express Courier", "Packaging Materials", "Bulk Cargo", "Customs Clearance"
]

PRODUCTS = [
    ("PRD-001", "20ft Shipping Container Freight", "Freight Forwarding", 8500.0, 11200.0),
    ("PRD-002", "40ft High Cube Container Freight", "Freight Forwarding", 14500.0, 18900.0),
    ("PRD-003", "Refrigerated Perishable Storage (per m3/mo)", "Cold Chain Logistics", 350.0, 520.0),
    ("PRD-004", "Pharma Temperature Controlled Transport", "Cold Chain Logistics", 1200.0, 1750.0),
    ("PRD-005", "Standard Bonded Warehousing Pallet/Day", "Warehousing", 45.0, 75.0),
    ("PRD-006", "Cross-Dock Handling Fee", "Warehousing", 120.0, 180.0),
    ("PRD-007", "Intra-City Express Parcel (Accra/Tema)", "Express Courier", 35.0, 60.0),
    ("PRD-008", "Inter-City Express Courier (Accra-Kumasi)", "Express Courier", 85.0, 140.0),
    ("PRD-009", "Heavy Duty Corrugated Carton (Pack of 50)", "Packaging Materials", 220.0, 310.0),
    ("PRD-010", "Industrial Wooden Heat-Treated Pallet", "Packaging Materials", 150.0, 230.0),
    ("PRD-011", "Bulk Cocoa Bean Transport (per Ton)", "Bulk Cargo", 650.0, 920.0),
    ("PRD-012", "Mining Equipment Heavy Haulage", "Bulk Cargo", 18500.0, 24000.0),
    ("PRD-013", "Tema Port Single Window Customs Filing", "Customs Clearance", 950.0, 1400.0),
    ("PRD-014", "Transit Bond Guarantee Service", "Customs Clearance", 1800.0, 2600.0),
    ("PRD-015", "Last-Mile Delivery Vehicle Charter (Day)", "Express Courier", 1400.0, 2100.0)
]

DEPARTMENTS = ["Logistics Operations", "Finance & Accounting", "Fleet Management", "Human Resources", "Sales & Marketing", "IT & Platform Engineering"]
ROLES = {
    "Logistics Operations": ["Operations Lead", "Customs Liaison Officer", "Warehouse Supervisor", "Dispatch Coordinator"],
    "Finance & Accounting": ["Chief Financial Officer", "Senior Accountant", "Accounts Payable Officer", "Billing Specialist"],
    "Fleet Management": ["Fleet Manager", "Safety Officer", "Lead Mechanic", "Logistics Driver"],
    "Human Resources": ["HR Director", "Talent Specialist", "Payroll Officer"],
    "Sales & Marketing": ["Commercial Director", "Enterprise Account Manager", "Marketing Lead"],
    "IT & Platform Engineering": ["Principal Systems Architect", "Data Platform Engineer", "DevOps Engineer", "Frontend Specialist"]
}

def random_date(start_year=2024, end_year=2026):
    start = datetime.date(start_year, 1, 1)
    end = datetime.date(end_year, 11, 20)
    delta = end - start
    random_days = random.randint(0, delta.days)
    return start + datetime.timedelta(days=random_days)

def random_phone():
    prefixes = ["024", "054", "055", "020", "050", "027"]
    return f"+233-{random.choice(prefixes)}-{random.randint(1000000, 9999999)}"

def random_ghana_card(idx):
    return f"GHA-{random.randint(100000000, 999999999)}-{random.randint(0, 9)}"

print("=== Starting LuminAI Enterprise Data Generation ===")

# -------------------------------------------------------------
# 1. GENERATE CUSTOMERS
# -------------------------------------------------------------
def generate_customers(n=2000, dirty=True):
    customers = []
    for i in range(1, n + 1):
        fn = random.choice(FIRST_NAMES)
        ln = random.choice(LAST_NAMES)
        reg = random.choice(GHANA_REGIONS)
        city = random.choice(CITIES_BY_REGION.get(reg, ["Accra"]))
        street = f"{random.randint(10, 899)} {random.choice(STREET_NAMES)}"
        
        cid = f"CUST-{i:06d}"
        full_name = f"{fn} {ln}"
        email = f"{fn.lower()}.{ln.lower()}{i % 97}@afrilink-example.com"
        phone = random_phone()
        card = random_ghana_card(i)
        tier = random.choice(CUSTOMER_TIERS)
        credit_limit = round(random.uniform(5000.0, 250000.0), 2)
        created_at = random_date(2024, 2026).isoformat()
        is_active = random.random() > 0.12
        
        # Inject deliberate dirty data if enabled
        if dirty:
            # 5% leading/trailing whitespace in full_name
            if random.random() < 0.05:
                full_name = f"  {full_name}  "
            # 4% erratic casing in full_name
            elif random.random() < 0.04:
                full_name = full_name.upper() if random.random() < 0.5 else full_name.lower()
            
            # 6% missing email (None, empty, or 'N/A')
            if random.random() < 0.06:
                email = random.choice(["", "N/A", "null", ""])
            
            # 4% missing phone
            if random.random() < 0.04:
                phone = ""
                
            # 2% extreme/outlier credit limit
            if random.random() < 0.02:
                credit_limit = -1000.0 if random.random() < 0.3 else 9999999.0
        
        customers.append({
            "customer_id": cid,
            "full_name": full_name,
            "email": email,
            "phone": phone,
            "national_id": card,
            "street_address": street,
            "city": city,
            "region": reg,
            "tier": tier,
            "credit_limit": credit_limit,
            "created_at": created_at,
            "is_active": is_active
        })
    
    # Inject exact duplicates (10 records)
    if dirty and len(customers) > 50:
        for d_idx in range(10):
            dup_target = customers[d_idx * 5]
            customers.append(dict(dup_target))
            
    return customers

# -------------------------------------------------------------
# 2. GENERATE TRANSACTIONS
# -------------------------------------------------------------
def generate_transactions(n=5000, num_customers=2000, dirty=True):
    txns = []
    for i in range(1, n + 1):
        tid = f"TXN-{i:08d}"
        cid = f"CUST-{random.randint(1, num_customers):06d}"
        oid = f"ORD-{random.randint(1, int(n * 0.7)):07d}"
        curr = random.choice(CURRENCIES)
        pm = random.choice(PAYMENT_METHODS)
        
        base_amt = round(random.expovariate(1/1200.0) + 25.0, 2)
        status = random.choices(["COMPLETED", "FAILED", "PENDING", "REVERSED"], weights=[0.88, 0.05, 0.04, 0.03])[0]
        timestamp = f"{random_date(2025, 2026).isoformat()}T{random.randint(0,23):02d}:{random.randint(0,59):02d}:{random.randint(0,59):02d}Z"
        fee = round(base_amt * 0.015, 2)
        
        # Inject deliberate dirty data
        if dirty:
            # 3% negative amounts (refunds / anomalies)
            if random.random() < 0.03:
                base_amt = -abs(base_amt)
            # 1.5% extreme outliers (e.g. 850,000.00)
            elif random.random() < 0.015:
                base_amt = round(random.uniform(500000.0, 950000.0), 2)
            
            # 4% missing payment method
            if random.random() < 0.04:
                pm = random.choice(["UNKNOWN", "", "null"])
                
            # 2% orphan customer_id (not in customer table)
            if random.random() < 0.02:
                cid = f"CUST-999{random.randint(100, 999)}"
        
        txns.append({
            "transaction_id": tid,
            "customer_id": cid,
            "order_id": oid,
            "amount": base_amt,
            "currency": curr,
            "fee": fee,
            "payment_method": pm,
            "status": status,
            "timestamp": timestamp
        })
    return txns

# -------------------------------------------------------------
# 3. GENERATE ORDERS
# -------------------------------------------------------------
def generate_orders(n=3000, num_customers=2000):
    orders = []
    for i in range(1, n + 1):
        oid = f"ORD-{i:07d}"
        cid = f"CUST-{random.randint(1, num_customers):06d}"
        prod = random.choice(PRODUCTS)
        pid, pname, pcat, cost, price = prod
        qty = random.randint(1, 15)
        disc = random.choice([0.0, 0.0, 0.05, 0.10, 0.15])
        total = round(qty * price * (1.0 - disc), 2)
        status = random.choices(["DELIVERED", "IN_TRANSIT", "PENDING", "CANCELLED"], weights=[0.75, 0.15, 0.06, 0.04])[0]
        order_date = random_date(2025, 2026).isoformat()
        
        orders.append({
            "order_id": oid,
            "customer_id": cid,
            "product_id": pid,
            "product_name": pname,
            "category": pcat,
            "quantity": qty,
            "unit_price": price,
            "discount_rate": disc,
            "total_amount": total,
            "status": status,
            "order_date": order_date
        })
    return orders

# -------------------------------------------------------------
# 4. GENERATE EMPLOYEES
# -------------------------------------------------------------
def generate_employees(n=250):
    employees = []
    for i in range(1, n + 1):
        fn = random.choice(FIRST_NAMES)
        ln = random.choice(LAST_NAMES)
        dept = random.choice(DEPARTMENTS)
        role = random.choice(ROLES[dept])
        sal = round(random.uniform(4500.0, 48000.0), 2)
        hire = random_date(2021, 2025).isoformat()
        mgr_id = f"EMP-{random.randint(1, max(1, i-1)):04d}" if i > 1 else ""
        
        employees.append({
            "employee_id": f"EMP-{i:04d}",
            "full_name": f"{fn} {ln}",
            "email": f"{fn.lower()}.{ln.lower()}{i}@afrilink.com.gh",
            "department": dept,
            "role": role,
            "monthly_salary_ghs": sal,
            "hire_date": hire,
            "manager_id": mgr_id
        })
    return employees

# -------------------------------------------------------------
# 5. GENERATE SUPPLIERS (XML TARGET)
# -------------------------------------------------------------
def generate_suppliers(n=150):
    suppliers = []
    countries = ["Ghana", "Nigeria", "Côte d'Ivoire", "Kenya", "South Africa", "United Kingdom", "China"]
    for i in range(1, n + 1):
        cname = f"Afrilink Supply Partner {i} Ltd."
        contact = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
        country = random.choice(countries)
        rating = round(random.uniform(3.2, 5.0), 1)
        terms = random.choice(["Net 30", "Net 45", "Net 60", "Immediate Advance"])
        
        suppliers.append({
            "supplier_id": f"SUP-{i:04d}",
            "company_name": cname,
            "contact_person": contact,
            "country": country,
            "performance_rating": rating,
            "payment_terms": terms
        })
    return suppliers

# -------------------------------------------------------------
# 6. WRITE FILES
# -------------------------------------------------------------
import csv

def write_csv(filepath, data, delimiter=","):
    if not data:
        return
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(data[0].keys()), delimiter=delimiter)
        writer.writeheader()
        writer.writerows(data)
    print(f"  [+] Wrote {len(data)} rows to {filepath.name}")

def write_tsv(filepath, data):
    write_csv(filepath, data, delimiter="\t")

def write_json(filepath, data):
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"  [+] Wrote {len(data)} JSON objects to {filepath.name}")

def write_jsonl(filepath, data):
    with open(filepath, "w", encoding="utf-8") as f:
        for row in data:
            f.write(json.dumps(row) + "\n")
    print(f"  [+] Wrote {len(data)} JSONL lines to {filepath.name}")

def write_xml_suppliers(filepath, suppliers):
    with open(filepath, "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<suppliers>\n')
        for s in suppliers:
            f.write('  <supplier id="{}">\n'.format(s["supplier_id"]))
            f.write('    <company_name>{}</company_name>\n'.format(s["company_name"]))
            f.write('    <contact_person>{}</contact_person>\n'.format(s["contact_person"]))
            f.write('    <country>{}</country>\n'.format(s["country"]))
            f.write('    <rating>{}</rating>\n'.format(s["performance_rating"]))
            f.write('    <payment_terms>{}</payment_terms>\n'.format(s["payment_terms"]))
            f.write('  </supplier>\n')
        f.write('</suppliers>\n')
    print(f"  [+] Wrote {len(suppliers)} XML elements to {filepath.name}")

def write_xlsx(filepath, data, sheet_name="Sheet1"):
    try:
        import openpyxl
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = sheet_name
        if data:
            headers = list(data[0].keys())
            ws.append(headers)
            for row in data:
                ws.append([row[h] for h in headers])
        wb.save(filepath)
        print(f"  [+] Wrote {len(data)} Excel rows to {filepath.name}")
    except ImportError:
        # Fallback to CSV if openpyxl not installed
        write_csv(filepath.with_suffix(".csv"), data)

def write_parquet(filepath, data):
    import polars as pl
    df = pl.DataFrame(data)
    df.write_parquet(filepath, compression="snappy")
    print(f"  [+] Wrote {len(data)} Parquet records to {filepath.name}")

# --- Generate Small Tier ---
print("\n--- Generating Small Tier Datasets (Functional UI & Rapid Verification) ---")
cust_small = generate_customers(n=2000, dirty=True)
write_csv(SMALL_DIR / "customers_small.csv", cust_small)

txn_small = generate_transactions(n=5000, num_customers=2000, dirty=True)
write_csv(SMALL_DIR / "transactions_small.csv", txn_small)

orders_small = generate_orders(n=3000, num_customers=2000)
write_tsv(SMALL_DIR / "orders_small.tsv", orders_small)

prods_data = [{"product_id": p[0], "sku": p[0], "name": p[1], "category": p[2], "cost_price": p[3], "selling_price": p[4]} for p in PRODUCTS]
write_json(SMALL_DIR / "products_small.json", prods_data)

inv_data = []
for p in PRODUCTS:
    for wh in ["WH-ACC-01", "WH-KMS-01", "WH-TKD-01", "WH-TML-01"]:
        inv_data.append({
            "warehouse_id": wh,
            "product_id": p[0],
            "quantity_on_hand": random.randint(20, 500),
            "reorder_point": random.randint(30, 80),
            "last_restocked": random_date(2025, 2026).isoformat()
        })
write_jsonl(SMALL_DIR / "inventory_small.jsonl", inv_data)

emp_small = generate_employees(n=250)
write_xlsx(SMALL_DIR / "employees_small.xlsx", emp_small, sheet_name="Afrilink Staff")

sup_small = generate_suppliers(n=150)
write_xml_suppliers(SMALL_DIR / "suppliers_small.xml", sup_small)

# --- Generate Medium Tier ---
print("\n--- Generating Medium Tier Datasets (Analytics, ML & Profiling) ---")
cust_medium = generate_customers(n=25000, dirty=True)
write_csv(MEDIUM_DIR / "customers_medium.csv", cust_medium)

txn_medium = generate_transactions(n=50000, num_customers=25000, dirty=True)
write_parquet(MEDIUM_DIR / "transactions_medium.parquet", txn_medium)

orders_medium = generate_orders(n=35000, num_customers=25000)
write_csv(MEDIUM_DIR / "orders_medium.csv", orders_medium)

# Support Tickets for NLP/Analytics
tickets = []
for i in range(1, 15001):
    tickets.append({
        "ticket_id": f"TCK-{i:06d}",
        "customer_id": f"CUST-{random.randint(1, 25000):06d}",
        "category": random.choice(["Delivery Delay", "Billing Discrepancy", "Damaged Cargo", "Customs Hold", "General Inquiry"]),
        "priority": random.choice(["LOW", "MEDIUM", "HIGH", "URGENT"]),
        "resolution_hours": round(random.expovariate(1/18.0) + 1.0, 1),
        "satisfaction_score": random.choice([1, 2, 3, 4, 5, 5, 4]),
        "channel": random.choice(["Phone", "Email", "WhatsApp", "Portal"]),
        "created_at": f"{random_date(2025, 2026).isoformat()}T10:00:00Z"
    })
write_jsonl(MEDIUM_DIR / "support_tickets_medium.jsonl", tickets)

# Marketing campaigns
campaigns = []
for i in range(1, 1001):
    campaigns.append({
        "campaign_id": f"CMP-{i:04d}",
        "campaign_name": f"Afrilink Growth Drive {i}",
        "channel": random.choice(["Google Ads", "LinkedIn B2B", "Radio Kumasi", "Joy FM Accra", "Billboard Tema Harbour"]),
        "budget_ghs": round(random.uniform(5000.0, 150000.0), 2),
        "spend_ghs": round(random.uniform(4000.0, 148000.0), 2),
        "impressions": random.randint(10000, 2000000),
        "conversions": random.randint(50, 4500),
        "start_date": random_date(2025, 2026).isoformat()
    })
write_csv(MEDIUM_DIR / "marketing_campaigns_medium.csv", campaigns)

# --- Generate Large / Stress Tier ---
print("\n--- Generating Large Tier (Partitioned CSVs & Stress Testing) ---")
# Partitioned transactions (2 x 50k rows = 100k rows)
txn_l1 = generate_transactions(n=50000, num_customers=25000, dirty=False)
write_csv(LARGE_DIR / "transactions_stress_part1.csv", txn_l1)
txn_l2 = generate_transactions(n=50000, num_customers=25000, dirty=False)
write_csv(LARGE_DIR / "transactions_stress_part2.csv", txn_l2)

# Parquet 100k operational events
events = []
for i in range(1, 100001):
    events.append({
        "event_id": f"EVT-{i:08d}",
        "source_facility": random.choice(["Tema Port Terminal 3", "Kotoka Airport Cargo Hub", "Kumasi Depot", "Takoradi Harbour Yard"]),
        "event_type": random.choice(["GATE_IN", "GATE_OUT", "CUSTOMS_CLEARED", "CONTAINER_SCANNED", "LOADED_TRUCK", "OFFLOADED"]),
        "sensor_temp_celsius": round(random.uniform(-18.0, 32.0), 2),
        "fuel_level_pct": round(random.uniform(10.0, 100.0), 1),
        "timestamp": f"{random_date(2025, 2026).isoformat()}T{random.randint(0,23):02d}:{random.randint(0,59):02d}:{random.randint(0,59):02d}Z"
    })
write_parquet(LARGE_DIR / "operational_events_stress.parquet", events)

# --- Generate Specialized Edge-Cases ---
print("\n--- Generating Edge-Cases, Boundary & Malformed Datasets ---")

# 1. Identifier Preservation (Leading zeros, Alphanumerics, Ghana Card)
leading_zeros_data = [
    {"record_id": f"{i:08d}", "national_tin": f"0000{i:05d}", "branch_code": f"0{random.randint(10, 99)}", "account_ref": f"000{random.randint(100, 999)}"}
    for i in range(1, 501)
]
write_csv(EDGE_DIR / "identifiers_leading_zeros.csv", leading_zeros_data)

# 2. Extreme Outliers and Null Values
extreme_data = [
    {"id": 1, "metric_name": "Standard Value", "amount": 100.50, "ratio": 0.5, "note": "Normal baseline"},
    {"id": 2, "metric_name": "Extreme High", "amount": 999999999.99, "ratio": 10000.0, "note": "Huge positive outlier"},
    {"id": 3, "metric_name": "Extreme Negative", "amount": -850000.00, "ratio": -99.9, "note": "Negative anomaly"},
    {"id": 4, "metric_name": "Zero Value", "amount": 0.00, "ratio": 0.0, "note": "Zero denominator test"},
    {"id": 5, "metric_name": "Whitespace Note", "amount": 50.00, "ratio": 0.25, "note": "   Leading and trailing spaces   "},
    {"id": 6, "metric_name": "Missing Note", "amount": 25.00, "ratio": 0.1, "note": ""},
    {"id": 7, "metric_name": "Null Ratio", "amount": 75.00, "ratio": None, "note": "Explicit None value"},
    {"id": 8, "metric_name": "Special Chars", "amount": 12.34, "ratio": 0.99, "note": "<script>alert('xss')</script> & Ghana Cedis GH₵"}
]
write_csv(EDGE_DIR / "extreme_values_outliers.csv", extreme_data)

# 3. Quoted Newlines and Multilingual Unicode (Twi, French, Emojis)
quoted_newlines_data = [
    {"row_id": 1, "title": "Standard Item", "description": "Single line item for testing."},
    {"row_id": 2, "title": "Multi-line Item", "description": "Line 1 of description\nLine 2 with break\nLine 3 finalized."},
    {"row_id": 3, "title": "Quoted Content", "description": 'He said "Urgent shipment from Tema" immediately.'},
    {"row_id": 4, "title": "Ghanaian Twi & Emojis", "description": "Akwaaba! Ɛyɛ fɛ papaapa! 🇬🇭📦🚚 Fast delivery."},
    {"row_id": 5, "title": "French African Route", "description": "Expédition de cacao vers Abidjan & San-Pédro en Côte d'Ivoire."}
]
write_csv(EDGE_DIR / "quoted_newlines_unicode.csv", quoted_newlines_data)

# 4. Entity Resolution & Deduplication Fuzzy Match Pairs
fuzzy_er_pairs = [
    # Pair 1: Exact name, transposed phone
    {"entity_id": "ER-001", "name": "Kwesi Mensah", "phone": "+233-24-4123456", "city": "Accra", "region": "Greater Accra", "pair_id": "P1"},
    {"entity_id": "ER-002", "name": "Kwesi Mensah", "phone": "+233-24-4123465", "city": "Accra", "region": "Greater Accra", "pair_id": "P1"},
    
    # Pair 2: Middle initial, slightly different address
    {"entity_id": "ER-003", "name": "Ama Serwaa", "phone": "+233-20-8991122", "city": "Kumasi", "region": "Ashanti", "pair_id": "P2"},
    {"entity_id": "ER-004", "name": "Ama K. Serwaa", "phone": "+233-20-8991122", "city": "Kumasi", "region": "Ashanti", "pair_id": "P2"},
    
    # Pair 3: Typo / phonetic spelling
    {"entity_id": "ER-005", "name": "Kofi Boateng", "phone": "+233-54-3322110", "city": "Takoradi", "region": "Western", "pair_id": "P3"},
    {"entity_id": "ER-006", "name": "Koffi Boaten", "phone": "+233-54-3322110", "city": "Takoradi", "region": "Western", "pair_id": "P3"},
    
    # Pair 4: Case variance & whitespace
    {"entity_id": "ER-007", "name": "FATIMA BELLO", "phone": "+233-27-7788990", "city": "Tamale", "region": "Northern", "pair_id": "P4"},
    {"entity_id": "ER-008", "name": "  fatima bello  ", "phone": "+233-27-7788990", "city": "Tamale", "region": "Northern", "pair_id": "P4"},
    
    # Non-match controls
    {"entity_id": "ER-009", "name": "Yaw Dzogbe", "phone": "+233-24-9988776", "city": "Ho", "region": "Volta", "pair_id": "P5"},
    {"entity_id": "ER-010", "name": "Peter Anang", "phone": "+233-24-1122334", "city": "Tema", "region": "Greater Accra", "pair_id": "P6"}
]
write_csv(EDGE_DIR / "fuzzy_duplicates_er.csv", fuzzy_er_pairs)

# 5. Schema Evolution V1, V2, V3
v1_data = [{"customer_id": f"EVO-{i:03d}", "name": f"Customer {i}", "email": f"cust{i}@test.com"} for i in range(1, 51)]
write_csv(EDGE_DIR / "schema_evolution_v1.csv", v1_data)

v2_data = [{"customer_id": f"EVO-{i:03d}", "name": f"Customer {i}", "email": f"cust{i}@test.com", "loyalty_tier": "Gold" if i % 2 == 0 else "Silver", "signup_date": "2025-01-01"} for i in range(1, 51)]
write_csv(EDGE_DIR / "schema_evolution_v2.csv", v2_data)

v3_data = [{"customer_id": f"EVO-{i:03d}", "name": f"Customer {i}", "email": f"cust{i}@test.com", "loyalty_tier": 5 if i % 2 == 0 else 3, "signup_timestamp": "2025-01-01T08:30:00Z", "risk_score": 0.15} for i in range(1, 51)]
write_csv(EDGE_DIR / "schema_evolution_v3.csv", v3_data)

# 6. Malformed & Boundary Files
# Empty file (0 bytes)
(EDGE_DIR / "empty_file.csv").write_text("", encoding="utf-8")
print("  [+] Created 0-byte file: empty_file.csv")

# Header-only file (0 data rows)
(EDGE_DIR / "header_only.csv").write_text("customer_id,full_name,email,created_at\n", encoding="utf-8")
print("  [+] Created header-only file: header_only.csv")

# Malformed CSV (jagged columns and unclosed quotes)
malformed_csv_content = """id,name,value
1,Item One,100
2,"Unclosed quote item,200
3,Jagged,Row,Extra,Columns,Here,999
4,Item Four,400
"""
(EDGE_DIR / "malformed_jagged.csv").write_text(malformed_csv_content, encoding="utf-8")
print("  [+] Created malformed jagged CSV: malformed_jagged.csv")

# Invalid JSON
(EDGE_DIR / "malformed_syntax.json").write_text('{"status": "broken", "items": [1, 2, 3, ]}', encoding="utf-8")
print("  [+] Created invalid syntax JSON: malformed_syntax.json")

print("\n=== All Synthetic Datasets Successfully Generated! ===")
