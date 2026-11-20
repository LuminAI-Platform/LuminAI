import React from "react";
import { Search, Database } from "../../../lib/icons";
import { SchemaAccordionItem } from "./SchemaAccordionItem";
import { useTableSelector } from "../hooks/useTableSelector";
import type { SchemaDiscovery } from "../types";

export type { SchemaDiscovery };

interface TableSelectorProps {
  discovered: SchemaDiscovery[];
  selectedTables: string[]; // List of "schema.table"
  onChange: (selected: string[]) => void;
}

export const TableSelector: React.FC<TableSelectorProps> = ({
  discovered,
  selectedTables,
  onChange,
}) => {
  const {
    searchTerm,
    setSearchTerm,
    expandedSchemas,
    toggleExpand,
    isSelected,
    handleToggleTable,
    handleToggleSchema,
    filteredDiscovered,
    getSchemaSelectionStatus,
  } = useTableSelector({ discovered, selectedTables, onChange });

  const allTableIds = discovered.flatMap((s) =>
    s.tables.map((t) => `${s.schema}.${t}`),
  );
  const totalTables = allTableIds.length;
  const allTablesSelected =
    totalTables > 0 && selectedTables.length === totalTables;

  const handleToggleSelectAll = () => {
    if (allTablesSelected) {
      onChange([]);
    } else {
      onChange(allTableIds);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface border border-border rounded-lg overflow-hidden">
      {/* Header & Search */}
      <div className="p-3.5 border-b border-border bg-surface-subtle/40 space-y-2.5 select-none">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-xs font-semibold text-text block">
              Choose tables
            </span>
            <span className="text-[11px] text-text-secondary tabular-nums">
              {selectedTables.length} of {totalTables} table
              {totalTables === 1 ? "" : "s"} selected
            </span>
          </div>
          {totalTables > 0 && (
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="text-xs font-medium text-primary hover:text-primary-hover transition-colors cursor-pointer"
            >
              {allTablesSelected ? "Deselect all" : "Select all"}
            </button>
          )}
        </div>

        {totalTables > 0 && (
          <div className="relative">
            <Search
              className="w-3.5 h-3.5 text-text-secondary absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Search schemas or tables..."
              aria-label="Search schemas or tables"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-surface border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-border-focus transition-colors"
            />
          </div>
        )}
      </div>

      {/* Catalog List */}
      <div className="flex-1 overflow-y-auto p-3 min-h-[220px] flex flex-col gap-2.5">
        {totalTables === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div className="w-10 h-10 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-text-secondary mb-3">
              <Database className="w-5 h-5" aria-hidden="true" />
            </div>
            <p className="text-xs font-medium text-text">No tables found.</p>
            <p className="text-xs text-text-secondary mt-1 max-w-xs">
              No tables found. Check the schema name and the user&apos;s
              permissions.
            </p>
          </div>
        ) : filteredDiscovered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="text-xs font-medium text-text">
              No matching schemas or tables
            </span>
            <span className="text-xs text-text-secondary mt-1">
              Try clearing your search filter.
            </span>
          </div>
        ) : (
          filteredDiscovered.map((item) => {
            const { all, some, count } = getSchemaSelectionStatus(
              item.schema,
              item.tables,
            );
            const isExpanded = expandedSchemas[item.schema] ?? true;

            return (
              <SchemaAccordionItem
                key={item.schema}
                schema={item.schema}
                tables={item.tables}
                isExpanded={isExpanded}
                onToggleExpand={toggleExpand}
                allSelected={all}
                someSelected={some}
                selectedCount={count}
                onToggleSchema={handleToggleSchema}
                isTableSelected={isSelected}
                onToggleTable={handleToggleTable}
              />
            );
          })
        )}
      </div>
    </div>
  );
};
