# LuminAI — Data Model & Ontology Design

## 1. Overview

LuminAI uses an **Ontology-centric data model** where all integrated data is mapped to a graph of typed objects (entities) and typed links (relationships). The **Ontology is the heart of the platform**: every data pipeline outputs into it, and every application consumes from it.

## 2. Core Concepts

| Concept | Equivalent Term | Definition |
|---|---|---|
| **Entity Type** | Object Type | A class of real-world object (e.g., Person, Organisation). |
| **Entity** | Object | An instance of an entity type with properties and a stable ID. |
| **Relationship Type** | Link Type | A labelled, directional edge definition (e.g., `WORKS_FOR`). |
| **Relationship** | Link | An instance connecting two entities, optionally carrying properties (weight, timestamp). |
| **Property** | Property | A key-value attribute on an entity or relationship. |
| **Ontology** | Ontology | The versioned schema of all entity types, relationship types, and property definitions. |

## 3. Base Entity Types (Seed Ontology)

The following entity types form the default ontology. Tenants can extend or customise these.

### 3.1 Entity Types

```yaml
Person:
  properties:
    - full_name: string (required)
    - date_of_birth: date
    - national_id: string
    - email: string[]
    - phone: string[]
    - gender: enum [male, female, other, unknown]
    - nationality: string
    - address: Address (embedded)
    - photo_url: string
    - risk_score: float
    - tags: string[]

Organisation:
  properties:
    - name: string (required)
    - registration_number: string
    - type: enum [company, ngo, government, educational, other]
    - industry: string
    - country: string
    - address: Address (embedded)
    - website: string
    - revenue_bracket: string
    - tags: string[]

Device:
  properties:
    - device_id: string (required)
    - type: enum [phone, laptop, server, iot_sensor, vehicle_tracker, other]
    - manufacturer: string
    - model: string
    - serial_number: string
    - ip_addresses: string[]
    - mac_address: string
    - status: enum [active, inactive, decommissioned]

Transaction:
  properties:
    - transaction_id: string (required)
    - type: enum [payment, transfer, withdrawal, deposit, trade, other]
    - amount: decimal (required)
    - currency: string (required)
    - timestamp: datetime (required)
    - status: enum [pending, completed, failed, reversed]
    - channel: string
    - reference: string

Vehicle:
  properties:
    - plate_number: string (required)
    - vin: string
    - make: string
    - model: string
    - year: int
    - colour: string
    - owner_id: ref → Person | Organisation

Location:
  properties:
    - name: string
    - type: enum [address, city, region, country, coordinates]
    - latitude: float
    - longitude: float
    - country_code: string
    - address_line: string

Event:
  properties:
    - event_id: string (required)
    - type: string (required)
    - description: string
    - timestamp: datetime (required)
    - severity: enum [info, low, medium, high, critical]
    - source: string

Document:
  properties:
    - document_id: string (required)
    - title: string
    - type: enum [report, contract, invoice, email, memo, other]
    - content_hash: string
    - storage_url: string
    - created_at: datetime
    - language: string

Account:
  properties:
    - account_id: string (required)
    - type: enum [bank, mobile_money, crypto_wallet, email, social, other]
    - provider: string
    - status: enum [active, suspended, closed]
    - balance: decimal
    - currency: string
```

### 3.2 Embedded Types

```yaml
Address:
  properties:
    - line1: string
    - line2: string
    - city: string
    - state_province: string
    - postal_code: string
    - country: string
```

---

## 4. Core Relationship Types

```
Person   ──WORKS_FOR──▶   Organisation
Person   ──OWNS──▶        Organisation
Person   ──KNOWS──▶       Person
Person   ──USES──▶        Device
Person   ──HOLDS──▶       Account
Person   ──LOCATED_AT──▶  Location
Person   ──AUTHORED──▶    Document
Person   ──INVOLVED_IN──▶ Event

Organisation ──SUBSIDIARY_OF──▶ Organisation
Organisation ──LOCATED_AT──▶    Location
Organisation ──HOLDS──▶         Account
Organisation ──PARTY_TO──▶      Transaction

Account  ──SENDS──▶       Transaction
Account  ──RECEIVES──▶    Transaction

Transaction ──OCCURRED_AT──▶ Location
Transaction ──LINKED_TO──▶   Event

Device   ──LOCATED_AT──▶  Location
Device   ──OBSERVED_AT──▶  Event

Vehicle  ──OWNED_BY──▶    Person | Organisation
Vehicle  ──LOCATED_AT──▶  Location
```

### Relationship Properties

All relationships carry:
- `confidence: float` — confidence score for inferred edges (0.0–1.0)
- `source: string` — the data source that produced this edge
- `created_at: datetime`
- `updated_at: datetime`

---

## 5. Ontology Versioning

