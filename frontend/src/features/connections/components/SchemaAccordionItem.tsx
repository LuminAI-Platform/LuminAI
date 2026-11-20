import React, { useEffect, useRef } from "react";
import { ChevronDown } from "../../../lib/icons";

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
    <div className="border border-border rounded-lg overflow-hidden bg-surface">
      {/* Schema Header row */}
      <div className="flex items-center justify-between p-2.5 bg-surface-subtle/60 border-b border-border hover:bg-surface-subtle transition-colors select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <input
            type="checkbox"
            ref={checkboxRef}
            checked={allSelected}
            onChange={() => onToggleSchema(schema, tables)}
            aria-label={`Select all tables in schema ${schema}`}
            className="w-4 h-4 rounded border-border bg-surface text-primary focus:ring-primary cursor-pointer shrink-0"
          />

          <button
            type="button"
            className="flex items-center gap-2 cursor-pointer text-left min-w-0"
            onClick={() => onToggleExpand(schema)}
          >
            <span className="text-xs font-mono font-semibold text-text truncate">
              {schema}
            </span>
            <span className="text-[11px] bg-surface border border-border text-text-secondary px-1.5 py-0.5 rounded tabular-nums shrink-0">
              {selectedCount}/{tables.length}
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => onToggleExpand(schema)}
          className="p-1 text-text-secondary hover:text-text transition-colors cursor-pointer rounded"
          aria-label={
            isExpanded ? `Collapse schema ${schema}` : `Expand schema ${schema}`
          }
          aria-expanded={isExpanded}
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Table List */}
      {isExpanded && (
        <div className="p-2 bg-surface divide-y divide-border-subtle">
          {tables.map((table) => {
            const checked = isTableSelected(schema, table);
            const checkboxId = `table-${schema}-${table}`;
            return (
              <label
                key={table}
                htmlFor={checkboxId}
                className="flex items-center gap-2.5 py-2 px-2 hover:bg-surface-hover rounded cursor-pointer group transition-colors"
              >
                <input
                  id={checkboxId}
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleTable(schema, table)}
                  className="w-3.5 h-3.5 rounded border-border bg-surface text-primary focus:ring-primary cursor-pointer shrink-0"
                />
                <span className="text-xs font-mono text-text-secondary group-hover:text-text transition-colors truncate">
                  {table}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};
