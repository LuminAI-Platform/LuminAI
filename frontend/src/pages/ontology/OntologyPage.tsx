import React from "react";
import { PageHeader } from "../../components/layout/PageHeader";
import { EntityTypeEditor } from "../../features/ontology/components/EntityTypeEditor";
import { RelationshipTypeForm } from "../../features/ontology/components/RelationshipTypeForm";
import {
  useOntologyData,
  type Tab,
  type EntityType,
  type RelationshipType,
} from "./useOntologyData";
import { EntityTypesTab } from "./EntityTypesTab";
import { RelationshipsTab } from "./RelationshipsTab";
import { VersionsTab } from "./VersionsTab";
import { Icons, Loader2, PenLine, ICON_SIZES } from "../../lib/icons";
import { OntologyStatsBar } from "./OntologyStatsBar";

export const OntologyPage: React.FC = () => {
  const {
    tab,
    handleTabChange,
    entities,
    setEntities,
    relationships,
    setRelationships,
    versions,
    loading,
    error,
    setError,
    entityEditorOpen,
    setEntityEditorOpen,
    editingEntity,
    setEditingEntity,
    relFormOpen,
    setRelFormOpen,
    editingRel,
    setEditingRel,
    publishing,
    deleteEntity,
    deleteRelationship,
    publishVersion,
  } = useOntologyData();

  const entityName = (id: string) =>
    entities.find((e) => e.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-0 h-full overflow-hidden">
      <div className="pb-4 shrink-0">
        <PageHeader
          breadcrumbs={[
            { label: "Configuration", to: "/ontology" },
            { label: "Ontology Manager" },
          ]}
          title="Ontology Schema Manager"
          description="Define entity types, typed properties, validation constraints, and directional relationships."
          icon={
            <Icons.OntologyManager
              size={ICON_SIZES.header}
              className="text-primary"
              aria-hidden="true"
            />
          }
          badge={
            entities.length > 0 || versions.length > 0
              ? { label: "Active Schema", variant: "purple" }
              : { label: "Empty Schema", variant: "zinc" }
          }
          actions={
            <button
              id="publish-ontology-btn"
              onClick={publishVersion}
              disabled={publishing}
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-primary-text bg-primary hover:bg-primary-hover border border-primary rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {publishing ? (
                <Loader2
                  size={ICON_SIZES.inline}
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <PenLine size={ICON_SIZES.inline} aria-hidden="true" />
              )}
              {publishing ? "Publishing…" : "Publish Version"}
            </button>
          }
        />
      </div>

      <OntologyStatsBar entities={entities} relationships={relationships} />

      <div className="flex border-b border-zinc-800/80 shrink-0 mb-5">
        {(["entities", "relationships", "versions"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => handleTabChange(t)}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t === "entities"
              ? `Entity Types (${entities.length})`
              : t === "relationships"
                ? `Relationship Types (${relationships.length})`
                : `Versions (${versions.length})`}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center justify-between p-3 mb-4 bg-error-bg border border-error-border rounded-lg text-xs text-error shrink-0">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-error hover:text-error/80 cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0 pr-1">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-zinc-500 text-xs">
            <Loader2
              size={ICON_SIZES.header}
              className="animate-spin text-primary mr-2"
            />
            Loading schema…
          </div>
        ) : (
          <>
            {tab === "entities" && (
              <EntityTypesTab
                entities={entities}
                loading={loading}
                onNewEntity={() => {
                  setEditingEntity(undefined);
                  setEntityEditorOpen(true);
                }}
                onEditEntity={(e: EntityType) => {
                  setEditingEntity(e);
                  setEntityEditorOpen(true);
                }}
                onDeleteEntity={deleteEntity}
              />
            )}

            {tab === "relationships" && (
              <RelationshipsTab
                relationships={relationships}
                loading={loading}
                entityName={entityName}
                onNewRelationship={() => {
                  setEditingRel(undefined);
                  setRelFormOpen(true);
                }}
                onEditRelationship={(r: RelationshipType) => {
                  setEditingRel(r);
                  setRelFormOpen(true);
                }}
                onDeleteRelationship={deleteRelationship}
              />
            )}

            {tab === "versions" && <VersionsTab versions={versions} />}
          </>
        )}
      </div>

      {entityEditorOpen && (
        <EntityTypeEditor
          isOpen={entityEditorOpen}
          onClose={() => {
            setEntityEditorOpen(false);
            setEditingEntity(undefined);
          }}
          initialEntity={editingEntity}
          onSave={(entity) => {
            if (editingEntity) {
              setEntities((prev) =>
                prev.map((e) => (e.id === entity.id ? entity : e)),
              );
            } else {
              setEntities((prev) => [...prev, entity]);
            }
            setEntityEditorOpen(false);
            setEditingEntity(undefined);
          }}
        />
      )}

      {relFormOpen && (
        <RelationshipTypeForm
          initial={editingRel}
          onClose={() => {
            setRelFormOpen(false);
            setEditingRel(undefined);
          }}
          onSaved={(rel: RelationshipType) => {
            if (editingRel) {
              setRelationships((prev) =>
                prev.map((r) => (r.id === rel.id ? rel : r)),
              );
            } else {
              setRelationships((prev) => [...prev, rel]);
            }
            setRelFormOpen(false);
            setEditingRel(undefined);
          }}
        />
      )}
    </div>
  );
};

export default OntologyPage;
