import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../../lib/api";
import type { EntityType } from "../../features/ontology/components/EntityTypeEditor";
import type { RelationshipType } from "../../features/ontology/components/RelationshipTypeForm";

export type { EntityType, RelationshipType };

export type Tab = "entities" | "relationships" | "versions";

export interface OntologyVersion {
  id: string;
  version: string;
  publishedAt: string;
  publishedBy: string;
  status: "DRAFT" | "PUBLISHED" | "DEPRECATED";
}

export function useOntologyData() {
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

  const normalizeVersion = (raw: Record<string, unknown>): OntologyVersion => ({
    id: String(raw.id ?? ""),
    version: String(raw.version ?? ""),
    publishedAt: raw.publishedAt
      ? new Date(String(raw.publishedAt)).toLocaleString()
      : "—",
    publishedBy: String(raw.publishedBy || raw.createdBy || "—"),
    status: (raw.status as OntologyVersion["status"]) || "PUBLISHED",
  });

  const loadEntities = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/ontology/entity-types");
      const data = (await res.json()) as unknown;
      setEntities(Array.isArray(data) ? (data as EntityType[]) : []);
    } catch {
      setError("Failed to load entity types.");
    }
  }, []);

  const loadRelationships = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/ontology/relationship-types");
      const data = (await res.json()) as unknown;
      setRelationships(Array.isArray(data) ? (data as RelationshipType[]) : []);
    } catch {
      setError("Failed to load relationship types.");
    }
  }, []);

  const loadVersions = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/ontology/versions");
      const data = (await res.json()) as unknown;
      setVersions(
        Array.isArray(data)
          ? (data as Record<string, unknown>[]).map(normalizeVersion)
          : [],
      );
    } catch {
      setError("Failed to load ontology versions.");
    }
  }, []);

  const reloadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([loadEntities(), loadRelationships(), loadVersions()]);
    setLoading(false);
  }, [loadEntities, loadRelationships, loadVersions]);

  const handleTabChange = (newTab: Tab) => {
    if (newTab === tab) return;
    setTab(newTab);
    setError(null);
  };

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

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
      let existingVersions = versions;
      if (existingVersions.length === 0) {
        const listRes = await apiFetch("/api/v1/ontology/versions");
        if (listRes.ok) {
          const data = await listRes.json();
          existingVersions = Array.isArray(data) ? data : [];
          setVersions(existingVersions);
        }
      }
      const nextVer = `v${existingVersions.length + 1}.0.0`;
      const res = await apiFetch("/api/v1/ontology/versions", {
        method: "POST",
        body: JSON.stringify({
          version: nextVer,
          changelog: `Ontology schema release ${nextVer}`,
        }),
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

  return {
    tab,
    setTab,
    handleTabChange,
    entities,
    setEntities,
    relationships,
    setRelationships,
    versions,
    setVersions,
    reloadAll,
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
  };
}
