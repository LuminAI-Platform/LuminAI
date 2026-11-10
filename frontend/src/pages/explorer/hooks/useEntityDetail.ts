import React, { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../../../lib/api";
import type { ProvenanceLine } from "../../../features/explorer/components/EntityPropertyTable";
import type { EntityDetail, UseEntityDetailResult } from "../types";

/**
 * Custom React hook grouping entity details fetching, provenance history,
 * loading/error states, and active property inspector key.
 */
export function useEntityDetail(entityId?: string): UseEntityDetailResult {
  const [entity, setEntity] = useState<EntityDetail | null>(null);
  const [provenance, setProvenance] = useState<ProvenanceLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeProvenanceKey, setActiveProvenanceKey] = useState<string | null>(
    null,
  );

  const fetchEntityAndProvenance = useCallback(async () => {
    if (!entityId) return;

    setLoading(true);
    setError(null);
    try {
      const [entityRes, provRes] = await Promise.allSettled([
        apiFetch(`/api/v1/explorer/entities/${entityId}`),
        apiFetch(`/api/v1/explorer/entities/${entityId}/provenance`),
      ]);

      if (entityRes.status === "fulfilled" && entityRes.value.ok) {
        const entityData: EntityDetail = await entityRes.value.json();
        setEntity(entityData);
      } else {
        setError(`Entity "${entityId}" could not be found.`);
      }

      if (provRes.status === "fulfilled" && provRes.value.ok) {
        const provData: ProvenanceLine[] = await provRes.value.json();
        setProvenance(Array.isArray(provData) ? provData : []);
      } else {
        setProvenance([]);
      }
    } catch {
      setError(`Entity "${entityId}" could not be found.`);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    if (entityId) {
      void fetchEntityAndProvenance();
    }
  }, [entityId, fetchEntityAndProvenance]);

  return {
    entity,
    provenance,
    loading,
    error,
    activeProvenanceKey,
    setActiveProvenanceKey,
    refetch: fetchEntityAndProvenance,
  };
}
