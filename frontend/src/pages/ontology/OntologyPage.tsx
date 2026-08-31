import React, { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../../lib/api";
import {
  EntityTypeEditor,
  EntityIcon,
} from "../../features/ontology/components/EntityTypeEditor";
import type { EntityType } from "../../features/ontology/components/EntityTypeEditor";
import { RelationshipTypeForm } from "../../features/ontology/components/RelationshipTypeForm";
import type { RelationshipType } from "../../features/ontology/components/RelationshipTypeForm";

type Tab = "entities" | "relationships" | "versions";

interface OntologyVersion {
  id: string;
  version: string;
  publishedAt: string;
  publishedBy: string;
  status: "DRAFT" | "PUBLISHED" | "DEPRECATED";
}

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

const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  sub: string;
  action?: React.ReactNode;
}> = ({ icon, title, sub, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-950/40">
    <div className="text-zinc-600 mb-3">{icon}</div>
    <span className="text-sm font-semibold text-zinc-400">{title}</span>
    <span className="text-xs text-zinc-600 mt-1 mb-4">{sub}</span>
    {action}
  </div>
);

export const OntologyPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>("entities");
  const [entities, setEntities] = useState<EntityType[]>([]);
  const [relationships, setRelationships] = useState<RelationshipType[]>([]);
  const [versions, setVersions] = useState<OntologyVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [entityEditorOpen, setEntityEditorOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<EntityType | undefined>();
  const [relFormOpen, setRelFormOpen] = useState(false);
  const [editingRel, setEditingRel] = useState<RelationshipType | undefined>();
  const [publishing, setPublishing] = useState(false);

  const loadEntities = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/ontology/entity-types");
      const data = (await res.json()) as unknown;
      setEntities(Array.isArray(data) ? (data as EntityType[]) : []);
    } catch {
      setError("Failed to load entity types.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRelationships = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/ontology/relationship-types");
      const data = (await res.json()) as unknown;
      setRelationships(Array.isArray(data) ? (data as RelationshipType[]) : []);
    } catch {
      setError("Failed to load relationship types.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadVersions = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/ontology/versions");
      const data = (await res.json()) as unknown;
      setVersions(Array.isArray(data) ? (data as OntologyVersion[]) : []);
    } catch {
      setError("Failed to load ontology versions.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTabChange = (newTab: Tab) => {
    if (newTab === tab) return;
    setTab(newTab);
    setLoading(true);
    setError(null);
  };

  useEffect(() => {
    const init = async () => {
      if (tab === "entities") await loadEntities();
      else if (tab === "relationships") await loadRelationships();
      else if (tab === "versions") await loadVersions();
    };
    init();
  }, [tab, loadEntities, loadRelationships, loadVersions]);

  const deleteEntity = async (id: string) => {
    if (!confirm("Delete this entity type? This cannot be undone.")) return;
    try {
      await apiFetch(`/api/v1/ontology/entity-types/${id}`, {
        method: "DELETE",
      });
      setEntities((prev) => prev.filter((e) => e.id !== id));
    } catch {
      setError("Failed to delete entity type.");
    }
  };

  const deleteRelationship = async (id: string) => {
    if (!confirm("Delete this relationship type?")) return;
    try {
      await apiFetch(`/api/v1/ontology/relationship-types/${id}`, {
        method: "DELETE",
      });
      setRelationships((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError("Failed to delete relationship type.");
    }
  };

  const publishVersion = async () => {
    setPublishing(true);
    try {
      const res = await apiFetch("/api/v1/ontology/versions", {
        method: "POST",
      });
      const v = (await res.json()) as OntologyVersion;
      setVersions((prev) => [v, ...prev]);
      setTab("versions");
      setLoading(false);
    } catch {
      setError("Failed to publish ontology version.");
    } finally {
      setPublishing(false);
    }
  };

  const entityName = (id: string) =>
    entities.find((e) => e.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-0 h-full overflow-hidden">
      {/* Page Header */}
      <div className="flex items-start justify-between pb-5 shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            Ontology Schema Editor
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Define entity types, properties, and relationship topology for the
            knowledge graph
          </p>
        </div>
        <button
          id="publish-ontology-btn"
          onClick={publishVersion}
          disabled={publishing}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-600 border border-emerald-600/40 rounded-lg shadow-lg shadow-emerald-500/10 transition-all cursor-pointer disabled:opacity-50"
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
            className="flex items-center gap-3 px-4 py-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl"
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
              ? `Entity Types`
              : t === "relationships"
                ? "Relationship Types"
                : "Published Versions"}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-950/30 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center justify-between shrink-0">
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
        {/* ── ENTITY TYPES ── */}
        {tab === "entities" && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <button
                id="new-entity-btn"
                type="button"
                onClick={() => {
                  setEditingEntity(undefined);
                  setEntityEditorOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 border border-blue-500/40 rounded-lg shadow-lg shadow-blue-500/10 transition-all cursor-pointer"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New Entity Type
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-zinc-500 text-xs">
                <Spinner />
                <span>Loading entity types…</span>
              </div>
            ) : entities.length === 0 ? (
              <EmptyState
                icon={
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M6 20v-2a6 6 0 0 1 12 0v2" />
                  </svg>
                }
                title="No entity types defined yet"
                sub="Create your first entity type to start modelling your domain"
                action={
                  <button
                    onClick={() => {
                      setEditingEntity(undefined);
                      setEntityEditorOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 border border-blue-500/40 rounded-lg transition-all cursor-pointer"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Create Entity Type
                  </button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {entities.map((entity) => (
                  <div
                    key={entity.id ?? entity.name}
                    className="group relative bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 flex flex-col gap-3 hover:border-zinc-700/80 transition-all hover:shadow-xl hover:shadow-black/30"
                  >
                    {/* Card header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center border-2 shrink-0"
                          style={{
                            backgroundColor: `${entity.color ?? "#3b82f6"}18`,
                            borderColor: `${entity.color ?? "#3b82f6"}35`,
                            color: entity.color ?? "#3b82f6",
                          }}
                        >
                          <EntityIcon
                            iconKey={entity.icon ?? "package"}
                            size={18}
                          />
                        </div>
                        <div>
                          <span className="text-sm font-bold text-zinc-100 block leading-tight">
                            {entity.label || entity.name}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500 block mt-0.5">
                            {entity.name}
                          </span>
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          id={`edit-entity-${entity.id}`}
                          type="button"
                          onClick={() => {
                            setEditingEntity(entity);
                            setEntityEditorOpen(true);
                          }}
                          className="p-1.5 text-zinc-500 hover:text-blue-400 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                          title="Edit"
                        >
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        {entity.id && (
                          <button
                            id={`delete-entity-${entity.id}`}
                            type="button"
                            onClick={() => deleteEntity(entity.id!)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                            title="Delete"
                          >
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    {entity.description && (
                      <p className="text-[11px] text-zinc-500 leading-normal line-clamp-2">
                        {entity.description}
                      </p>
                    )}

                    {/* Properties chips */}
                    {entity.properties && entity.properties.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {entity.properties.slice(0, 5).map((p) => (
                          <span
                            key={p.id}
                            className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700/50"
                          >
                            {p.name}:{p.type.slice(0, 3)}
                          </span>
                        ))}
                        {entity.properties.length > 5 && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-500">
                            +{entity.properties.length - 5} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 mt-auto">
                      <span className="text-[10px] text-zinc-600">
                        {entity.properties?.length ?? 0} propert
                        {(entity.properties?.length ?? 0) === 1 ? "y" : "ies"}
                      </span>
                      {entity.version && (
                        <span className="text-[9px] font-medium text-zinc-600 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
                          v{entity.version}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── RELATIONSHIP TYPES ── */}
        {tab === "relationships" && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <button
                id="new-relationship-btn"
                type="button"
                onClick={() => {
                  setEditingRel(undefined);
                  setRelFormOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 border border-purple-500/40 rounded-lg shadow-lg shadow-purple-500/10 transition-all cursor-pointer"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New Relationship Type
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-zinc-500 text-xs">
                <Spinner />
                <span>Loading…</span>
              </div>
            ) : relationships.length === 0 ? (
              <EmptyState
                icon={
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="13 6 19 12 13 18" />
                  </svg>
                }
                title="No relationship types defined"
                sub="Define how entity types connect in the knowledge graph"
                action={
                  <button
                    onClick={() => {
                      setEditingRel(undefined);
                      setRelFormOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 border border-purple-500/40 rounded-lg transition-all cursor-pointer"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Create Relationship Type
                  </button>
                }
              />
            ) : (
              <div className="border border-zinc-800/80 rounded-2xl overflow-hidden bg-zinc-950/40">
                <div className="grid grid-cols-12 bg-zinc-900/60 px-5 py-3 border-b border-zinc-800/80 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  <div className="col-span-3">Name</div>
                  <div className="col-span-4">Endpoints</div>
                  <div className="col-span-2">Cardinality</div>
                  <div className="col-span-2">Direction</div>
                  <div className="col-span-1 text-right">Actions</div>
                </div>
                <div className="divide-y divide-zinc-900">
                  {relationships.map((rel) => (
                    <div
                      key={rel.id ?? rel.name}
                      className="group grid grid-cols-12 px-5 py-3.5 items-center hover:bg-zinc-900/30 transition-all text-xs"
                    >
                      <div className="col-span-3">
                        <span className="font-bold font-mono text-purple-400">
                          {rel.name}
                        </span>
                        <span className="block text-[10px] text-zinc-500 mt-0.5">
                          {rel.label}
                        </span>
                      </div>
                      <div className="col-span-4 flex items-center gap-2">
                        <span className="font-semibold text-zinc-300 text-[11px]">
                          {entityName(rel.sourceEntityTypeId)}
                        </span>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-purple-500 shrink-0"
                        >
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="13 6 19 12 13 18" />
                        </svg>
                        <span className="font-semibold text-zinc-300 text-[11px]">
                          {entityName(rel.targetEntityTypeId)}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="font-mono font-bold text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          {rel.cardinality.replace(/_/g, ":")}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${rel.directed ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-zinc-800 text-zinc-500 border-zinc-700"}`}
                        >
                          {rel.directed ? "Directed" : "Undirected"}
                        </span>
                      </div>
                      <div className="col-span-1 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          id={`edit-rel-${rel.id}`}
                          type="button"
                          onClick={() => {
                            setEditingRel(rel);
                            setRelFormOpen(true);
                          }}
                          className="p-1.5 text-zinc-500 hover:text-purple-400 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        {rel.id && (
                          <button
                            id={`delete-rel-${rel.id}`}
                            type="button"
                            onClick={() => deleteRelationship(rel.id!)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PUBLISHED VERSIONS ── */}
        {tab === "versions" && (
          <div className="flex flex-col gap-4">
            {versions.length === 0 ? (
              <EmptyState
                icon={
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                }
                title="No versions published yet"
                sub='Click "Publish Version" to snapshot the current ontology schema'
              />
            ) : (
              <div className="border border-zinc-800/80 rounded-2xl overflow-hidden bg-zinc-950/40">
                <div className="grid grid-cols-12 bg-zinc-900/60 px-5 py-3 border-b border-zinc-800/80 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  <div className="col-span-3">Version</div>
                  <div className="col-span-4">Published At</div>
                  <div className="col-span-3">Published By</div>
                  <div className="col-span-2">Status</div>
                </div>
                <div className="divide-y divide-zinc-900">
                  {versions.map((v) => (
                    <div
                      key={v.id}
                      className="grid grid-cols-12 px-5 py-3.5 items-center text-xs hover:bg-zinc-900/30 transition-all"
                    >
                      <div className="col-span-3 font-bold font-mono text-zinc-200">
                        {v.version}
                      </div>
                      <div className="col-span-4 text-zinc-500">
                        {v.publishedAt}
                      </div>
                      <div className="col-span-3 text-zinc-400">
                        {v.publishedBy}
                      </div>
                      <div className="col-span-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            v.status === "PUBLISHED"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : v.status === "DEPRECATED"
                                ? "bg-red-500/10 text-red-400 border-red-500/20"
                                : "bg-zinc-800 text-zinc-500 border-zinc-700"
                          }`}
                        >
                          {v.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
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
