import React from "react";

interface ExplorerPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const ExplorerPagination: React.FC<ExplorerPaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-1.5 pt-4 select-none">
      {/* Prev Button */}
      <button
        disabled={currentPage === 0}
        onClick={() => onPageChange(currentPage - 1)}
        className="p-2 border border-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-400 transition-colors cursor-pointer"
        aria-label="Previous page"
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

      {/* Page numbers */}
      {Array.from({ length: totalPages }).map((_, idx) => {
        const isActive = currentPage === idx;
        return (
          <button
            key={idx}
            onClick={() => onPageChange(idx)}
            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              isActive
                ? "bg-primary-tint border border-primary-border text-primary font-bold"
                : "border border-border text-text-secondary hover:text-text hover:bg-surface-hover"
            }`}
          >
            {idx + 1}
          </button>
        );
      })}

      {/* Next Button */}
      <button
        disabled={currentPage === totalPages - 1}
        onClick={() => onPageChange(currentPage + 1)}
        className="p-2 border border-border rounded-lg text-text-secondary hover:text-text hover:bg-surface-hover disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-secondary transition-colors cursor-pointer"
        aria-label="Next page"
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
  );
};
