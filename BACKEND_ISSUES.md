# Backend Data Engine & Ingestion Pipeline Analysis

This document details observed limitations and behavioral discrepancies in the LuminAI data engine, backend API, and ingestion pipeline discovered during frontend audit and validation.

---

## 1. Entity Type Resolution & Relational Decomposition Limitation

### 1.1 Summary of Problem
When ingesting heterogeneous enterprise or healthcare datasets (such as a hospital patient admissions file containing patient demographics, treating physicians, insurers, admitting departments, medical diagnoses, and prescribed medications), 100% of the ingested records are assigned to a single monolithic entity type: `"Person"`.

Columns that semantically represent distinct domain entities (e.g. `physician_name`, `insurance_payer`, `department`, `diagnosis_code`, `medication_name`) are flattened and stored solely as JSON properties on the primary `Person` golden record, rather than being extracted into separate linked entity nodes with relationships in the semantic graph.

### 1.2 Observed API Responses

#### Dashboard Entity Breakdown
Endpoint: `GET /api/v1/dashboard/summary`
```json
{
  "entityBreakdown": {
    "Person": 57
  },
  "totalEntities": 57,
  "totalPipelines": 15,
  "systemStatus": "HEALTHY",
  "activeAlerts": 0,
  "systemLoad": 0.35
}
```

#### Entity Explorer Facet Search
Endpoint: `GET /api/v1/explorer/search?query=*`
```json
{
  "totalResults": 57,
  "results": [
    {
      "id": "e43b17c9-467f-440f-90e6-b9dcb993fb68",
      "canonicalName": "John Doe",
      "entityType": "Person",
      "properties": {
        "physician": "Dr. Sarah Adams",
        "insurer": "Aetna Health",
        "department": "Cardiology",
        "diagnosis": "Atrial Fibrillation",
        "medication": "Warfarin"
      }
    }
  ],
  "facets": {
    "Person": 57
  }
}
```

#### Knowledge Graph Neighborhood
Endpoint: `GET /api/v1/graph/neighbourhood?entityId=...`
All returned nodes have `entityType: "Person"`. No nodes exist for `Physician`, `Insurer`, `Department`, `Diagnosis`, or `Medication`.

### 1.3 Expected Entity Types for Hospital Dataset
A clinical hospital dataset is expected to resolve into a rich multi-class entity graph with distinct entity types:
1. **Patient** (or **Person**): The individual receiving care.
2. **Physician** / **Doctor**: The healthcare provider attending to the patient.
3. **Insurer** / **Insurance**: The payer organization covering the visit.
4. **Department**: The hospital clinical division (e.g., Cardiology, Oncology, Emergency).
5. **Diagnosis**: Clinical diagnosis or condition codes (ICD-10).
6. **Medication**: Prescribed drugs, dosages, and formulations.

### 1.4 Backend Implementation Root Cause
1. **Repository Query Hardcoding**:
   In `core-backend/src/main/java/com/luminai/repository/GoldenRecordRepository.java` (line 54):
   ```java
   @Query("SELECT COALESCE(NULLIF(g.entity_type, ''), 'Person') as entityType, COUNT(*) as cnt " +
          "FROM golden_records g GROUP BY COALESCE(NULLIF(g.entity_type, ''), 'Person')")
   List<EntityTypeCountProjection> countByEntityTypeGrouped();
   ```
   If `entity_type` is NULL or empty in the database, it unconditionally defaults to `'Person'`.

2. **Ingestion & Python Data Engine (`data-engine/src/pipelines/ingest.py`)**:
   The `data-engine` pipeline processes raw CSV rows as a single Polars DataFrame batch. During entity resolution:
   - Each row is mapped 1:1 to a single `golden_record`.
   - The wizard UI allows setting a `targetEntityType` per column, but the ingestion runner payload only transmits column-level metadata without relational decomposition instructions or graph edge extraction rules.
   - There is no relational entity decomposition step (e.g., extracting `Dr. Sarah Adams` into a separate `Physician` node and creating a `TREATED_BY` edge linking `Patient` $\to$ `Physician`).

