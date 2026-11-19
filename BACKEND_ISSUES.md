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
