"""Production-Grade Dirty Dataset Generator for LuminAI Data Engine.

Generates realistic enterprise datasets with controlled dirty anomalies:
  - Phonetic typos & nicknames (Robert/Bob, Elizabeth/Beth, Smith/Smyth)
  - Multi-source duplicates across CRM, Billing, and HR
  - Mixed unicode whitespace, casing chaos, and accents
  - Chaotic multi-format timestamps (ISO, European, US, Unix)
  - International currency formats with symbols, spaces, and commas
  - Controlled null ratios and adversarial formula injection strings
"""

from __future__ import annotations

import argparse
import csv
import os
import random
import sys
from datetime import datetime, timedelta, timezone

# Multi-source names and real-world nickname/phonetic variations
FIRST_NAMES = [
    ("Robert", ["Bob", "Bobby", "Rob", "Robbie"]),
    ("Elizabeth", ["Beth", "Liz", "Lizzie", "Eliza"]),
    ("William", ["Bill", "Billy", "Will", "Liam"]),
    ("Alexander", ["Alex", "Alec", "Sasha"]),
    ("Katherine", ["Kate", "Katie", "Kathy", "Cat"]),
    ("Richard", ["Dick", "Rick", "Richie"]),
    ("Margaret", ["Maggie", "Meg", "Peggy"]),
    ("James", ["Jim", "Jimmy", "Jamie"]),
    ("Charles", ["Charlie", "Chuck"]),
    ("Alice", ["Alyce", "Alicia"]),
    ("David", ["Dave", "Davey"]),
    ("Michael", ["Mike", "Mikey"]),
    ("Sarah", ["Sara"]),
    ("John", ["Jon", "Johnny"]),
]

LAST_NAMES = [
    ("Smith", ["Smyth", "Smythe", "Smithh"]),
    ("Johnson", ["Johnsen", "Jonson"]),
    ("Williams", ["Williamson"]),
    ("Brown", ["Browne"]),
    ("Davis", ["Davies"]),
    ("Miller", ["Mueller", "Muller"]),
    ("Wilson", ["Willson"]),
    ("Taylor", ["Tayler"]),
    ("Anderson", ["Andersen"]),
    ("Thomas", ["Tomas"]),
]

COUNTRIES = ["US", "UK", "CA", "DE", "FR", "AU", "ZA", "NG", "JP", "IN"]
SOURCES = ["salesforce_crm", "stripe_billing", "workday_hr", "zendesk_support", "hubspot"]

CURRENCY_TEMPLATES = [
    "${amount:,.2f}",
    "€{amount:,.2f}",
    "£{amount:,.2f}",
    "¥{amount:,.0f}",
    "{amount:.2f} USD",
    "  ${amount:.2f}  ",
    "{amount:.0f}",
]

DATE_FORMATS = [
    "%Y-%m-%d",
    "%d/%m/%Y",
    "%m/%d/%Y",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%SZ",
    "%d-%m-%Y",
]


def introduce_noise(text: str, noise_prob: float = 0.2) -> str:
    """Introduce realistic casing, whitespace, and character noise."""
    if not text or random.random() > noise_prob:
        return text

    variant = random.choice(["casing", "whitespace", "accent"])
    if variant == "casing":
        if random.random() < 0.5:
            return text.lower()
        elif random.random() < 0.8:
            return text.upper()
        else:
            return "".join(c.upper() if i % 2 == 0 else c.lower() for i, c in enumerate(text))
    elif variant == "whitespace":
        prefix = " " * random.randint(1, 3)
        suffix = " " * random.randint(1, 3)
        return f"{prefix}{text}{suffix}"
    elif variant == "accent":
        return text.replace("e", "é").replace("a", "á").replace("o", "ó")
    return text