---

## 2. Recommended Backend Architecture Enhancements

1. **Relational Entity Decomposition Pipeline**:
   - In `data-engine`, introduce a graph extraction stage that extracts distinct entities from non-primary columns where `targetEntityType != primaryTargetEntity`.
   - Generate foreign key synthetic identifiers or deduplicate secondary entities (e.g., deduplicating multiple patient records referencing the same `Dr. Sarah Adams`).

2. **Edge & Relationship Generation**:
   - Auto-generate semantic edges between the primary record and extracted secondary entities (e.g., `(Patient)-[:TREATED_BY]->(Physician)`, `(Patient)-[:COVERED_BY]->(Insurer)`).
   - Store these relationships in the graph repository so the Knowledge Graph canvas and neighborhood queries surface the connected topology.

3. **Dynamic Entity Type Storage**:
   - Ensure `golden_records.entity_type` accurately persists the configured entity type (e.g., `Patient`, `Physician`, `Insurer`), avoiding fallback to `"Person"`.

---

## 3. Frontend Mitigations Implemented

To ensure transparency, prevent misleading users, and clearly guide workflow:
1. **Honest Entity Type Distribution**:
   - When only 1 entity type exists in the API response, the frontend renders a ranked list (not an empty or fake multi-slice donut) with exact API counts.
   - Displays an explanatory hint informing the user that all data was mapped to a single type, with direct links to `/connections` and `/ontology`.
2. **Ingestion Wizard Entity Preview & Warning**:
   - Step 2 ("Define Types & Mapping") previews all configured entity types, displays total entity class counts, and provides tips on multi-entity mapping.
   - Step 4 ("Ingestion Summary") warns: *"All records were mapped to {type}. Columns such as physician, insurer and diagnosis were stored as properties, not entities."*
3. **Unified Color Palette**:
   - A single color-blind safe palette (`entityColors.ts`) is shared across Dashboard, Entity Explorer, and Knowledge Graph.

---

## 4. Entity Explorer (`/explorer`) Missing API Fields & Issues

The following missing fields, incomplete endpoint behaviors, and data anomalies were identified during a read-only audit of `core-backend` for the Entity Explorer redesign.

### 4.1 Hardcoded `confidenceScore` in Entity Detail & Unsupported Confidence Sorting
- **Endpoints**:
  - `GET /api/v1/explorer/entities/{id}`
  - `GET /api/v1/explorer/search?sortBy=confidenceScore&sortDirection=DESC`
- **Sample Response (`GET /api/v1/explorer/entities/{id}`)**:
  ```json
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "canonicalName": "Jane Doe",
    "entityType": "Person",
    "confidenceScore": 0.95,
    "sourceCount": 1,
    "properties": {},
    "createdAt": "2026-04-01T12:00:00Z",
    "updatedAt": "2026-04-01T12:00:00Z",
    "sourceRecordIds": [],
    "provenance": []
  }
  ```
- **Observed Behavior**:
  - `ExplorerSearchService.getEntityById()` (`core-backend/src/main/java/com/luminai/explorer/service/ExplorerSearchService.java:283`) hardcodes `confidenceScore` to `0.95` instead of reading `gr.getConfidenceScore()`.
  - `ExplorerSearchService.search()` (`lines 130, 207`) falls back to `0.95` when `gr.getConfidenceScore()` is null.
  - `ExplorerSearchService.search()` only supports `sortBy=canonicalName` and defaults all other values (including `sortBy=confidenceScore`) to `created_at` (`lines 75-86`, `217-235`).
  - The `@Cacheable` key on `ExplorerSearchService.search()` (`line 46`) omits `#sortBy` and `#sortDirection`, so changing sort order can return stale cached results.
