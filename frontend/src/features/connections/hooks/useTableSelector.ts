import { useState, useMemo, useCallback } from "react";
import type {
  SchemaDiscovery,
  UseTableSelectorOptions,
  UseTableSelectorResult,
} from "../types";

/**
 * Custom React hook grouping catalog filtering, schema expansion toggles,
 * and bulk/single table selection state.
 */
export function useTableSelector(
  options: UseTableSelectorOptions,
): UseTableSelectorResult {
  const { discovered, selectedTables, onChange } = options;

  const [searchTerm, setSearchTerm] = useState("");
  const [expandedSchemas, setExpandedSchemas] = useState<
    Record<string, boolean>
  >(() => {
    if (discovered.length > 0) {
      return { [discovered[0].schema]: true };
    }
    return {};
  });

  const toggleExpand = useCallback((schema: string) => {
    setExpandedSchemas((prev) => ({
      ...prev,
      [schema]: !prev[schema],
    }));
  }, []);

  const isSelected = useCallback(
    (schema: string, table: string) => {
      return selectedTables.includes(`${schema}.${table}`);
    },
    [selectedTables],
  );

  const handleToggleTable = useCallback(
    (schema: string, table: string) => {
      const key = `${schema}.${table}`;
      if (selectedTables.includes(key)) {
        onChange(selectedTables.filter((t) => t !== key));
      } else {
        onChange([...selectedTables, key]);
      }
    },
    [selectedTables, onChange],
  );

  const handleToggleSchema = useCallback(
    (schema: string, tables: string[]) => {
      const schemaTableKeys = tables.map((t) => `${schema}.${t}`);
      const allSelected = schemaTableKeys.every((key) =>
        selectedTables.includes(key),
      );

      if (allSelected) {
        onChange(
          selectedTables.filter((key) => !schemaTableKeys.includes(key)),
        );
      } else {
        const otherSelected = selectedTables.filter(
          (key) => !schemaTableKeys.includes(key),
        );
        onChange([...otherSelected, ...schemaTableKeys]);
      }
    },
    [selectedTables, onChange],
  );

  const filteredDiscovered = useMemo<SchemaDiscovery[]>(() => {
    if (!searchTerm.trim()) return discovered;
    const lower = searchTerm.toLowerCase();

    return discovered
      .map((item) => {
        const matchingTables = item.tables.filter(
          (t) =>
            t.toLowerCase().includes(lower) ||
            item.schema.toLowerCase().includes(lower),
        );
        return {
          schema: item.schema,
          tables: matchingTables,
        };
      })
      .filter((item) => item.tables.length > 0);
  }, [discovered, searchTerm]);

  const getSchemaSelectionStatus = useCallback(
    (schema: string, tables: string[]) => {
      const keys = tables.map((t) => `${schema}.${t}`);
      const selectedCount = keys.filter((k) =>
        selectedTables.includes(k),
      ).length;

      return {
        all: selectedCount === tables.length && tables.length > 0,
        some: selectedCount > 0 && selectedCount < tables.length,
        count: selectedCount,
      };
    },
    [selectedTables],
  );

  return {
    searchTerm,
    setSearchTerm,
    expandedSchemas,
    toggleExpand,
    isSelected,
    handleToggleTable,
    handleToggleSchema,
    filteredDiscovered,
    getSchemaSelectionStatus,
  };
}
