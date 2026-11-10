import React from "react";
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

  return (
    <div className="flex flex-col h-full bg-zinc-950 border border-zinc-800/80 rounded-xl overflow-hidden shadow-xl shadow-black/40">
      {/* Search Header */}
      <div className="p-4 border-b border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between gap-4 select-none">
        <div className="flex flex-col">
          <span className="text-xs font-semibold tracking-wider uppercase text-zinc-400">
            Database Catalog
          </span>
          <span className="text-[10px] text-zinc-500 mt-0.5">
            {selectedTables.length} of{" "}
            {discovered.reduce((acc, curr) => acc + curr.tables.length, 0)}{" "}
            tables selected
          </span>
        </div>

        <div className="relative w-full max-w-[240px]">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500 pointer-events-none">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Search schemas/tables..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-zinc-900 border border-zinc-800/80 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500/80 transition-colors"
          />
        </div>
      </div>

      {/* Catalog Viewport */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-4 min-h-[250px] flex flex-col gap-3 scrollbar-thin">
        {filteredDiscovered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center select-none">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-zinc-700 mb-3"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-xs font-semibold text-zinc-500">
              No schemas or tables found
            </span>
            <span className="text-[10px] text-zinc-600 mt-1">
              Try resetting the search filter
            </span>
          </div>
        ) : (
          filteredDiscovered.map((item) => {
            const { all, some, count } = getSchemaSelectionStatus(
              item.schema,
              item.tables,
            );
            const isExpanded = expandedSchemas[item.schema] ?? false;

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