- **Expected Behavior**:
  - Return the real persisted `confidenceScore` (or `null` when unavailable) on both `/search` and `/entities/{id}`.
  - Support `sortBy=confidenceScore` in both the PostgreSQL pushdown query and fallback sort, and include `sortBy` and `sortDirection` in the `@Cacheable` key.

### 4.2 Missing Match Reasons / Field-Level Match Details ("Why merged?" Blocked)
- **Endpoints**:
  - `GET /api/v1/explorer/search`
  - `GET /api/v1/explorer/entities/{id}`
- **Sample Response (`GET /api/v1/explorer/search`)**:
  ```json
  {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "canonicalName": "Jane Doe",
        "entityType": "Person",
        "confidenceScore": 0.95,
        "sourceCount": 2,
        "properties": { "email": "jane@example.com" },
        "createdAt": "2026-04-01T12:00:00Z",
        "updatedAt": "2026-04-01T12:00:00Z",
        "highlights": null
      }
    ],
    "total": 60,
    "page": 0,
    "size": 12,
    "facets": { "entityTypes": { "Person": 40, "Organization": 20 } }
  }
  ```
- **Observed Behavior**: Neither `SearchResponseDto.SearchItem` nor `EntityDetailDto.Response` returns match reasons, matched rules, or field-level similarity scores explaining why source records were merged.
- **Expected Behavior**: Return a `matchReasons` array (e.g., `[{ "field": "email", "rule": "exact", "score": 1.0 }]`) on merged records so the "Why merged?" popover can display engine-computed explanations.
- **Frontend Impact**: The "Why merged?" link is hidden until the API provides these fields.

### 4.3 Missing Duplicate Flags & Aggregate Insight Counts (Duplicate Banner & Insight Strip Blocked)
- **Endpoints**:
  - `GET /api/v1/explorer/search`
  - `GET /api/v1/explorer/entities/{id}`
- **Sample Response**: Same as 4.2 — no `possibleDuplicate`, `duplicateOf`, `needsReview`, or `insights` fields exist in the response DTOs.
- **Observed Behavior**:
  - Entity list and detail responses do not flag potential duplicates or records needing review.
  - `/api/v1/explorer/search` does not return aggregate counts for possible duplicates, records with missing values, or records needing review, nor does it accept filter query parameters for those states.
- **Expected Behavior**:
  - Include `possibleDuplicate` (e.g., `{ "id": "...", "canonicalName": "...", "candidateId": "..." }`) and `needsReview` boolean when applicable.
  - Return an `insights` summary object (e.g., `{ "possibleDuplicates": 4, "missingValues": 12, "needsReview": 3 }`) and corresponding filter parameters on `/api/v1/explorer/search`.
- **Frontend Impact**: "Possible duplicate of {name}" card banners and the Insight Strip above the result list are omitted (no client-side duplicate inference is performed).

### 4.4 Missing Source System Names on List Items & Missing Source System Facet
- **Endpoints**:
  - `GET /api/v1/explorer/search`
  - `GET /api/v1/explorer/entities/{id}`
  - `GET /api/v1/explorer/entities/{id}/provenance`
- **Sample Response**:
  ```json
  {
    "facets": { "entityTypes": { "Person": 40, "Organization": 20 } }
  }
  ```
  ```json
  [
    {
      "fieldName": "email",
      "sourceRecordId": "11111111-2222-3333-4444-555555555555",
      "sourceName": "Raw Connector",
      "contributedValue": "jane@example.com",
      "action": "MERGED",
      "occurredAt": "2026-04-01T12:00:00Z"
    }
  ]
  ```
