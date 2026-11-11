import { useState, useEffect } from "react";
import { apiFetch } from "../../../../lib/api";
import { useToast } from "../../../../components/ui/ToastProvider";
import {
  type SourceColumn,
  type OntologyProperty,
  type SchemaMapping,
  type ForeignKeyDefinition,
  type SchemaMappingPayload,
  DEFAULT_TARGET_ENTITIES,
  DEFAULT_RELATION_TYPES,
} from "./visualSchemaTypes";
import { useForeignKeyState } from "./useForeignKeyState";
import { useConnectorLines } from "./useConnectorLines";

interface UseSchemaMapperProps {
  connectionId?: string;
  sourceTable?: string;
  sourceColumns: SourceColumn[];
  ontologyProperties: OntologyProperty[];
  availableEntities?: string[];
  availableRelationshipTypes?: string[];
  initialMappings?: SchemaMapping[];
  initialForeignKeys?: ForeignKeyDefinition[];
  onSave?: (payload: SchemaMappingPayload) => void;
}

export function useSchemaMapper({
  connectionId = "conn_default",
  sourceTable = "raw_source",
  sourceColumns,
  ontologyProperties,
  availableEntities = DEFAULT_TARGET_ENTITIES,
  availableRelationshipTypes = DEFAULT_RELATION_TYPES,
  initialMappings = [],
  initialForeignKeys = [],
  onSave,
}: UseSchemaMapperProps) {
  const toast = useToast();
  const [mappings, setMappings] = useState<SchemaMapping[]>(() => {
    if (initialMappings && initialMappings.length > 0) return initialMappings;
    try {
      const stored =
        localStorage.getItem(`lumin_mapping_${connectionId}_${sourceTable}`) ||
        localStorage.getItem(`lumin_mapping_${sourceTable}`) ||
        localStorage.getItem("lumin_schema_mapping");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        if (
          parsed &&
          Array.isArray(parsed.mappings) &&
          parsed.mappings.length > 0
        ) {
          return parsed.mappings;
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    if (initialMappings && initialMappings.length > 0)
      setMappings(initialMappings);
  }, [initialMappings]);

  const fkState = useForeignKeyState({
    connectionId,
    sourceColumns,
    availableEntities,
    availableRelationshipTypes,
    initialForeignKeys,
  });

  const [draggingColId, setDraggingColId] = useState<string | null>(null);
  const [hoverPropId, setHoverPropId] = useState<string | null>(null);
  const [savedPayload, setSavedPayload] = useState<SchemaMappingPayload | null>(
    null,
  );
  const [showPayload, setShowPayload] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const lines = useConnectorLines(mappings, draggingColId, hoverPropId);

  const onDragStart = (colId: string) => setDraggingColId(colId);
  const onDragEnd = () => {
    setDraggingColId(null);
    setHoverPropId(null);
  };

  const onDropOnProp = (propId: string) => {
    if (!draggingColId) return;
    setMappings((prev) => {
      const filtered = prev.filter(
        (m) =>
          m.sourceColumnId !== draggingColId && m.ontologyPropertyId !== propId,
      );
      return [
        ...filtered,
        {
          sourceColumnId: draggingColId,
          ontologyPropertyId: propId,
          transform: "direct",
        },
      ];
    });
    setDraggingColId(null);
    setHoverPropId(null);
    setTimeout(lines.recalcLines, 50);
  };

  const removeMapping = (sourceColumnId: string) => {
    setMappings((prev) =>
      prev.filter((m) => m.sourceColumnId !== sourceColumnId),
    );
    setTimeout(lines.recalcLines, 50);
  };

  const getMappedPropId = (colId: string) =>
    mappings.find((m) => m.sourceColumnId === colId)?.ontologyPropertyId;

  const getMappedColId = (propId: string) =>
    mappings.find((m) => m.ontologyPropertyId === propId)?.sourceColumnId;

  const handleSave = async () => {
    const targetEntityName = ontologyProperties[0]?.entityClass ?? "Entity";
    const fkList = Object.values(fkState.foreignKeys);

    const payload: SchemaMappingPayload = {
      connectionId,
      sourceTable,
      targetEntity: targetEntityName,
      mappings,
      foreignKeys: fkList,
      createdAt: new Date().toISOString(),
    };

    const cleanConnectorId = connectionId.replace(/^conn_/, "");
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        cleanConnectorId,
      );

    setSaveError(null);

    try {
      if (isUuid) {
        for (const m of mappings) {
          const sourceCol =
            sourceColumns.find((c) => c.id === m.sourceColumnId)?.name ??
            m.sourceColumnId;
          const targetProp =
            ontologyProperties.find((p) => p.id === m.ontologyPropertyId)
              ?.name ?? m.ontologyPropertyId;

          const res = await apiFetch("/api/v1/schema-mappings", {
            method: "POST",
            body: JSON.stringify({
              connectorId: cleanConnectorId,
              name: `${sourceTable} - ${sourceCol} Map`,
              sourceColumn: sourceCol,
              targetEntityType: targetEntityName,
              targetProperty: targetProp,
              transformation: "NONE",
            }),
          });
          if (!res.ok) {
            throw new Error(`Failed to save schema mapping: ${res.statusText}`);
          }
        }
      }
      localStorage.setItem("lumin_schema_mapping", JSON.stringify(payload));
      localStorage.setItem(`lumin_fk_${connectionId}`, JSON.stringify(fkList));
      localStorage.setItem(
        `lumin_mapping_${connectionId}_${sourceTable}`,
        JSON.stringify(mappings),
      );
      localStorage.setItem(
        `lumin_mapping_${sourceTable}`,
        JSON.stringify(mappings),
      );
      localStorage.setItem(
        `lumin_mapping_${connectionId}_${targetEntityName}`,
        JSON.stringify(mappings),
      );
      setSavedPayload(payload);
      setSaveSuccess(true);
      onSave?.(payload);

      toast.success(
        "Schema Mapping Saved",
        `Saved ${mappings.length} column mapping${mappings.length === 1 ? "" : "s"} for ${sourceTable}.`,
      );
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to persist mapping";
      setSaveError(msg);
      localStorage.setItem("lumin_schema_mapping", JSON.stringify(payload));
      localStorage.setItem(`lumin_fk_${connectionId}`, JSON.stringify(fkList));
      setSavedPayload(payload);
      toast.error(
        "Schema Mapping Warning",
        `${msg}. Local mapping has been cached.`,
      );
      setTimeout(() => setSaveError(null), 4000);
    }
  };

  const targetEntity = ontologyProperties[0]?.entityClass ?? "Entity";
  const currentPayload: SchemaMappingPayload = {
    connectionId,
    sourceTable,
    targetEntity,
    mappings,
    foreignKeys: Object.values(fkState.foreignKeys),
    createdAt: savedPayload?.createdAt ?? new Date().toISOString(),
  };

  return {
    mappings,
    ...fkState,
    ...lines,
    draggingColId,
    hoverPropId,
    setHoverPropId,
    showPayload,
    setShowPayload,
    saveSuccess,
    saveError,
    onDragStart,
    onDragEnd,
    onDropOnProp,
    removeMapping,
    getMappedPropId,
    getMappedColId,
    handleSave,
    currentPayload,
    targetEntity,
  };
}
