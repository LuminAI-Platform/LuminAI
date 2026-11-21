import React from "react";
import { Search, ChevronDown, ChevronRight, X } from "../../../lib/icons";
import { getEntityTypeIcon } from "../../../pages/explorer/utils";

export interface MergedTypeRow {
  name: string;
  label: string;
  count: number;
  color: string;
}

interface EntityTypesFacetSectionProps {
  expanded: boolean;
  onToggleExpanded: () => void;
  typeSearch: string;
  onTypeSearchChange: (value: string) => void;
  nonEmptyRows: MergedTypeRow[];
  emptyRows: MergedTypeRow[];
  selectedTypes: string[];
  onToggleType: (typeName: string) => void;
  showEmptyTypes: boolean;
  onToggleShowEmpty: () => void;
}

export const EntityTypesFacetSection: React.FC<
  EntityTypesFacetSectionProps
> = ({
  expanded,
  onToggleExpanded,
  typeSearch,
  onTypeSearchChange,
  nonEmptyRows,
  emptyRows,
  selectedTypes,
  onToggleType,
  showEmptyTypes,
  onToggleShowEmpty,
}) => {
  const renderTypeRow = (row: MergedTypeRow) => {
    const isChecked = selectedTypes.includes(row.name);
    const TypeIcon = getEntityTypeIcon(row.name);

    return (
      <label
        key={row.name}
        title={row.label}
        className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border transition-colors duration-150 motion-reduce:transition-none cursor-pointer ${
          isChecked
            ? "bg-primary-tint border-primary-border text-text"
            : "bg-transparent border-transparent hover:bg-surface-hover text-text-secondary hover:text-text"
        } ${row.count === 0 && !isChecked ? "opacity-60" : ""}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => onToggleType(row.name)}
            className="h-4 w-4 rounded border-border accent-primary cursor-pointer shrink-0"
          />

          <span
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={{
              backgroundColor: `${row.color}18`,
              color: row.color,
            }}
            aria-hidden="true"
          >
            <TypeIcon size={13} />
          </span>

          <span className="text-xs font-medium truncate">{row.label}</span>
        </div>

        <span
          className={`text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${
            isChecked
              ? "bg-primary/15 text-primary"
              : "bg-surface-subtle text-text-muted"
          }`}
        >
          {row.count}
        </span>
      </label>
    );
  };

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={onToggleExpanded}
        aria-expanded={expanded}
        className="flex items-center justify-between w-full text-left py-1 text-xs font-semibold text-text hover:text-primary transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
      >
        <span>Entity Types</span>
        {expanded ? (
          <ChevronDown
            size={14}
            className="text-text-muted"
            aria-hidden="true"
          />
        ) : (
          <ChevronRight
            size={14}
            className="text-text-muted"
            aria-hidden="true"
          />
        )}
      </button>

      {expanded && (
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
              {nonEmptyRows.map(renderTypeRow)}
            </div>
          )}

          {emptyRows.length > 0 && (
            <div className="pt-2 border-t border-border-subtle flex flex-col gap-1">
              <button
                type="button"
                onClick={onToggleShowEmpty}
                aria-expanded={showEmptyTypes}
                className="flex items-center justify-between w-full px-2 py-1.5 text-[11px] font-medium text-text-muted hover:text-text rounded-lg hover:bg-surface-hover transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
              >
                <span>
                  {showEmptyTypes ? "Hide" : "Show"} empty types (
                  {emptyRows.length})
                </span>
                {showEmptyTypes ? (
                  <ChevronDown size={12} aria-hidden="true" />
                ) : (
                  <ChevronRight size={12} aria-hidden="true" />
                )}
              </button>

              {showEmptyTypes && (
                <div className="flex flex-col gap-1 mt-1">
                  {emptyRows.map(renderTypeRow)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