- **Observed Behavior**:
  - `SearchResponseDto.SearchItem` returns `sourceCount` (`int`) but does not return `sourceSystems` (the list of source system / connector names contributing to the record).
  - `SearchResponseDto.Response.facets` only contains `entityTypes` (`Map.of("entityTypes", typeFacets)` in `ExplorerSearchService.java:137,244`); no `sourceSystems` facet group or filter parameter exists.
  - `ExplorerSearchService.getEntityById()` (`line 272`) hardcodes `ProvenanceItem.sourceName` to `"Raw Connector"` instead of resolving the actual connector/file name.
- **Expected Behavior**:
  - Return `sourceSystems: string[]` on `SearchItem` and `EntityDetailDto.Response`, resolve actual connector/file names in `ProvenanceItem.sourceName`, and add a `sourceSystems` facet + `sourceSystem` filter parameter on `/api/v1/explorer/search`.
- **Frontend Impact**: Cards display `"Merged from {n} records"` (or `"1 source record"`) without fabricating source names. The sidebar automatically renders additional collapsible facet groups if the API adds them to `facets`, and currently renders only `Entity Types`.

### 4.5 Missing Quality / Completeness Metrics
- **Endpoints**:
  - `GET /api/v1/explorer/search`
  - `GET /api/v1/explorer/entities/{id}`
- **Observed Behavior**: Neither endpoint returns a completeness score, quality score, or missing-required-fields list.
- **Expected Behavior**: Return engine-computed `completenessScore` / `qualityScore` and `missingFields` if quality display or filtering is desired.
- **Frontend Impact**: No quality or completeness scores are computed or displayed in the frontend.

### 4.6 No Structured `field:value` or Natural-Language Search Parameters
- **Endpoint**: `GET /api/v1/explorer/search`
- **Observed Behavior**:
  - `ExplorerController.search` only accepts `query`, `entityType`, `page`, `size`, `sortBy`, and `sortDirection`.
  - `GoldenRecordRepository.searchByPropertiesAndTypes` performs a case-insensitive substring `LIKE %:query%` across `canonical_name` and `CAST(properties AS text)`. It does not parse structured `field:value` filters (e.g., `country:US`) or natural-language queries.
- **Expected Behavior**: Support structured property filters (e.g., `filter=country:US` or JSONB path matching `properties->>'country' = 'US'`) and/or natural-language query parsing if NL search is desired.
- **Frontend Impact**: The search bar parses `field:value` tokens into removable chips; `type:<EntityType>` / `entityType:<EntityType>` maps directly to `entityType`, and other `field:value` chips pass their value into the existing `query` parameter. Natural-language search is not claimed or simulated.

### 4.7 Zero-Record Ontology Entity Types (`Customers100000`, `Diabetes Large D...`, etc.)
- **Endpoints**:
  - `GET /api/v1/ontology/entity-types`
  - `GET /api/v1/explorer/search`
- **Observed Behavior**:
  - `GET /api/v1/ontology/entity-types` returns stale/unused entity types with `0` records in `golden_records` (such as `"Customers100000"`, `"Diabetes Large D..."`, and other previously uploaded dataset names auto-registered as entity types).
  - `GET /api/v1/explorer/search` facets only include counts for types present in `golden_records`, leaving all other ontology types with count `0`.
- **Expected Behavior**: Dataset filenames should not be left behind as empty ontology entity types, or `/api/v1/ontology/entity-types` should optionally support `includeEmpty=false` / return entity counts directly.
- **Frontend Impact**: Entity types with `0` records are hidden by default behind a `"Show empty types ({n})"` toggle in the Filters panel.

### 4.8 Data Anomaly: Existing 60 Entities Appear to Be Earlier Test Data
- **Endpoint**: `GET /api/v1/explorer/search`
- **Observed Behavior**: The 60 golden records currently returned by `/api/v1/explorer/search` appear to be earlier seeded/test records rather than records ingested from the hospital patients file.
- **Expected Behavior**: Confirm that the hospital patients ingestion pipeline has completed and published resolved `GoldenRecord` entries into the active tenant schema, and clear or isolate earlier test seed records if they should not appear alongside hospital patient data.
