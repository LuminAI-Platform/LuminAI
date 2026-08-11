## Sprint 3 — Ontology + Graph + Explorer

- **Role:** Frontend Developer
- **Primary Focus:** Ontology Editor UI, Explorer Search & Faceted Filter UI, and Entity Detail Page with Provenance Lineage.
- **Working Directory:** `frontend/`
- **Language:** TypeScript 5 + React 19 + Vite + Tailwind CSS v4
- **Total Load:** 18 SP (3 tasks)

---

## 📋 Assigned Tasks

---

### TASK S3-11: Ontology UI — Entity & Relationship Type Editor (5 pts)
* **Goal:** Build visual Ontology Schema Editor allowing data stewards to define entity types, add property schemas (type, required, default), configure relationship types, and publish ontology versions.
* **Branch:** `feature/S3-11-ontology-editor-ui`
* **Target Files:**
  * `src/features/ontology/components/EntityTypeEditor.tsx`
  * `src/features/ontology/components/PropertySchemaForm.tsx`
  * `src/features/ontology/components/RelationshipTypeForm.tsx`
  * `src/pages/ontology/OntologyPage.tsx`

#### Acceptance Criteria
- [ ] Users can create/edit entity types and custom properties visually.
- [ ] Connects to `/api/v1/ontology/entity-types` and `/api/v1/ontology/relationship-types`.

---

### TASK S3-12: Explorer UI — Global Search, Cards & Faceted Filters (8 pts)
* **Goal:** Build Explorer search view featuring instant search bar with auto-complete, entity type facet filters, paginated entity cards, and highlighted search match snippets.
* **Branch:** `feature/S3-12-explorer-search-ui`
* **Target Files:**
  * `src/features/explorer/components/SearchBar.tsx`
  * `src/features/explorer/components/EntityCard.tsx`
  * `src/features/explorer/components/FacetFilterSidebar.tsx`
  * `src/pages/explorer/ExplorerPage.tsx`

#### Acceptance Criteria
- [ ] Search bar queries `/api/v1/explorer/search` and renders paginated cards.
- [ ] Selecting facet checkboxes filters search results dynamically.

---

### TASK S3-13: Entity Detail View — Properties, Provenance & Graph Launcher (5 pts)
* **Goal:** Build comprehensive Entity Detail view displaying canonical entity attributes, property-level provenance lineage (which raw dataset contributed each value), and button to open entity in Graph Visualizer.
* **Branch:** `feature/S3-13-entity-detail-ui`
* **Target Files:**
  * `src/features/explorer/components/EntityPropertyTable.tsx`
  * `src/features/explorer/components/ProvenanceInspector.tsx`
  * `src/pages/explorer/EntityDetailPage.tsx`

#### Acceptance Criteria
- [ ] Property table displays source lineage tooltip / drawer for each attribute.
- [ ] Includes "Explore Graph" action button passing entity ID to Graph view.
