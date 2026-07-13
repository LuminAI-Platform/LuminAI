import React, { useState, useMemo } from "react";

export interface SchemaDiscovery {
  schema: string;
  tables: string[];
}

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
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedSchemas, setExpandedSchemas] = useState<
    Record<string, boolean>
  >(() => {
    // Expand first schema by default
    if (discovered.length > 0) {
      return { [discovered[0].schema]: true };
    }
    return {};
  });

  // Toggle schema accordion expansion
  const toggleExpand = (schema: string) => {
    setExpandedSchemas((prev) => ({
      ...prev,
      [schema]: !prev[schema],
    }));
  };

  // Check if a specific table is selected
  const isSelected = (schema: string, table: string) => {
    return selectedTables.includes(`${schema}.${table}`);
  };

  // Toggle selection for a single table
  const handleToggleTable = (schema: string, table: string) => {
    const key = `${schema}.${table}`;
    if (selectedTables.includes(key)) {
      onChange(selectedTables.filter((t) => t !== key));
    } else {
      onChange([...selectedTables, key]);
    }
  };

  // Toggle selection for an entire schema
  const handleToggleSchema = (schema: string, tables: string[]) => {
    const schemaTableKeys = tables.map((t) => `${schema}.${t}`);
    const allSelected = schemaTableKeys.every((key) =>
      selectedTables.includes(key),
    );

    if (allSelected) {
      // Remove all tables of this schema
      onChange(selectedTables.filter((key) => !schemaTableKeys.includes(key)));
    } else {
      // Add missing tables of this schema
      const otherSelected = selectedTables.filter(
        (key) => !schemaTableKeys.includes(key),
      );
      onChange([...otherSelected, ...schemaTableKeys]);
    }
  };

  // Filter discovered schemas and tables based on search term
  const filteredDiscovered = useMemo(() => {
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

  // Count helper
  const getSchemaSelectionStatus = (schema: string, tables: string[]) => {
    const keys = tables.map((t) => `${schema}.${t}`);
    const selectedCount = keys.filter((k) => selectedTables.includes(k)).length;

    return {
      all: selectedCount === tables.length && tables.length > 0,
      some: selectedCount > 0 && selectedCount < tables.length,
      count: selectedCount,
    };
  };

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
      <div className="flex-1 overflow-y-auto p-4 min-h-[250px] flex flex-col gap-3">
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
              <div
                key={item.schema}
                className="border border-zinc-850/80 rounded-lg overflow-hidden bg-zinc-900/10"
              >
                {/* Schema Header row */}
                <div className="flex items-center justify-between p-3 bg-zinc-900/30 border-b border-zinc-850/60 hover:bg-zinc-900/50 transition-colors select-none">
                  <div className="flex items-center gap-3">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      ref={(el) => {
                        if (el) el.indeterminate = some;
                      }}
                      checked={all}
                      onChange={() =>
                        handleToggleSchema(item.schema, item.tables)
                      }
                      className="w-4 h-4 rounded border-zinc-800 bg-zinc-950 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-950 cursor-pointer"
                    />

                    {/* Schema name & count */}
                    <div
                      className="flex items-center gap-2 cursor-pointer"
                      onClick={() => toggleExpand(item.schema)}
                    >
                      <span className="text-xs font-mono font-bold text-zinc-200">
                        {item.schema}
                      </span>
                      <span className="text-[10px] bg-zinc-850 text-zinc-500 px-1.5 py-0.5 rounded font-mono">
                        {count}/{item.tables.length}
                      </span>
                    </div>
                  </div>

                  {/* Expand toggle arrow */}
                  <button
                    onClick={() => toggleExpand(item.schema)}
                    className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className={`transform transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>

                {/* Table List (Accordion content) */}
                {isExpanded && (
                  <div className="p-3 bg-zinc-950/20 divide-y divide-zinc-900/60">
                    {item.tables.map((table) => {
                      const checked = isSelected(item.schema, table);
                      return (
                        <div
                          key={table}
                          onClick={() => handleToggleTable(item.schema, table)}
                          className="flex items-center gap-3 py-2 px-1 hover:bg-zinc-900/30 rounded cursor-pointer group transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {}} // Handled by outer click
                            className="w-3.5 h-3.5 rounded border-zinc-800 bg-zinc-950 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-950 cursor-pointer"
                          />
                          <span className="text-xs font-mono text-zinc-400 group-hover:text-zinc-200 transition-colors">
                            {table}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
