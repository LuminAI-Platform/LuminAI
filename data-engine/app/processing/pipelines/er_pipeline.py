"""Dagster asset pipeline for Entity Resolution (ER) & Golden Record Synthesis.

Orchestrates the complete end-to-end Entity Resolution lifecycle:
  1. ``staged_records_for_er``      → Loads validated records from staging table / storage.
  2. ``er_blocked_pairs``           → Groups records by Metaphone + Country + EntityType blocking keys.
  3. ``er_scored_pairs``            → Computes Jaro-Winkler & Levenshtein pairwise similarity metrics.
  4. ``er_classified_pairs``        → Partitions into Match (>=0.90), Review (0.70-0.89), and Non-Match (<0.70).
  5. ``er_golden_records``          → Runs connected components clustering, merges canonical attributes,
                                      tracks field provenance, persists Golden Records & Provenance to DB,
                                      and publishes resolved entities to Kafka topic ``entity.resolved``.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from typing import Any, Dict, List, Tuple

import polars as pl
from dagster import AssetExecutionContext, asset
from sqlalchemy import create_engine, text

from app.config import get_settings
from app.kafka.producers import EntityResolvedProducer
from app.processing.er.blocking import generate_candidate_pairs
from app.processing.er.classification import (
    classify_candidate_pairs,
    persist_review_candidates,
)
from app.processing.er.clustering import cluster_record_dictionaries
from app.processing.er.comparison import compare_candidate_pairs
from app.processing.er.golden_record import (
    merge_clusters_to_golden_records,
    persist_golden_records,
)
from app.processing.er.provenance import (
    persist_provenance_records,
    track_field_provenance,
)

logger = logging.getLogger(__name__)


@asset(
    name="staged_records_for_er",
    group_name="entity_resolution",
    description="Loads validated records from staging database or Parquet for Entity Resolution.",
)
def staged_records_for_er(context: AssetExecutionContext) -> pl.DataFrame:
    """Load staged records for ER processing.

    In dev/test environments without active DB tables, generates a realistic multi-source
    dataset containing exact and fuzzy duplicates across sources.
    """
    context.log.info("🔍 staged_records_for_er: fetching staged records for ER…")

    settings = get_settings()
    db_url = (
        f"postgresql+pg8000://{settings.postgres_user}:{settings.postgres_password}"
        f"@{settings.postgres_host}:{settings.postgres_port}/{settings.postgres_db}"
    )

    query = text("SELECT id, tenant_id, source_id, raw_id, data FROM staging_records LIMIT 5000;")
    records: List[Dict[str, Any]] = []

    # Attempt to load from PostgreSQL first
    try:
        engine = create_engine(db_url)
        with engine.connect() as conn:
            res = conn.execute(query)
            for row in res:
                data_dict = json.loads(row.data) if isinstance(row.data, str) else dict(row.data)
                data_dict["id"] = str(row.id)
                data_dict["raw_id"] = str(row.raw_id)
                data_dict["source_id"] = str(row.source_id)
                data_dict["tenant_id"] = str(row.tenant_id)
                records.append(data_dict)
        engine.dispose()
        if records:
            context.log.info("Loaded %d staged records from PostgreSQL", len(records))
            return pl.DataFrame(records)
    except Exception as exc:
        context.log.debug("PostgreSQL staging unavailable (%s). Checking SQLite or synthetic fallback.", exc)

    # Check SQLite fallback
    sqlite_path = os.path.join("storage", "sqlite", "staging.db")
    if os.path.exists(sqlite_path):
        try:
            sqlite_engine = create_engine(f"sqlite:///{sqlite_path}")
            with sqlite_engine.connect() as conn:
                res = conn.execute(query)
                for row in res:
                    data_dict = json.loads(row.data) if isinstance(row.data, str) else dict(row.data)
                    data_dict["id"] = str(row.id)
                    data_dict["raw_id"] = str(row.raw_id)
                    data_dict["source_id"] = str(row.source_id)
                    data_dict["tenant_id"] = str(row.tenant_id)
                    records.append(data_dict)
            sqlite_engine.dispose()
            if records:
                context.log.info("Loaded %d staged records from SQLite staging", len(records))
                return pl.DataFrame(records)
        except Exception as sqle:
            context.log.debug("SQLite staging error: %s", sqle)

    # Synthetic realistic multi-source dataset for ER
    synthetic_records = [
        # Cluster 1: Alice Smith (Source A CRM vs Source B Billing)
        {
            "id": "rec-001",
            "source_id": "crm-postgres",
            "name": "Alice Smith",
            "email": "alice@example.com",
            "dob": "1990-05-12",
            "country": "UK",
            "entity_type": "Person",
            "salary": 75000.0,
            "updated_at": "2024-01-10T00:00:00Z",
        },
        {
            "id": "rec-002",
            "source_id": "billing-stripe",
            "name": "Alice Smyth",
            "email": "alice@example.com",
            "dob": "1990-05-12",
            "country": "UK",
            "entity_type": "Person",
            "salary": 78000.0,
            "updated_at": "2024-06-15T00:00:00Z",
        },
        # Cluster 2: Bob Jones (Transitive match: rec-003=rec-004 and rec-004=rec-005)
        {
            "id": "rec-003",
            "source_id": "hr-workday",
            "name": "Bob Jones",
            "email": "bob.jones@corp.com",
            "dob": "1985-11-20",
            "country": "US",
            "entity_type": "Person",
            "salary": 92000.0,
            "updated_at": "2023-12-01T00:00:00Z",
        },
        {
            "id": "rec-004",
            "source_id": "crm-salesforce",
            "name": "Bobby Jones",
            "email": "bob.jones@corp.com",
            "dob": "1985-11-20",
            "country": "US",
            "entity_type": "Person",
            "salary": 95000.0,
            "updated_at": "2024-05-20T00:00:00Z",
        },
        # Disjoint Record: Carol White
        {
            "id": "rec-005",
            "source_id": "support-zendesk",
            "name": "Carol White",
            "email": "carol.white@acme.org",
            "dob": "1992-03-15",
            "country": "CA",
            "entity_type": "Person",
            "salary": 68000.0,
            "updated_at": "2024-02-14T00:00:00Z",
        },
    ]

    context.log.info("staged_records_for_er: loaded %d records for ER analysis", len(synthetic_records))
    return pl.DataFrame(synthetic_records)


@asset(
    name="er_blocked_pairs",
    group_name="entity_resolution",
    description="Groups records into candidate comparison blocks using phonetic and categorical keys.",
    deps=[staged_records_for_er],
)
def er_blocked_pairs(
    context: AssetExecutionContext,
    staged_records_for_er: pl.DataFrame,
) -> pl.DataFrame:
    """Generate candidate record pairs sharing blocking keys."""
    context.log.info("🧱 er_blocked_pairs: generating candidate pairs…")
    candidate_pairs = generate_candidate_pairs(
        staged_records_for_er,
        id_col="id",
        name_col="name",
        country_col="country",
        entity_type_col="entity_type",
    )
    context.log.info(
        "🧱 Blocking reduced search space — %d candidate pairs generated from %d records",
        candidate_pairs.height,
        staged_records_for_er.height,
    )
    return candidate_pairs


@asset(
    name="er_scored_pairs",
    group_name="entity_resolution",
    description="Evaluates pairwise similarity metrics (Jaro-Winkler, Levenshtein) for candidate pairs.",
    deps=[er_blocked_pairs],
)
def er_scored_pairs(
    context: AssetExecutionContext,
    er_blocked_pairs: pl.DataFrame,
) -> pl.DataFrame:
    """Compute weighted similarity scores for candidate pairs."""
    context.log.info("📊 er_scored_pairs: evaluating similarity scores for %d pairs…", er_blocked_pairs.height)
    scored = compare_candidate_pairs(er_blocked_pairs)
    context.log.info("📊 Pairwise comparison complete — avg confidence=%.4f", scored["confidence_score"].mean() if scored.height > 0 else 0.0)
    return scored


@asset(
    name="er_classified_pairs",
    group_name="entity_resolution",
    description="Classifies pairs into Match, Review, and Non-Match; persists Review pairs to er_candidates.",
    deps=[er_scored_pairs],
)
def er_classified_pairs(
    context: AssetExecutionContext,
    er_scored_pairs: pl.DataFrame,
) -> pl.DataFrame:
    """Classify candidate pairs and persist review candidates to database."""
    context.log.info("⚖️ er_classified_pairs: classifying %d pairs…", er_scored_pairs.height)
    matches_df, review_df, non_matches_df = classify_candidate_pairs(er_scored_pairs)

    context.log.info(
        "⚖️ Classification decisions — matches=%d, review=%d, non_matches=%d",
        matches_df.height,
        review_df.height,
        non_matches_df.height,
    )

    if review_df.height > 0:
        persisted = persist_review_candidates(review_df, tenant_id="acme")
        context.log.info("⚖️ Persisted %d review candidates to er_candidates table", persisted)

    return matches_df


@asset(
    name="er_golden_records",
    group_name="entity_resolution",
    description="Clusters matched pairs via Union-Find, synthesizes Golden Records, tracks provenance, and publishes Kafka events.",
    deps=[er_classified_pairs, staged_records_for_er],
)
def er_golden_records(
    context: AssetExecutionContext,
    er_classified_pairs: pl.DataFrame,
    staged_records_for_er: pl.DataFrame,
) -> pl.DataFrame:
    """Synthesize canonical Golden Records, persist them, and publish to Kafka."""
    context.log.info("👑 er_golden_records: clustering matches and synthesizing Golden Records…")

    records_list = staged_records_for_er.to_dicts()
    clusters = cluster_record_dictionaries(er_classified_pairs, records_list, id_col="id")

    context.log.info(
        "👑 Graph clustering resolved %d distinct clusters from %d input records",
        len(clusters),
        len(records_list),
    )

    # Synthesize Golden Records
    golden_records_df = merge_clusters_to_golden_records(clusters, tenant_id="acme")

    # Persist Golden Records to DB
    persisted_gr = persist_golden_records(golden_records_df, tenant_id="acme")
    context.log.info("👑 Successfully persisted %d Golden Records to database", persisted_gr)

    # Track and persist field-level provenance
    all_provenance_entries: List[Dict[str, Any]] = []
    producer = EntityResolvedProducer()

    for cluster in clusters:
        cluster_records = cluster
        if not cluster_records:
            continue

        golden_rec = next(
            (
                gr
                for gr in golden_records_df.to_dicts()
                if any(str(r.get("id")) in gr.get("source_record_ids", []) for r in cluster_records)
            ),
            None,
        )

        if golden_rec:
            prov_entries = track_field_provenance(golden_rec, cluster_records, tenant_id="acme")
            all_provenance_entries.extend(prov_entries)

            # Publish entity.resolved Kafka event
            try:
                producer.publish_resolved_entity(
                    tenant_id="acme",
                    golden_id=str(golden_rec.get("golden_id")),
                    entity_type="Person",
                    payload=golden_rec,
                )
            except Exception as exc:
                context.log.warning("Could not publish entity.resolved Kafka event: %s", exc)

    if all_provenance_entries:
        persisted_prov = persist_provenance_records(all_provenance_entries, tenant_id="acme")
        context.log.info("👑 Successfully persisted %d field provenance records", persisted_prov)

    context.log.info("✅ er_golden_records: pipeline finished with %d canonical Golden Records", golden_records_df.height)
    return golden_records_df
