import React from "react";

interface DataPreviewPaginationProps {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalFilteredRows: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export const DataPreviewPagination: React.FC<DataPreviewPaginationProps> = ({
  currentPage,
  totalPages,
  itemsPerPage,
  totalFilteredRows,
  onPreviousPage,
  onNextPage,
}) => (
  <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800/80 bg-zinc-900/40 select-none">
    <div className="text-zinc-500 text-xs">
      Showing{" "}
      <span className="font-semibold text-zinc-400">
        {Math.min(totalFilteredRows, (currentPage - 1) * itemsPerPage + 1)}
      </span>{" "}
      to{" "}
      <span className="font-semibold text-zinc-400">
        {Math.min(totalFilteredRows, currentPage * itemsPerPage)}
      </span>{" "}
      of{" "}
      <span className="font-semibold text-zinc-400">{totalFilteredRows}</span>{" "}
      entries
    </div>
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Previous page"
        onClick={onPreviousPage}
        disabled={currentPage === 1}
        className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <span className="text-zinc-400 text-xs px-3 font-semibold">
        Page {currentPage} of {totalPages}
      </span>
      <button
        type="button"
        aria-label="Next page"
        onClick={onNextPage}
        disabled={currentPage === totalPages}
        className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  </div>
);
