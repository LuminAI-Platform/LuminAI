import { useState, useEffect } from "react";
import { useToast } from "../../../../components/ui/ToastProvider";
import {
  type SourceColumn,
  type ForeignKeyDefinition,
  inferDefaultRelationship,
} from "./visualSchemaTypes";

function mapForeignKeysToColumns(
  items: ForeignKeyDefinition[],
  sourceColumns: SourceColumn[],
): Record<string, ForeignKeyDefinition> {
  const mapped: Record<string, ForeignKeyDefinition> = {};
  for (const fk of items) {
    if (!fk) continue;
    const matchedCol =
      sourceColumns.find((c) => c.id === fk.columnId) ??
      sourceColumns.find(
        (c) => c.name.toLowerCase() === (fk.columnName || "").toLowerCase(),
      );
    const resolvedColId = matchedCol?.id ?? fk.columnId;
    if (!resolvedColId) continue;
    mapped[resolvedColId] = {
      ...fk,
      columnId: resolvedColId,
      columnName: matchedCol?.name ?? fk.columnName,
      direction: fk.direction || "OUTGOING",
    };
  }
  return mapped;
}

export function reconcileForeignKeys(
  initialForeignKeys: ForeignKeyDefinition[],
  sourceColumns: SourceColumn[],
  storedRaw?: string | null,
): Record<string, ForeignKeyDefinition> {
  const backendMap = mapForeignKeysToColumns(initialForeignKeys, sourceColumns);
  let localList: ForeignKeyDefinition[] = [];
  if (storedRaw) {
    try {
      const parsed = JSON.parse(storedRaw);
      if (Array.isArray(parsed)) {
        localList = parsed.filter((fk): fk is ForeignKeyDefinition =>
          Boolean(fk && typeof fk === "object" && fk.columnId),
        );
      } else if (typeof parsed === "object" && parsed !== null) {
        localList = Object.values(
          parsed as Record<string, ForeignKeyDefinition>,
        );
      }
    } catch {
      // ignore malformed cached entry
    }
  }
  const localMap = mapForeignKeysToColumns(localList, sourceColumns);
  return { ...backendMap, ...localMap };
}

interface UseForeignKeyStateProps {
  connectionId: string;
  sourceColumns: SourceColumn[];
  availableEntities: string[];
  availableRelationshipTypes: string[];
  initialForeignKeys?: ForeignKeyDefinition[];
}

export function useForeignKeyState({
  connectionId,
  sourceColumns,
  availableEntities,
  availableRelationshipTypes,
  initialForeignKeys = [],
}: UseForeignKeyStateProps) {
  const toast = useToast();
  const [foreignKeys, setForeignKeys] = useState<
    Record<string, ForeignKeyDefinition>
  >(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(`lumin_fk_${connectionId}`);
    } catch {
      // ignore
    }
    return reconcileForeignKeys(initialForeignKeys, sourceColumns, stored);
  });

  useEffect(() => {
    if (initialForeignKeys.length === 0) return;
    const backendMap = mapForeignKeysToColumns(
      initialForeignKeys,
      sourceColumns,
    );
    setForeignKeys((prev) => ({ ...backendMap, ...prev }));
  }, [initialForeignKeys, sourceColumns]);

  const [activeFkColId, setActiveFkColId] = useState<string | null>(null);
  const [fkTargetEntity, setFkTargetEntity] = useState<string>(
    availableEntities[0] ?? "",
  );
  const [fkRelType, setFkRelType] = useState<string>(
    availableRelationshipTypes[0] ?? "",
  );
  const [fkDirection, setFkDirection] = useState<"OUTGOING" | "INCOMING">(
    "OUTGOING",
  );
  const [isCustomEntity, setIsCustomEntity] = useState(false);
  const [isCustomRel, setIsCustomRel] = useState(false);

  const openFkModal = (col: SourceColumn) => {
    const existing = foreignKeys[col.id];
    if (existing) {
      setFkTargetEntity(existing.targetEntityType);
      setFkRelType(existing.relationshipType);
      setFkDirection(existing.direction);
      setIsCustomEntity(!availableEntities.includes(existing.targetEntityType));
      setIsCustomRel(
        !availableRelationshipTypes.includes(existing.relationshipType),
      );
    } else {
      const inferred = inferDefaultRelationship(
        col.name,
        availableEntities,
        availableRelationshipTypes,
      );
      setFkTargetEntity(inferred.target);
      setFkRelType(inferred.rel);
      setFkDirection("OUTGOING");
      setIsCustomEntity(
        Boolean(inferred.target) &&
          !availableEntities.includes(inferred.target),
      );
      setIsCustomRel(
        Boolean(inferred.rel) &&
          !availableRelationshipTypes.includes(inferred.rel),
      );
    }
    setActiveFkColId(col.id);
  };

  const saveFkModal = () => {
    if (!activeFkColId) return;
    const col = sourceColumns.find((c) => c.id === activeFkColId);
    if (!col) return;

    const targetType = fkTargetEntity.trim() || "Entity";
    const relType =
      fkRelType.trim().toUpperCase().replace(/\s+/g, "_") || "LINKED_TO";

    const newFk: ForeignKeyDefinition = {
      columnId: activeFkColId,
      columnName: col.name,
      targetEntityType: targetType,
      relationshipType: relType,
      direction: fkDirection,
    };

    setForeignKeys((prev) => {
      const next = { ...prev, [activeFkColId]: newFk };
      try {
        localStorage.setItem(
          `lumin_fk_${connectionId}`,
          JSON.stringify(Object.values(next)),
        );
      } catch {
        // ignore
      }
      return next;
    });

    toast.info(
      "Graph Link Configured",
      `Linked ${col.name} → ${targetType} via ${relType}`,
    );
    setActiveFkColId(null);
  };

  const removeFk = (colId: string) => {
    const colName = sourceColumns.find((c) => c.id === colId)?.name ?? colId;
    setForeignKeys((prev) => {
      const next = { ...prev };
      delete next[colId];
      try {
        localStorage.setItem(
          `lumin_fk_${connectionId}`,
          JSON.stringify(Object.values(next)),
        );
      } catch {
        // ignore
      }
      return next;
    });
    if (activeFkColId === colId) setActiveFkColId(null);
    toast.info(
      "Graph Link Removed",
      `Removed relationship link for ${colName}`,
    );
  };

  return {
    foreignKeys,
    activeFkColId,
    setActiveFkColId,
    fkTargetEntity,
    setFkTargetEntity,
    fkRelType,
    setFkRelType,
    fkDirection,
    setFkDirection,
    isCustomEntity,
    setIsCustomEntity,
    isCustomRel,
    setIsCustomRel,
    openFkModal,
    saveFkModal,
    removeFk,
  };
}
