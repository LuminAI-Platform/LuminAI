import React from "react";
import { ChevronLeft, ChevronRight } from "../../../../lib/icons";

interface RunsTablePaginationProps {
  runsCount: number;
  totalElements: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
}

export const RunsTablePagination: React.FC<RunsTablePaginationProps> = ({
  runsCount,
  totalElements,
  currentPage,
  totalPages,
  onPageChange,
}) => {
  return (
    <div className="p-3 border-t border-border flex items-center justify-between text-xs text-text-secondary">
      <div>
        Showing {runsCount} of {totalElements} run
        {totalElements === 1 ? "" : "s"}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={currentPage <= 0}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-1.5 rounded-md hover:bg-surface-subtle text-text disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-subtle border border-border">
          Page {currentPage + 1} of {Math.max(1, totalPages)}
        </span>
        <button
          type="button"
          disabled={currentPage >= totalPages - 1}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-1.5 rounded-md hover:bg-surface-subtle text-text disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
