import React from "react";
import { Link } from "@tanstack/react-router";
import { Database, Search, RotateCcw, ArrowRight } from "../../../lib/icons";

export interface ExplorerEmptyStateProps {
  query?: string;
  hasFilters?: boolean;
  onClearFilters?: () => void;
}

/**
 * Empty state component for Entity Explorer.
 *
 * Handles two distinct scenarios:
 * 1. Filtered empty: "No entities match these filters" with "Clear filters".
 * 2. No data: "No entities yet" with "Connect a data source".
 */
export const ExplorerEmptyState: React.FC<ExplorerEmptyStateProps> = ({
  query = "",
  hasFilters = false,
  onClearFilters,
}) => {
  const trimmedQuery = query.trim();
  const isSearchOrFilter = Boolean(trimmedQuery || hasFilters);

  if (isSearchOrFilter) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 border border-dashed border-border rounded-xl text-center bg-surface-subtle/40 transition-colors duration-150 motion-reduce:transition-none">
        <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center text-text-secondary mb-3.5 shadow-2xs">
          <Search className="w-5 h-5" aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold text-text">
          No entities match these filters
        </h3>
        <p className="text-xs text-text-secondary max-w-sm mt-1.5 leading-relaxed">
          {trimmedQuery
            ? `No resolved entities matched "${trimmedQuery}" with your active filters.`
            : "Try adjusting your selected entity types or search terms."}
        </p>

        {onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover text-xs font-semibold text-text transition-colors duration-150 motion-reduce:transition-none cursor-pointer shadow-2xs"
          >
            <RotateCcw
              className="w-3.5 h-3.5 text-text-secondary"
              aria-hidden="true"
            />
            <span>Clear filters</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 border border-dashed border-border rounded-xl text-center bg-surface-subtle/40 transition-colors duration-150 motion-reduce:transition-none">
      <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center text-text-secondary mb-3.5 shadow-2xs">
        <Database className="w-5 h-5" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-text">No entities yet</h3>
      <p className="text-xs text-text-secondary max-w-sm mt-1.5 leading-relaxed">
        Connect a data source to ingest and resolve canonical entities.
      </p>

      <Link
        to="/connections"
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover border border-primary text-primary-text text-xs font-semibold shadow-xs transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
      >
        <span>Connect a data source</span>
        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
};