def generate_messy_dataset(
    num_entities: int = 5000,
    duplicate_ratio: float = 0.35,
    output_path: str = "messy_production_data.csv",
) -> int:
    """Generate a production-grade CSV file with duplicates, typos, and format inconsistencies."""
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    rows: list[dict[str, str]] = []
    base_date = datetime(2024, 1, 1, tzinfo=timezone.utc)

    print(f"Generating ~{num_entities} distinct entities with {duplicate_ratio:.0%} duplicate cluster rate...")

    record_counter = 1
    for entity_idx in range(1, num_entities + 1):
        # Pick canonical entity details
        fname_canon, fname_variants = random.choice(FIRST_NAMES)
        lname_canon, lname_variants = random.choice(LAST_NAMES)
        country_canon = random.choice(COUNTRIES)
        domain = random.choice(["acme.com", "global.org", "enterprise.co", "tech.io"])
        email_base = f"{fname_canon.lower()}.{lname_canon.lower()}@{domain}"
        dob_dt = datetime(random.randint(1960, 2003), random.randint(1, 12), random.randint(1, 28))
        base_salary = float(random.randint(35000, 180000))

        # Decide cluster size (1 = single record, 2-4 = duplicates across systems)
        if random.random() < duplicate_ratio:
            cluster_size = random.randint(2, 4)
        else:
            cluster_size = 1

        for copy_idx in range(cluster_size):
            source = random.choice(SOURCES)
            rec_id = f"{source[:4]}-{entity_idx:06d}-{copy_idx+1}"

            # Name variations
            if copy_idx == 0:
                first_name = fname_canon
                last_name = lname_canon
            else:
                first_name = random.choice([fname_canon] + fname_variants)
                last_name = random.choice([lname_canon] + lname_variants)

            full_name = introduce_noise(f"{first_name} {last_name}", noise_prob=0.3)

            # Email variations
            if copy_idx == 0:
                email = email_base
            else:
                if random.random() < 0.6:
                    email = email_base
                else:
                    # Alternative corporate email
                    email = f"{first_name[0].lower()}{last_name.lower()}@{domain}"
            email = introduce_noise(email, noise_prob=0.25)

            # Country variation
            if random.random() < 0.05:
                country = ""
            elif random.random() < 0.3:
                country = country_canon.lower()
            else:
                country = country_canon

            # Date variation
            updated_dt = base_date + timedelta(days=random.randint(1, 300), hours=random.randint(1, 23))
            fmt = random.choice(DATE_FORMATS)
            updated_at_str = updated_dt.strftime(fmt)

            # Salary variation
            salary_val = base_salary + (copy_idx * random.randint(1000, 5000))
            if random.random() < 0.05:
                salary_str = ""
            elif random.random() < 0.02:
                salary_str = "invalid-salary"
            else:
                curr_tpl = random.choice(CURRENCY_TEMPLATES)
                salary_str = curr_tpl.format(amount=salary_val)

            # Age
            age_val = (datetime.now().year - dob_dt.year)
            age_str = str(age_val) if random.random() > 0.1 else ""

            # Adversarial CSV formula injection (1 in 500 records)
            if random.random() < 0.002:
                full_name = f"=SUM(1+1)-{full_name}"

            rows.append({
                "id": rec_id,
                "source_id": source,
                "name": full_name,
                "email": email,
                "country": country,
                "entity_type": "Person",
                "salary": salary_str,
                "joined_at": updated_at_str,
                "age": age_str,
            })
            record_counter += 1

    # Shuffle records so duplicates aren't directly adjacent
    random.shuffle(rows)

    fieldnames = ["id", "source_id", "name", "email", "country", "entity_type", "salary", "joined_at", "age"]
    with open(output_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"Generated {len(rows)} records into '{output_path}' ({file_size_mb:.2f} MB)")
    return len(rows)


def main():
    parser = argparse.ArgumentParser(description="Generate Production-Grade Dirty Test Data for LuminAI Data Engine")
    parser.add_argument("--entities", type=int, default=10000, help="Number of distinct entities to simulate (Default: 10,000)")
    parser.add_argument("--dup-rate", type=float, default=0.35, help="Duplicate clustering probability (Default: 0.35)")
    parser.add_argument("--out", type=str, default="storage/test_datasets/production_dirty_50k.csv", help="Output CSV path")
    args = parser.parse_args()

    generate_messy_dataset(
        num_entities=args.entities,
        duplicate_ratio=args.dup_rate,
        output_path=args.out,
    )


if __name__ == "__main__":
    main()
