import { useState } from "react";
import { useToast } from "../../../../components/ui/ToastProvider";
import {
  type SourceColumn,
  type ForeignKeyDefinition,
  inferDefaultRelationship,
} from "./visualSchemaTypes";

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
    const init: Record<string, ForeignKeyDefinition> = {};
    for (const fk of initialForeignKeys) {
      init[fk.columnId] = fk;
    }
    try {
      const stored = localStorage.getItem(`lumin_fk_${connectionId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          parsed.forEach((fk: ForeignKeyDefinition) => {
            if (fk && fk.columnId) init[fk.columnId] = fk;
          });
        } else if (typeof parsed === "object" && parsed !== null) {
          Object.assign(init, parsed);
        }
      }
    } catch {
      // ignore
    }
    return init;
  });

  const [activeFkColId, setActiveFkColId] = useState<string | null>(null);
  const [fkTargetEntity, setFkTargetEntity] = useState<string>("Customer");
  const [fkRelType, setFkRelType] = useState<string>("CUSTOMER_OF");
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
      const inferred = inferDefaultRelationship(col.name);
      setFkTargetEntity(inferred.target);
      setFkRelType(inferred.rel);
      setFkDirection("OUTGOING");
      setIsCustomEntity(false);
      setIsCustomRel(false);
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
