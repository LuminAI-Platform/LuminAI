import React from "react";
import {
  Sliders,
  LayoutDashboard,
  Table,
  ArrowUpDown,
} from "../../../lib/icons";
import type { SortOption, ViewMode } from "../types";
import { PAGE_SIZE_OPTIONS } from "../constants";

interface ExplorerToolbarProps {
  totalElements: number;
  currentPage: number;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  hasConfidenceData: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  activeFilterCount: number;
  onOpenMobileFilters: () => void;
}

export const ExplorerToolbar: React.FC<ExplorerToolbarProps> = ({
  totalElements,
  currentPage,
  pageSize,
  onPageSizeChange,
  sortOption,
  onSortChange,
  hasConfidenceData,
  viewMode,
  onViewModeChange,
  activeFilterCount,
  onOpenMobileFilters,
}) => {
  const start = totalElements === 0 ? 0 : currentPage * pageSize + 1;
  const end = Math.min((currentPage + 1) * pageSize, totalElements);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Left: Narrow-screen Filters trigger + Range summary */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileFilters}
          className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface border border-border hover:bg-surface-hover text-text transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
        >
          <Sliders size={14} aria-hidden="true" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-primary text-primary-text">
              {activeFilterCount}
            </span>
          )}
        </button>

        <span className="text-xs text-text-secondary">
          {totalElements > 0 ? (
            <>
              Showing{" "}
              <strong className="font-semibold text-text">
                {start}–{end}
              </strong>{" "}
              of{" "}
              <strong className="font-semibold text-text">
                {totalElements.toLocaleString()}
              </strong>{" "}
              entities
            </>
          ) : (
            "0 entities"
          )}
        </span>
      </div>

      {/* Right: Sort, View Toggle, Page Size */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Sort Select */}
        <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface border border-border text-xs text-text-secondary">
          <ArrowUpDown
            size={13}
            className="text-text-muted shrink-0"
            aria-hidden="true"
          />
          <span className="sr-only">Sort entities</span>
          <select
            value={sortOption}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            aria-label="Sort entities"
            className="bg-transparent text-text font-medium outline-none cursor-pointer pr-1"
          >
            <option value="newest">Newest</option>
            <option value="name_asc">Name (A–Z)</option>
            <option value="name_desc">Name (Z–A)</option>
            {hasConfidenceData && (
              <option value="confidence_desc">Confidence</option>
            )}
          </select>
        </label>

        {/* Page Size Select */}
        <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface border border-border text-xs text-text-secondary">
          <span className="text-text-muted hidden sm:inline">Show</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Results per page"
            className="bg-transparent text-text font-medium outline-none cursor-pointer"
          >
            {PAGE_SIZE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>

        {/* Cards / Table Segmented Toggle */}
        <div
          role="group"
          aria-label="View mode"
          className="inline-flex items-center p-0.5 rounded-lg bg-surface-subtle border border-border"
        >
          <button
            type="button"
            onClick={() => onViewModeChange("cards")}
            aria-pressed={viewMode === "cards"}
            aria-label="Card view"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150 motion-reduce:transition-none cursor-pointer ${
              viewMode === "cards"
                ? "bg-surface text-primary shadow-2xs border border-border-subtle"
                : "text-text-secondary hover:text-text border border-transparent"
            }`}
          >
            <LayoutDashboard size={13} aria-hidden="true" />
            <span className="hidden sm:inline">Cards</span>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("table")}
            aria-pressed={viewMode === "table"}
            aria-label="Table view"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150 motion-reduce:transition-none cursor-pointer ${
              viewMode === "table"
                ? "bg-surface text-primary shadow-2xs border border-border-subtle"
                : "text-text-secondary hover:text-text border border-transparent"
            }`}
          >
            <Table size={13} aria-hidden="true" />
            <span className="hidden sm:inline">Table</span>
          </button>
        </div>
      </div>
    </div>
  );
};
