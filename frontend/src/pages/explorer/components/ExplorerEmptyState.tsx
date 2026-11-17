import React from "react";
import { Link } from "@tanstack/react-router";
import { Database, Table, RotateCcw, ArrowRight } from "lucide-react";

export interface ExplorerEmptyStateProps {
  query?: string;
  hasFilters?: boolean;
  onClearFilters?: () => void;
}

/**
 * Empty state component for Entity Explorer.
 *
 * Handles two distinct scenarios:
 * 1. No data yet: System has no records ingested. Prompts user to connect a data source.
 * 2. Search with no match: Query or active filters returned 0 results. Prompts user to clear filters.
 */
export const ExplorerEmptyState: React.FC<ExplorerEmptyStateProps> = ({
  query = "",
  hasFilters = false,
  onClearFilters,
}) => {
  const trimmedQuery = query.trim();
  const isSearchOrFilter = Boolean(trimmedQuery || hasFilters);

  if (isSearchOrFilter) {
    const searchTarget = trimmedQuery
      ? `‘${trimmedQuery}’`
      : "selected filters";

    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 border border-dashed border-border rounded-xl text-center bg-surface-subtle/40 select-none transition-colors">
        <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center text-text-secondary mb-3.5 shadow-2xs">
          <Table className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-text">
          No results for {searchTarget}
        </h4>
        <p className="text-xs text-text-secondary max-w-sm mt-1.5 leading-relaxed">
          Try different words or clear filters.
        </p>

        {onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-surface hover:bg-surface-subtle text-xs font-semibold text-text transition-colors cursor-pointer shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-text-secondary" />
            <span>Clear filters</span>
          </button>
        )}

        <div className="mt-6 pt-4 border-t border-border/60 max-w-sm text-center">
          <p className="text-[11px] text-text-secondary leading-normal">
            Entity Explorer searches across canonical record names, entity
            types, unified properties, and data sources.
          </p>
        </div>
      </div>
    );
  }

  // System has no data yet
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 border border-dashed border-border rounded-xl text-center bg-surface-subtle/40 select-none transition-colors">
      <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center text-text-secondary mb-3.5 shadow-2xs">
        <Database className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-semibold text-text">No records yet</h4>
      <p className="text-xs text-text-secondary max-w-sm mt-1.5 leading-relaxed">
        Connect a data source to start matching records.
      </p>

      <Link
        to="/connections"
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover border border-primary text-primary-text text-xs font-semibold shadow-xs transition-colors cursor-pointer"
      >
        <span>Connect a source</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>

      <div className="mt-6 pt-4 border-t border-border/60 max-w-sm text-center">
        <p className="text-[11px] text-text-secondary leading-normal">
          Once data is connected, this explorer displays resolved record names,
          entity types, and data source connections.
        </p>
      </div>
    </div>
  );
};
