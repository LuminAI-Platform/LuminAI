import React from "react";
import { Search, ChevronDown, ChevronRight, X } from "../../../lib/icons";
import { FacetTypeItem, type MergedTypeRow } from "./FacetTypeItem";

interface FacetTypesListProps {
  typeSearch: string;
  onTypeSearchChange: (val: string) => void;
  nonEmptyRows: MergedTypeRow[];
  emptyRows: MergedTypeRow[];
  selectedTypes: string[];
  showEmptyTypes: boolean;
  onToggleShowEmptyTypes: () => void;
  onToggleType: (typeName: string) => void;
}

export const FacetTypesList: React.FC<FacetTypesListProps> = ({
  typeSearch,
  onTypeSearchChange,
  nonEmptyRows,
  emptyRows,
  selectedTypes,
  showEmptyTypes,
  onToggleShowEmptyTypes,
  onToggleType,
}) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="relative flex items-center">
        <Search
          size={13}
          className="absolute left-2.5 text-text-muted pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="text"
          value={typeSearch}
          onChange={(e) => onTypeSearchChange(e.target.value)}
          placeholder="Filter types..."
          aria-label="Filter entity types"
          className="w-full pl-8 pr-7 py-1.5 text-xs bg-surface-subtle border border-border rounded-lg text-text placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors duration-150 motion-reduce:transition-none"
        />
        {typeSearch && (
          <button
            type="button"
            onClick={() => onTypeSearchChange("")}
            aria-label="Clear type filter"
            className="absolute right-2 text-text-muted hover:text-text cursor-pointer"
          >
            <X size={12} aria-hidden="true" />
          </button>
        )}
      </div>

      {nonEmptyRows.length === 0 && emptyRows.length === 0 ? (
        <p className="text-xs text-text-muted text-center py-4">
          No matching entity types
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {nonEmptyRows.map((row) => (
            <FacetTypeItem
              key={row.name}
              row={row}
              isChecked={selectedTypes.includes(row.name)}
              onToggle={onToggleType}
            />
          ))}
        </div>
      )}

      {emptyRows.length > 0 && (
        <div className="pt-2 border-t border-border-subtle flex flex-col gap-1">
          <button
            type="button"
            onClick={onToggleShowEmptyTypes}
            aria-expanded={showEmptyTypes}
            className="flex items-center justify-between w-full px-2 py-1.5 text-[11px] font-medium text-text-muted hover:text-text rounded-lg hover:bg-surface-hover transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
          >
            <span>
              {showEmptyTypes ? "Hide" : "Show"} empty types ({emptyRows.length})
            </span>
            {showEmptyTypes ? (
              <ChevronDown size={12} aria-hidden="true" />
            ) : (
              <ChevronRight size={12} aria-hidden="true" />
            )}
          </button>

          {showEmptyTypes && (
            <div className="flex flex-col gap-1 mt-1">
              {emptyRows.map((row) => (
                <FacetTypeItem
                  key={row.name}
                  row={row}
                  isChecked={selectedTypes.includes(row.name)}
                  onToggle={onToggleType}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
