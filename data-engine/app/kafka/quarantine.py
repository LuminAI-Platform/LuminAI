"""Quarantine and Dead-Letter Queue (DLQ) management for LuminAI Data Engine.

Provides persistent SQLite storage for poison-pill or deserialization-failed messages,
integration with the ``ingest.dead_letter`` Kafka topic, and replay functionality back
into ``ingest.raw``.
"""

from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
import sqlite3
import threading
from typing import Any, Dict, List, Literal, Optional, Tuple
import uuid

from pydantic import BaseModel, Field

from app.kafka.producers import DeadLetterProducer, IngestRawProducer

logger = logging.getLogger("data-engine.quarantine")


class QuarantinedMessage(BaseModel):
    """Schema representing a quarantined failed message."""

    message_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str = Field(default="unknown")
    source_id: str = Field(default="unknown")
    topic: str = Field(default="ingest.raw")
    message_key: Optional[str] = None
    raw_payload: str
    error_reason: str
    quarantined_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    retry_count: int = 0
    status: Literal["quarantined", "replayed", "discarded"] = "quarantined"
    last_replayed_at: Optional[str] = None


class QuarantineManager:
    """Manages recording, listing, discarding, and replaying failed messages."""

    def __init__(
        self,
        db_path: str = "storage/sqlite/quarantine.db",
        dead_letter_producer: Optional[DeadLetterProducer] = None,
        ingest_raw_producer: Optional[IngestRawProducer] = None,
    ):
        self.db_path = db_path
        self._lock = threading.Lock()
        self.dead_letter_producer = dead_letter_producer or DeadLetterProducer()
        self.ingest_raw_producer = ingest_raw_producer or IngestRawProducer()

        self._init_db()

    def _init_db(self) -> None:
        """Initialize the SQLite schema if it doesn't already exist."""
        db_dir = os.path.dirname(self.db_path)
        if db_dir:
            Path(db_dir).mkdir(parents=True, exist_ok=True)

        with self._lock, sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS quarantined_messages (
                    message_id TEXT PRIMARY KEY,
                    tenant_id TEXT NOT NULL,
                    source_id TEXT NOT NULL,
                    topic TEXT NOT NULL,
                    message_key TEXT,
                    raw_payload TEXT NOT NULL,
                    error_reason TEXT NOT NULL,
                    quarantined_at TEXT NOT NULL,
                    retry_count INTEGER NOT NULL DEFAULT 0,
                    status TEXT NOT NULL DEFAULT 'quarantined',
                    last_replayed_at TEXT
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_quarantine_status ON quarantined_messages (status)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_quarantine_tenant ON quarantined_messages (tenant_id)"
            )
            conn.commit()

    def record_failure(
        self,
        topic: str,
        key: Optional[str],
        raw_payload: str,
        error: str,
        tenant_id: str = "unknown",
        source_id: str = "unknown",
    ) -> QuarantinedMessage:
        """Store a failed message in SQLite and publish to ingest.dead_letter."""
        # Attempt to infer tenant_id or source_id from key or payload if unknown
        if (tenant_id == "unknown" or source_id == "unknown") and key:
            parts = key.split(":")
            if len(parts) >= 2:
                if tenant_id == "unknown":
                    tenant_id = parts[0]
                if source_id == "unknown":
                    source_id = parts[1]

        if tenant_id == "unknown" and raw_payload:
            try:
                parsed = json.loads(raw_payload)
                if isinstance(parsed, dict):
                    tenant_id = parsed.get("tenant_id") or parsed.get("tenantId") or tenant_id
                    source_id = (
                        parsed.get("source_id")
                        or parsed.get("connectionId")
                        or parsed.get("connection_id")
                        or source_id
                    )
            except Exception:
                pass

        msg = QuarantinedMessage(
            tenant_id=tenant_id,
            source_id=source_id,
            topic=topic,
            message_key=key,
            raw_payload=raw_payload,
            error_reason=error,
        )

        with self._lock, sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO quarantined_messages (
                    message_id, tenant_id, source_id, topic, message_key,
                    raw_payload, error_reason, quarantined_at, retry_count,
                    status, last_replayed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    msg.message_id,
                    msg.tenant_id,
                    msg.source_id,
                    msg.topic,
                    msg.message_key,
                    msg.raw_payload,
                    msg.error_reason,
                    msg.quarantined_at,
                    msg.retry_count,
                    msg.status,
                    msg.last_replayed_at,
                ),
            )
            conn.commit()

        # Publish to Kafka dead-letter topic
        try:
            self.dead_letter_producer.publish_dead_letter(
                tenant_id=msg.tenant_id,
                error=msg.error_reason,
                original_topic=msg.topic,
                original_key=msg.message_key,
                original_payload=msg.raw_payload,
                source_id=msg.source_id,
            )
        except Exception as e:
            logger.warning("Could not publish dead letter to Kafka: %s", e)

        logger.warning(
            "⚠️ Message quarantined — id=%s, tenant=%s, topic=%s, error=%s",
            msg.message_id,
            msg.tenant_id,
            msg.topic,
            msg.error_reason,
        )
        return msg

    def list_messages(
        self,
        tenant_id: Optional[str] = None,
        status: Optional[str] = "quarantined",
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[QuarantinedMessage], int]:
        """Query quarantined messages matching optional filters with pagination."""
        query = "SELECT * FROM quarantined_messages WHERE 1=1"
        count_query = "SELECT COUNT(*) FROM quarantined_messages WHERE 1=1"
        params: List[Any] = []

        if tenant_id:
            query += " AND tenant_id = ?"
            count_query += " AND tenant_id = ?"
            params.append(tenant_id)

        if status and status.lower() != "all":
            query += " AND status = ?"
            count_query += " AND status = ?"
            params.append(status.lower())

        query += " ORDER BY quarantined_at DESC LIMIT ? OFFSET ?"

        with self._lock, sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(count_query, params)
            total = cursor.fetchone()[0]

            cursor.execute(query, params + [limit, offset])
            rows = cursor.fetchall()

            messages = [
                QuarantinedMessage(
                    message_id=row["message_id"],
                    tenant_id=row["tenant_id"],
                    source_id=row["source_id"],
                    topic=row["topic"],
                    message_key=row["message_key"],
                    raw_payload=row["raw_payload"],
                    error_reason=row["error_reason"],
                    quarantined_at=row["quarantined_at"],
                    retry_count=row["retry_count"],
                    status=row["status"],
                    last_replayed_at=row["last_replayed_at"],
                )
                for row in rows
            ]

        return messages, total

    def get_message(self, message_id: str) -> Optional[QuarantinedMessage]:
        """Fetch a single quarantined message by UUID."""
        with self._lock, sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM quarantined_messages WHERE message_id = ?", (message_id,))
            row = cursor.fetchone()
            if row:
                return QuarantinedMessage(
                    message_id=row["message_id"],
                    tenant_id=row["tenant_id"],
                    source_id=row["source_id"],
                    topic=row["topic"],
                    message_key=row["message_key"],
                    raw_payload=row["raw_payload"],
                    error_reason=row["error_reason"],
                    quarantined_at=row["quarantined_at"],
                    retry_count=row["retry_count"],
                    status=row["status"],
                    last_replayed_at=row["last_replayed_at"],
                )
        return None

    def replay_messages(self, message_ids: List[str]) -> List[QuarantinedMessage]:
        """Replay specified quarantined messages back to ingest.raw and update status."""
        replayed: List[QuarantinedMessage] = []
        now = datetime.now(timezone.utc).isoformat()

        for msg_id in message_ids:
            msg = self.get_message(msg_id)
            if not msg:
                continue

            # Re-publish to ingest.raw topic
            try:
                self.ingest_raw_producer.publish_raw(
                    key=msg.message_key,
                    payload=msg.raw_payload,
                )
            except Exception as e:
                logger.error("Failed to replay message %s to Kafka: %s", msg_id, e)

            # Update status in SQLite
            new_retry_count = msg.retry_count + 1
            with self._lock, sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    """
                    UPDATE quarantined_messages
                    SET status = 'replayed', retry_count = ?, last_replayed_at = ?
                    WHERE message_id = ?
                    """,
                    (new_retry_count, now, msg_id),
                )
                conn.commit()

            msg.status = "replayed"
            msg.retry_count = new_retry_count
            msg.last_replayed_at = now
            replayed.append(msg)
            logger.info("🔁 Replayed quarantined message id=%s (attempt #%d)", msg_id, new_retry_count)

        return replayed

    def discard_messages(self, message_ids: List[str]) -> List[QuarantinedMessage]:
        """Mark specified messages as discarded."""
        discarded: List[QuarantinedMessage] = []
        for msg_id in message_ids:
            msg = self.get_message(msg_id)
            if not msg:
                continue

            with self._lock, sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    "UPDATE quarantined_messages SET status = 'discarded' WHERE message_id = ?",
                    (msg_id,),
                )
                conn.commit()

            msg.status = "discarded"
            discarded.append(msg)
            logger.info("🗑️ Discarded quarantined message id=%s", msg_id)

        return discarded


_global_quarantine_manager: Optional[QuarantineManager] = None
_manager_lock = threading.Lock()


def get_quarantine_manager() -> QuarantineManager:
    """Singleton factory for QuarantineManager."""
    global _global_quarantine_manager
    if _global_quarantine_manager is None:
        with _manager_lock:
            if _global_quarantine_manager is None:
                _global_quarantine_manager = QuarantineManager()
    return _global_quarantine_manager
