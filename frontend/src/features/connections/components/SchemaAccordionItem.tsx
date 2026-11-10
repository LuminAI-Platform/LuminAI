import React, { useEffect, useRef } from "react";

interface SchemaAccordionItemProps {
  schema: string;
  tables: string[];
  isExpanded: boolean;
  onToggleExpand: (schema: string) => void;
  allSelected: boolean;
  someSelected: boolean;
  selectedCount: number;
  onToggleSchema: (schema: string, tables: string[]) => void;
  isTableSelected: (schema: string, table: string) => boolean;
  onToggleTable: (schema: string, table: string) => void;
}

export const SchemaAccordionItem: React.FC<SchemaAccordionItemProps> = ({
  schema,
  tables,
  isExpanded,
  onToggleExpand,
  allSelected,
  someSelected,
  selectedCount,
  onToggleSchema,
  isTableSelected,
  onToggleTable,
}) => {
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  return (
    <div className="border border-zinc-850/80 rounded-lg overflow-hidden bg-zinc-900/10">
      {/* Schema Header row */}
      <div className="flex items-center justify-between p-3 bg-zinc-900/30 border-b border-zinc-850/60 hover:bg-zinc-900/50 transition-colors select-none">
        <div className="flex items-center gap-3">
          {/* Checkbox */}
          <input
            type="checkbox"
            ref={checkboxRef}
            checked={allSelected}
            onChange={() => onToggleSchema(schema, tables)}
            className="w-4 h-4 rounded border-zinc-800 bg-zinc-950 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-950 cursor-pointer"
          />

          {/* Schema name & count */}
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => onToggleExpand(schema)}
          >
            <span className="text-xs font-mono font-bold text-zinc-200">
              {schema}
            </span>
            <span className="text-[10px] bg-zinc-850 text-zinc-500 px-1.5 py-0.5 rounded font-mono">
              {selectedCount}/{tables.length}
            </span>
          </div>
        </div>

        {/* Expand toggle arrow */}
        <button
          onClick={() => onToggleExpand(schema)}
          className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          aria-label={isExpanded ? "Collapse schema" : "Expand schema"}
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
          {tables.map((table) => {
            const checked = isTableSelected(schema, table);
            return (
              <div
                key={table}
                onClick={() => onToggleTable(schema, table)}
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
};
