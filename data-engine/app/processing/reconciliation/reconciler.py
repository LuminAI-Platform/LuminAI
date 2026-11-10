"""Cross-Store Reconciler engine implementation."""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

from sqlalchemy import text

from app.config import get_settings
from app.processing.reconciliation.hashing import (
    compute_record_hash,
    compute_store_aggregate_checksum,
)
from app.processing.reconciliation.models import (
    ReconciliationReport,
    StoreEntityRecord,
)

logger = logging.getLogger(__name__)


class CrossStoreReconciler:
    """Core engine for detecting record count and checksum drifts across stores."""

    def __init__(self, tenant_id: str = "acme", entity_type: str = "Person") -> None:
        self.tenant_id = tenant_id
        self.entity_type = entity_type
        self.settings = get_settings()

    def fetch_postgres_records(
        self, override_records: Optional[List[Dict[str, Any]]] = None
    ) -> List[StoreEntityRecord]:
        """Fetch primary golden records from PostgreSQL with parameter binding and leak prevention."""
        if override_records is not None:
            return self._normalize_records(override_records)

        from app.db import get_engine, get_sqlite_engine

        query = text(
            """
            SELECT golden_id, tenant_id, attributes
            FROM golden_records
            WHERE tenant_id = :tenant_id
            ORDER BY golden_id ASC
            """
        )

        records: List[StoreEntityRecord] = []

        try:
            engine = get_engine()
            with engine.connect() as conn:
                result = conn.execute(query, {"tenant_id": self.tenant_id})
                for row in result:
                    gid = str(row.golden_id)
                    attrs_raw = row.attributes
                    attrs = (
                        json.loads(attrs_raw)
                        if isinstance(attrs_raw, str)
                        else (attrs_raw or {})
                    )
                    rec_hash = compute_record_hash(attrs)
                    records.append(
                        StoreEntityRecord(
                            entity_id=gid,
                            tenant_id=self.tenant_id,
                            entity_type=self.entity_type,
                            attributes_hash=rec_hash,
                            raw_data=attrs,
                        )
                    )
            logger.info(
                "Fetched %d records from PostgreSQL for tenant %s",
                len(records),
                self.tenant_id,
            )
            return records
        except Exception as exc:
            logger.warning(
                "Could not query PostgreSQL (%s). Trying local SQLite fallback.", exc
            )

        # SQLite fallback for dev / tests
        sqlite_path = os.path.join("storage", "sqlite", "er_staging.db")
        if os.path.exists(sqlite_path):
            try:
                sqlite_engine = get_sqlite_engine(sqlite_path)
                with sqlite_engine.connect() as conn:
                    result = conn.execute(query, {"tenant_id": self.tenant_id})
                    for row in result:
                        gid = str(row.golden_id)
                        attrs_raw = row.attributes
                        attrs = (
                            json.loads(attrs_raw)
                            if isinstance(attrs_raw, str)
                            else (attrs_raw or {})
                        )
                        rec_hash = compute_record_hash(attrs)
                        records.append(
                            StoreEntityRecord(
                                entity_id=gid,
                                tenant_id=self.tenant_id,
                                entity_type=self.entity_type,
                                attributes_hash=rec_hash,
                                raw_data=attrs,
                            )
                        )
                logger.info(
                    "Fetched %d records from SQLite for tenant %s",
                    len(records),
                    self.tenant_id,
                )
                return records
            except Exception as sqle:
                logger.warning("SQLite query failed: %s", sqle)

        return []

    def fetch_neo4j_records(
        self, override_records: Optional[List[Dict[str, Any]]] = None
    ) -> List[StoreEntityRecord]:
        """Fetch entity nodes from Neo4j scoped by tenant ID."""
        if override_records is not None:
            return self._normalize_records(override_records)

        try:
            import neo4j  # type: ignore

            settings = get_settings()
            uri = getattr(
                settings, "neo4j_uri", os.getenv("NEO4J_URI", "bolt://localhost:7687")
            )
            username = getattr(
                settings, "neo4j_username", os.getenv("NEO4J_USERNAME", "neo4j")
            )
            password = getattr(
                settings,
                "neo4j_password",
                os.getenv("NEO4J_PASSWORD", "luminai_dev_password"),
            )
            auth = (username, password)
            records: List[StoreEntityRecord] = []

            with neo4j.GraphDatabase.driver(uri, auth=auth) as driver:
                with driver.session() as session:
                    cypher_query = """
                    MATCH (n:Entity)
                    WHERE (n.tenant_id = $tenantId OR n.tenantId = $tenantId)
                    RETURN coalesce(n.id, n.goldenId) AS goldenId, properties(n) AS props
                    ORDER BY goldenId ASC
                    """
                    result = session.run(cypher_query, tenantId=self.tenant_id)
                    for record in result:
                        gid = str(record["goldenId"])
                        props = dict(record["props"])
                        rec_hash = compute_record_hash(props)
                        records.append(
                            StoreEntityRecord(
                                entity_id=gid,
                                tenant_id=self.tenant_id,
                                entity_type=self.entity_type,
                                attributes_hash=rec_hash,
                                raw_data=props,
                            )
                        )
            logger.info(
                "Fetched %d records from Neo4j for tenant %s",
                len(records),
                self.tenant_id,
            )
            return records
        except Exception as exc:
            logger.debug("Neo4j connection skipped/unavailable: %s", exc)
            return []

    def fetch_opensearch_records(
        self, override_records: Optional[List[Dict[str, Any]]] = None
    ) -> List[StoreEntityRecord]:
        """Fetch entity documents from OpenSearch index scoped by tenant ID."""
        if override_records is not None:
            return self._normalize_records(override_records)

        try:
            import httpx

            url = f"http://localhost:9200/{self.tenant_id}-entities/_search"
            payload = {
                "query": {"match_all": {}},
                "size": 10000,
            }
            records: List[StoreEntityRecord] = []
            with httpx.Client(timeout=3.0) as client:
                res = client.post(url, json=payload)
                if res.status_code == 200:
                    hits = res.json().get("hits", {}).get("hits", [])
                    for hit in hits:
                        source = hit.get("_source", {})
                        gid = str(
                            source.get("goldenId") or source.get("id") or hit.get("_id")
                        )
                        rec_hash = compute_record_hash(source)
                        records.append(
                            StoreEntityRecord(
                                entity_id=gid,
                                tenant_id=self.tenant_id,
                                entity_type=self.entity_type,
                                attributes_hash=rec_hash,
                                raw_data=source,
                            )
                        )
            logger.info(
                "Fetched %d records from OpenSearch for tenant %s",
                len(records),
                self.tenant_id,
            )
            return records
        except Exception as exc:
            logger.debug("OpenSearch connection skipped/unavailable: %s", exc)
            return []

    def _normalize_records(
        self, raw_records: List[Dict[str, Any]]
    ) -> List[StoreEntityRecord]:
        """Convert a list of generic record dictionaries to normalized StoreEntityRecord instances."""
        normalized = []
        for r in raw_records:
            gid = str(r.get("golden_id", r.get("goldenId", r.get("id", ""))))
            if not gid:
                continue
            attrs = dict(r)
            rec_hash = compute_record_hash(attrs)
            normalized.append(
                StoreEntityRecord(
                    entity_id=gid,
                    tenant_id=self.tenant_id,
                    entity_type=self.entity_type,
                    attributes_hash=rec_hash,
                    raw_data=attrs,
                )
            )
        return normalized

    def reconcile(
        self,
        pg_override: Optional[List[Dict[str, Any]]] = None,
        neo4j_override: Optional[List[Dict[str, Any]]] = None,
        opensearch_override: Optional[List[Dict[str, Any]]] = None,
    ) -> ReconciliationReport:
        """Run full cross-store reconciliation comparing PostgreSQL, Neo4j, and OpenSearch."""
        pg_records = self.fetch_postgres_records(override_records=pg_override)
        neo4j_records = self.fetch_neo4j_records(override_records=neo4j_override)
        opensearch_records = self.fetch_opensearch_records(
            override_records=opensearch_override
        )

        pg_ids = {r.entity_id for r in pg_records}
        neo4j_ids = {r.entity_id for r in neo4j_records}
        opensearch_ids = {r.entity_id for r in opensearch_records}

        pg_checksum = compute_store_aggregate_checksum(pg_records)
        neo4j_checksum = compute_store_aggregate_checksum(neo4j_records)
        opensearch_checksum = compute_store_aggregate_checksum(opensearch_records)

        all_ids = pg_ids | neo4j_ids | opensearch_ids
        missing_in_neo4j = sorted(list(pg_ids - neo4j_ids))
        missing_in_opensearch = sorted(list(pg_ids - opensearch_ids))
        missing_in_postgres = sorted(list((neo4j_ids | opensearch_ids) - pg_ids))

        counts_match = len(pg_records) == len(neo4j_records) == len(opensearch_records)
        checksums_match = pg_checksum == neo4j_checksum == opensearch_checksum

        drift_details: List[Dict[str, Any]] = []

        pg_map = {r.entity_id: r for r in pg_records}
        neo4j_map = {r.entity_id: r for r in neo4j_records}
        opensearch_map = {r.entity_id: r for r in opensearch_records}

        for eid in sorted(all_ids):
            pg_rec = pg_map.get(eid)
            n4j_rec = neo4j_map.get(eid)
            os_rec = opensearch_map.get(eid)

            hashes = {
                "postgres": pg_rec.attributes_hash if pg_rec else None,
                "neo4j": n4j_rec.attributes_hash if n4j_rec else None,
                "opensearch": os_rec.attributes_hash if os_rec else None,
            }

            distinct_hashes = {h for h in hashes.values() if h is not None}
            has_missing = any(h is None for h in hashes.values())
            has_attribute_drift = len(distinct_hashes) > 1

            if has_missing or has_attribute_drift:
                drift_details.append(
                    {
                        "entity_id": eid,
                        "presence": {
                            "postgres": pg_rec is not None,
                            "neo4j": n4j_rec is not None,
                            "opensearch": os_rec is not None,
                        },
                        "attribute_hashes": hashes,
                        "drift_type": (
                            "MISSING_ACROSS_STORES"
                            if has_missing
                            else "ATTRIBUTE_CONTENT_MISMATCH"
                        ),
                    }
                )

        is_healthy = counts_match and checksums_match and len(drift_details) == 0

        report = ReconciliationReport(
            status="HEALTHY" if is_healthy else "DRIFT_DETECTED",
            tenant_id=self.tenant_id,
            entity_type=self.entity_type,
            pg_count=len(pg_records),
            neo4j_count=len(neo4j_records),
            opensearch_count=len(opensearch_records),
            missing_in_neo4j=missing_in_neo4j,
            missing_in_opensearch=missing_in_opensearch,
            missing_in_postgres=missing_in_postgres,
            checksum_match=checksums_match,
            checksums={
                "postgres": pg_checksum,
                "neo4j": neo4j_checksum,
                "opensearch": opensearch_checksum,
            },
            drift_details=drift_details,
        )

        logger.info(
            "Reconciliation complete for tenant=%s — status=%s, pg=%d, neo4j=%d, os=%d, drifts=%d",
            self.tenant_id,
            report.status,
            report.pg_count,
            report.neo4j_count,
            report.opensearch_count,
            len(report.drift_details),
        )

        return report


def run_cross_store_reconciliation(
    tenant_id: str = "acme",
    entity_type: str = "Person",
    pg_records: Optional[List[Dict[str, Any]]] = None,
    neo4j_records: Optional[List[Dict[str, Any]]] = None,
    opensearch_records: Optional[List[Dict[str, Any]]] = None,
) -> ReconciliationReport:
    """Convenience function to execute cross-store data reconciliation."""
    reconciler = CrossStoreReconciler(tenant_id=tenant_id, entity_type=entity_type)
    return reconciler.reconcile(
        pg_override=pg_records,
        neo4j_override=neo4j_records,
        opensearch_override=opensearch_records,
    )
