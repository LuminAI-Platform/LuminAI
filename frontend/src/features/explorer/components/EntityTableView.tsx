import React, { useMemo, useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "../../../lib/icons";
import type { EntityType } from "../../ontology/types";
import { useThemeStore } from "../../../stores/themeStore";
import type { SearchResultItem } from "../../../pages/explorer/types";
import { EntityTableRow, type ColumnDef } from "./EntityTableRow";
import { EntityTableColumnMenu } from "./EntityTableColumnMenu";
import {
  buildEntityTableColumns,
  getTopPropertyKeys,
  sortTableEntities,
  type TableSortDir,
} from "./entityTableUtils";

export { type ColumnDef };

interface EntityTableViewProps {
  entities: SearchResultItem[];
  ontologyTypes?: EntityType[];
  maskSensitiveData: boolean;
  onSelect: (entity: SearchResultItem, triggerEl: HTMLElement | null) => void;
}

export const EntityTableView: React.FC<EntityTableViewProps> = ({
  entities,
  ontologyTypes = [],
  maskSensitiveData,
  onSelect,
}) => {
  const isDark = useThemeStore((s) => s.isDark);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<TableSortDir>("asc");
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());

  const hasConfidence = useMemo(
    () => entities.some((e) => typeof e.confidenceScore === "number"),
    [entities],
  );
  const hasSources = useMemo(
    () => entities.some((e) => typeof e.sourceCount === "number"),
    [entities],
  );
  const topPropertyKeys = useMemo(
    () => getTopPropertyKeys(entities),
    [entities],
  );

  const allColumns = useMemo<ColumnDef[]>(
    () => buildEntityTableColumns(hasConfidence, hasSources, topPropertyKeys),
    [hasConfidence, hasSources, topPropertyKeys],
  );

  const visibleColumns = useMemo(
    () => allColumns.filter((c) => !hiddenCols.has(c.id)),
    [allColumns, hiddenCols],
  );

  const handleSortClick = (colId: string) => {
    if (sortCol === colId) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(colId);
      setSortDir("asc");
    }
  };

  const toggleColumn = (colId: string) => {
    if (colId === "canonicalName") return;
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return next;
    });
  };

  const sortedEntities = useMemo(
    () => sortTableEntities(entities, sortCol, sortDir),
    [entities, sortCol, sortDir],
  );

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-xs">
      <EntityTableColumnMenu
        allColumns={allColumns}
        hiddenCols={hiddenCols}
        onToggleColumn={toggleColumn}
      />

      {/* Horizontal scroll container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-subtle/40">
              {visibleColumns.map((col) => {
                const isSorted = sortCol === col.id;
                return (
                  <th
                    key={col.id}
                    scope="col"
                    aria-sort={
                      isSorted
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted whitespace-nowrap"
                  >
                    <button
                      type="button"
                      onClick={() => handleSortClick(col.id)}
                      className="inline-flex items-center gap-1 hover:text-text transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
                    >
                      <span>{col.label}</span>
                      {isSorted ? (
                        sortDir === "asc" ? (
                          <ArrowUp
                            size={12}
                            className="text-primary"
                            aria-hidden="true"
                          />
                        ) : (
                          <ArrowDown
                            size={12}
                            className="text-primary"
                            aria-hidden="true"
                          />
                        )
                      ) : (
                        <ArrowUpDown
                          size={11}
                          className="opacity-50"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-border-subtle">
            {sortedEntities.map((entity) => (
              <EntityTableRow
                key={entity.id}
                entity={entity}
                ontologyTypes={ontologyTypes}
                visibleColumns={visibleColumns}
                maskSensitiveData={maskSensitiveData}
                isDark={isDark}
                onSelect={onSelect}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
