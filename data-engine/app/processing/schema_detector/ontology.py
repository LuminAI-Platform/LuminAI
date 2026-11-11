"""LuminAI Standard Ontology Property Registry for entity resolution and type matching."""

from __future__ import annotations

from typing import Any, Dict

from app.processing.schema_detector.models import ColumnType

ONTOLOGY_REGISTRY: Dict[str, Dict[str, Dict[str, Any]]] = {
    "Person": {
        "id": {
            "aliases": [
                "id",
                "rec_id",
                "user_id",
                "person_id",
                "uuid",
                "uid",
                "customer_id",
            ],
            "expected_type": ColumnType.STRING,
        },
        "name": {
            "aliases": [
                "name",
                "full_name",
                "first_name",
                "last_name",
                "contact_name",
                "username",
                "customer_name",
            ],
            "expected_type": ColumnType.STRING,
        },
        "email": {
            "aliases": ["email", "e_mail", "email_address", "contact_email", "mail"],
            "expected_type": ColumnType.EMAIL,
        },
        "phone": {
            "aliases": [
                "phone",
                "telephone",
                "mobile",
                "cell",
                "phone_number",
                "contact_phone",
                "tel",
            ],
            "expected_type": ColumnType.PHONE,
        },
        "age": {
            "aliases": ["age", "years_old", "dob_years", "age_years"],
            "expected_type": ColumnType.NUMBER,
        },
        "country": {
            "aliases": [
                "country",
                "nation",
                "country_code",
                "location_country",
                "nationality",
                "residence",
            ],
            "expected_type": ColumnType.STRING,
        },
        "joined_at": {
            "aliases": [
                "joined_at",
                "created_at",
                "signup_date",
                "registered_at",
                "registration_date",
                "start_date",
            ],
            "expected_type": ColumnType.DATE,
        },
        "score": {
            "aliases": ["score", "confidence", "rating", "rank", "credit_score"],
            "expected_type": ColumnType.NUMBER,
        },
        "salary": {
            "aliases": ["salary", "income", "compensation", "earnings", "wage", "pay"],
            "expected_type": ColumnType.NUMBER,
        },
    },
    "Organization": {
        "id": {
            "aliases": ["id", "org_id", "company_id", "business_id"],
            "expected_type": ColumnType.STRING,
        },
        "name": {
            "aliases": [
                "name",
                "org_name",
                "company_name",
                "business_name",
                "firm_name",
            ],
            "expected_type": ColumnType.STRING,
        },
        "industry": {
            "aliases": ["industry", "sector", "business_sector", "domain"],
            "expected_type": ColumnType.STRING,
        },
        "employee_count": {
            "aliases": [
                "employee_count",
                "employees",
                "size",
                "headcount",
                "staff",
                "num_employees",
            ],
            "expected_type": ColumnType.NUMBER,
        },
        "country": {
            "aliases": ["country", "hq_country", "location", "headquarters"],
            "expected_type": ColumnType.STRING,
        },
        "website": {
            "aliases": ["website", "url", "domain", "web_address", "homepage"],
            "expected_type": ColumnType.STRING,
        },
    },
    "Product": {
        "id": {
            "aliases": ["id", "product_id", "sku", "item_id", "code"],
            "expected_type": ColumnType.STRING,
        },
        "name": {
            "aliases": ["name", "product_name", "title", "item_name"],
            "expected_type": ColumnType.STRING,
        },
        "price": {
            "aliases": ["price", "cost", "amount", "unit_price", "retail_price"],
            "expected_type": ColumnType.NUMBER,
        },
        "stock_quantity": {
            "aliases": [
                "stock_quantity",
                "stock",
                "quantity",
                "inventory",
                "inventory_count",
                "qty",
            ],
            "expected_type": ColumnType.NUMBER,
        },
        "category": {
            "aliases": ["category", "product_type", "department", "genre"],
            "expected_type": ColumnType.STRING,
        },
    },
    "Transaction": {
        "id": {
            "aliases": ["id", "transaction_id", "tx_id", "payment_id", "order_id"],
            "expected_type": ColumnType.STRING,
        },
        "amount": {
            "aliases": ["amount", "total", "total_amount", "sum", "value", "price"],
            "expected_type": ColumnType.NUMBER,
        },
        "timestamp": {
            "aliases": [
                "timestamp",
                "tx_date",
                "date",
                "created_at",
                "transacted_at",
                "transaction_date",
            ],
            "expected_type": ColumnType.DATE,
        },
        "user_id": {
            "aliases": ["user_id", "customer_id", "buyer_id", "payer_id", "account_id"],
            "expected_type": ColumnType.STRING,
        },
        "status": {
            "aliases": [
                "status",
                "tx_status",
                "payment_status",
                "state",
                "order_status",
            ],
            "expected_type": ColumnType.STRING,
        },
    },
}
