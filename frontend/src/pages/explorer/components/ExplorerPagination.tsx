import React from "react";
import { ChevronLeft, ChevronRight } from "../../../lib/icons";

interface ExplorerPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function getVisiblePages(current: number, total: number): Array<number | "…"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i);
  }
  const pages: Array<number | "…"> = [0];
  const start = Math.max(1, current - 1);
  const end = Math.min(total - 2, current + 1);

  if (start > 1) pages.push("…");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 2) pages.push("…");
  pages.push(total - 1);
  return pages;
}

export const ExplorerPagination: React.FC<ExplorerPaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  if (totalPages <= 1) return null;

  const visiblePages = getVisiblePages(currentPage, totalPages);

  return (
    <nav
      aria-label="Entity results pagination"
      className="flex items-center justify-center gap-1.5 pt-2"
    >
      <button
        type="button"
        disabled={currentPage === 0}
        onClick={() => onPageChange(currentPage - 1)}
        className="p-2 border border-border rounded-lg bg-surface text-text-secondary hover:text-text hover:bg-surface-hover disabled:opacity-40 disabled:pointer-events-none transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
        aria-label="Previous page"
      >
        <ChevronLeft size={14} aria-hidden="true" />
      </button>

      {visiblePages.map((item, idx) =>
        item === "…" ? (
          <span
            key={`ellipsis-${idx}`}
            className="w-8 h-8 flex items-center justify-center text-xs text-text-muted select-none"
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-current={currentPage === item ? "page" : undefined}
            className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors duration-150 motion-reduce:transition-none cursor-pointer ${
              currentPage === item
                ? "bg-primary-tint border border-primary-border text-primary"
                : "bg-surface border border-border text-text-secondary hover:text-text hover:bg-surface-hover"
            }`}
          >
            {item + 1}
          </button>
        ),
      )}

      <button
        type="button"
        disabled={currentPage >= totalPages - 1}
        onClick={() => onPageChange(currentPage + 1)}
        className="p-2 border border-border rounded-lg bg-surface text-text-secondary hover:text-text hover:bg-surface-hover disabled:opacity-40 disabled:pointer-events-none transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
        aria-label="Next page"
      >
        <ChevronRight size={14} aria-hidden="true" />
      </button>
    </nav>
  );
};
