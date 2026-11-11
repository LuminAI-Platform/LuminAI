import { useState, useEffect } from "react";
import { apiFetch } from "../../../lib/api";
import type { SchemaMappingPayload } from "../../../features/connections/components/VisualSchemaMapper";

export interface RawDbMapping {
  id?: string;
  connectorId?: string;
  name?: string;
  sourceColumn?: string;
  targetEntityType?: string;
  targetProperty?: string;
  createdAt?: string;
}

export function useSavedMappings() {
  const [savedMappings, setSavedMappings] = useState<SchemaMappingPayload[]>(
    [],
  );
  const [rawDbMappings, setRawDbMappings] = useState<RawDbMapping[]>([]);

  useEffect(() => {
    const fetchSavedMappings = async () => {
      try {
        const res = await apiFetch("/api/v1/schema-mappings");
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            setRawDbMappings(list);
            const groups: Record<string, SchemaMappingPayload> = {};
            for (const item of list) {
              const connId = String(
                item.connectorId ?? item.connectionId ?? "",
              );
              const targetEnt = String(
                item.targetEntityType ?? item.targetEntity ?? "Entity",
              );
              const rawName = String(
                item.name ?? item.sourceColumn ?? "source_table",
              );
              const table = rawName.includes(" - ")
                ? rawName.split(" - ")[0]
                : rawName;
              const groupKey = `${connId}_${targetEnt}_${table}`;

              if (!groups[groupKey]) {
                groups[groupKey] = {
                  connectionId: connId ? `conn_${connId}` : "",
                  sourceTable: table,
                  targetEntity: targetEnt,
                  mappings: [],
                  createdAt: String(item.createdAt ?? new Date().toISOString()),
                };
              }

              groups[groupKey].mappings.push({
                sourceColumnId: String(item.sourceColumn ?? ""),
                ontologyPropertyId: String(item.targetProperty ?? ""),
              });
            }
            setSavedMappings(Object.values(groups));
          }
        }
      } catch {
        // ignore
      }
    };
    fetchSavedMappings();
  }, []);

  return { savedMappings, setSavedMappings, rawDbMappings, setRawDbMappings };
}
