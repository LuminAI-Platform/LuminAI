import React from "react";
import { Boxes } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { EntityTypeEditor } from "../../features/ontology/components/EntityTypeEditor";
import { RelationshipTypeForm } from "../../features/ontology/components/RelationshipTypeForm";
import { useOntologyData, type Tab } from "./useOntologyData";
import { EntityTypesTab } from "./EntityTypesTab";
import { RelationshipsTab } from "./RelationshipsTab";
import { VersionsTab } from "./VersionsTab";

const Spinner = () => (
  <svg
    className="animate-spin"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <path d="M21 12a9 9 0 1 1-6.22-8.56" />
  </svg>
);

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
      {/* Page Header */}
      <div className="pb-4 shrink-0">
        <PageHeader
          breadcrumbs={[
            { label: "Configuration", to: "/ontology" },
            { label: "Ontology Manager" },
          ]}
          title="Ontology Schema Manager"
          description="Define entity types, typed properties, validation constraints, and directional relationships."
          icon={<Boxes className="w-5 h-5 text-indigo-400" />}
          badge={{
            label: "Active Schema",
            variant: "purple",
          }}
          actions={
            <button
              id="publish-ontology-btn"
              onClick={publishVersion}
              disabled={publishing}
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/30 rounded-lg shadow-sm shadow-emerald-950 transition-all cursor-pointer disabled:opacity-50"
            >
              {publishing ? (
                <Spinner />
              ) : (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              )}
              {publishing ? "Publishing…" : "Publish Version"}
            </button>
          }
        />
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-5 shrink-0">
        {[
          {
            label: "Entity Types",
            value: entities.length,
            color: "#3b82f6",
            icon: (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M6 20v-2a6 6 0 0 1 12 0v2" />
              </svg>
            ),
          },
          {
            label: "Relationship Types",
            value: relationships.length,
            color: "#a855f7",
            icon: (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            ),
          },
          {
            label: "Total Properties",
            value: entities.reduce(
              (s, e) => s + (e.properties?.length ?? 0),
              0,
            ),
            color: "#10b981",
            icon: (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
              </svg>
            ),
          },
        ].map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${s.color}18`, color: s.color }}
            >
              {s.icon}
            </div>
            <div>
              <div className="text-lg font-bold text-zinc-100 leading-none">
                {s.value}
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800/80 shrink-0 mb-5">
        {(["entities", "relationships", "versions"] as Tab[]).map((t) => (
          <button
            key={t}
            id={`ontology-tab-${t}`}
            type="button"
            onClick={() => handleTabChange(t)}
            className={`py-2.5 px-5 text-xs font-semibold border-b-2 transition-all cursor-pointer capitalize ${
              tab === t
                ? "border-blue-500 text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t === "entities"
              ? "Entity Types"
              : t === "relationships"
                ? "Relationship Types"
                : "Published Versions"}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-950/30 border border-red-500/20 text-red-400 rounded-lg text-xs flex items-center justify-between shrink-0">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="underline hover:text-red-300 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto pr-1 pb-6">
        {tab === "entities" && (
          <EntityTypesTab
            entities={entities}
            loading={loading}
            onNewEntity={() => {
              setEditingEntity(undefined);
              setEntityEditorOpen(true);
            }}
            onEditEntity={(entity) => {
              setEditingEntity(entity);
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
            onEditRelationship={(rel) => {
              setEditingRel(rel);
              setRelFormOpen(true);
            }}
            onDeleteRelationship={deleteRelationship}
          />
        )}

        {tab === "versions" && <VersionsTab versions={versions} />}
      </div>

      {/* Modals */}
      {entityEditorOpen && (
        <EntityTypeEditor
          initial={editingEntity}
          onClose={() => setEntityEditorOpen(false)}
          onSaved={(saved) => {
            setEntityEditorOpen(false);
            setEntities((prev) => {
              const idx = prev.findIndex((e) => e.id === saved.id);
              return idx >= 0
                ? prev.map((e) => (e.id === saved.id ? saved : e))
                : [saved, ...prev];
            });
          }}
        />
      )}

      {relFormOpen && (
        <RelationshipTypeForm
          initial={editingRel}
          onClose={() => setRelFormOpen(false)}
          onSaved={(saved) => {
            setRelFormOpen(false);
            setRelationships((prev) => {
              const idx = prev.findIndex((r) => r.id === saved.id);
              return idx >= 0
                ? prev.map((r) => (r.id === saved.id ? saved : r))
                : [saved, ...prev];
            });
          }}
        />
      )}
    </div>
  );
};