| Field | Description |
|---|---|
| `version` | Semantic version (e.g., `1.2.0`) |
| `created_by` | User or system that published the version |
| `created_at` | Timestamp |
| `changelog` | Human-readable description of changes |
| `migration` | Programmatic migration script (add/rename/remove properties) |
| `status` | `draft` → `published` → `deprecated` |

The ontology service enforces:
1. **Additive changes** (new entity types, new optional properties) are non-breaking.
2. **Breaking changes** (removing properties, changing types) require a major version bump and explicit migration.
3. All existing data retains its schema version; queries translate on-the-fly or data is back-filled.

---

## 6. Entity Resolution Strategy

### 6.1 Matching Pipeline

```
Raw Records ──▶ Blocking ──▶ Pairwise Comparison ──▶ Classification ──▶ Clustering ──▶ Unified Entity
```

| Stage | Approach |
|---|---|
| **Blocking** | Group records by coarse keys (e.g., first 3 chars of name + country) to reduce comparison space. |
| **Pairwise Comparison** | Levenshtein, Jaro-Winkler, TF-IDF cosine similarity on name fields; exact match on IDs. |
| **Classification** | Logistic regression or random-forest model trained on labelled match/non-match pairs. |
| **Clustering** | Connected-component or hierarchical clustering of matched pairs. |

### 6.2 Merge Rules

- **Source Records are Immutable:** Original ingested records are never modified or deleted. They are preserved as-is in the staging layer (MinIO + PostgreSQL `source_records` table).
- **Golden Record:** The unified entity is a **computed view** that stores the "best" value for each property, selected by source priority or recency. If a merge is later found to be incorrect, the golden record can be recomputed from the immutable sources.
- **Provenance:** Every property value retains a provenance link back to the contributing source record and confidence score.
- **Manual Override:** Users can accept, reject, or manually merge entity resolution suggestions. Overrides are versioned.

---

## 7. Graph Database Schema (Neo4j)

```cypher
// Entity nodes
CREATE (p:Person {entity_id: 'P-001', full_name: 'Amara Diallo', ...})
CREATE (o:Organisation {entity_id: 'O-001', name: 'Sahel Finance Ltd', ...})

// Relationships
CREATE (p)-[:WORKS_FOR {confidence: 0.95, source: 'hr_db'}]->(o)
CREATE (p)-[:HOLDS {since: date('2023-01-15')}]->(a:Account {account_id: 'ACC-001'})

// Indexes
CREATE INDEX entity_id_idx FOR (n:Entity) ON (n.entity_id)
CREATE FULLTEXT INDEX entity_search FOR (n:Person|Organisation) ON EACH [n.full_name, n.name]
```

---

## 8. Relational Schema (PostgreSQL) — Key Tables

```sql
-- Ontology metadata
CREATE TABLE ontology_versions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version     VARCHAR(20) NOT NULL,
    tenant_id   UUID NOT NULL,
    status      VARCHAR(20) DEFAULT 'draft',
    changelog   TEXT,
    created_by  UUID,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Entity type definitions
CREATE TABLE entity_types (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ontology_id     UUID REFERENCES ontology_versions(id),
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    properties_schema JSONB NOT NULL  -- JSON Schema for properties
);

-- Entity instances
CREATE TABLE entities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    entity_type     VARCHAR(100) NOT NULL,
    schema_version  INTEGER NOT NULL DEFAULT 1,  -- tracks ontology schema version for migration
    is_golden       BOOLEAN NOT NULL DEFAULT false,  -- true = merged golden record, false = source record
    properties      JSONB NOT NULL,
    source_refs     JSONB,             -- provenance
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_entities_tenant ON entities(tenant_id);
CREATE INDEX idx_entities_type ON entities(entity_type);
CREATE INDEX idx_entities_props ON entities USING GIN (properties);

-- Relationship instances
CREATE TABLE relationships (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    relationship_type VARCHAR(100) NOT NULL,
    source_entity_id UUID REFERENCES entities(id),
    target_entity_id UUID REFERENCES entities(id),
    properties      JSONB,
    confidence      FLOAT DEFAULT 1.0,
    created_at      TIMESTAMPTZ DEFAULT now()
);
```

---

## 9. Search Index (OpenSearch)

All curated entities are indexed into OpenSearch for full-text and faceted search:

```json
{
  "mappings": {
    "properties": {
      "entity_id":   { "type": "keyword" },
      "entity_type": { "type": "keyword" },
      "tenant_id":   { "type": "keyword" },
      "full_name":   { "type": "text", "analyzer": "standard" },
      "name":        { "type": "text", "analyzer": "standard" },
      "properties":  { "type": "object", "dynamic": true },
      "tags":        { "type": "keyword" },
      "updated_at":  { "type": "date" }
    }
  }
}
```
