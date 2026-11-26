import React, { useState, useRef, useEffect } from "react";
import { Columns3, ICON_SIZES } from "../../../lib/icons";
import { toSentenceCaseHeader } from "./cleanDataUtils";

export type CleanStateTab = "ALL" | "VERIFIED" | "NEEDS_REVIEW" | "QUARANTINED";

interface CleanDataFilterBarProps {
  selectedStateFilter: CleanStateTab;
  onSelectStateFilter: (state: CleanStateTab) => void;
  verifiedCount: number;
  needsReviewCount: number;
  rejectedCount: number;
  availableTables: string[];
  selectedTableFilter: string;
  onSelectTableFilter: (table: string) => void;
  totalRowsCount: number;
  rows: Record<string, unknown>[];
  allColumns: string[];
  hiddenColumns: Set<string>;
  onToggleColumn: (col: string) => void;
  onResetColumns: () => void;
}

export const CleanDataFilterBar: React.FC<CleanDataFilterBarProps> = ({
  selectedStateFilter,
  onSelectStateFilter,
  verifiedCount,
  needsReviewCount,
  rejectedCount,
  availableTables,
  selectedTableFilter,
  onSelectTableFilter,
  totalRowsCount,
  rows,
  allColumns,
  hiddenColumns,
  onToggleColumn,
  onResetColumns,
}) => {
  const [columnsOpen, setColumnsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!columnsOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setColumnsOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setColumnsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [columnsOpen]);

  const tabs: { id: CleanStateTab; label: string }[] = [
    { id: "ALL", label: `All (${totalRowsCount.toLocaleString()})` },
    { id: "VERIFIED", label: `Verified (${verifiedCount.toLocaleString()})` },
    {
      id: "NEEDS_REVIEW",
      label: `Needs review (${needsReviewCount.toLocaleString()})`,
    },
    {
      id: "QUARANTINED",
      label: `Quarantined (${rejectedCount.toLocaleString()})`,
    },
  ];

  return (
    <div className="px-6 py-2.5 bg-surface border-b border-border flex flex-wrap items-center justify-between gap-3 shrink-0">
      <div
        role="tablist"
        aria-label="Filter records by quality state"
        className="flex items-center gap-1.5 flex-wrap"
      >
        {tabs.map((tab) => {
          const active = selectedStateFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelectStateFilter(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                active
                  ? "bg-primary text-primary-text shadow-xs"
                  : "bg-surface-subtle border border-border text-text-secondary hover:text-text"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {availableTables.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-secondary">Tables</span>
            <button
              type="button"
              onClick={() => onSelectTableFilter("ALL")}
              className={`px-2 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                selectedTableFilter === "ALL"
                  ? "bg-primary text-primary-text"
                  : "bg-surface-subtle border border-border text-text-secondary hover:text-text"
              }`}
            >
              All ({totalRowsCount})
            </button>
            {availableTables.map((tbl) => {
              const count = rows.filter((r) => r._table === tbl).length;
              return (
                <button
                  key={tbl}
                  type="button"
                  onClick={() => onSelectTableFilter(tbl)}
                  className={`px-2 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    selectedTableFilter === tbl
                      ? "bg-primary text-primary-text"
                      : "bg-surface-subtle border border-border text-text-secondary hover:text-text"
                  }`}
                >
                  {tbl} ({count})
                </button>
              );
            })}
          </div>
        )}

        {allColumns.length > 0 && (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-expanded={columnsOpen}
              aria-haspopup="menu"
              onClick={() => setColumnsOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-subtle hover:bg-surface-hover border border-border text-xs font-medium text-text cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Columns3 size={ICON_SIZES.inline} aria-hidden="true" />
              <span>
                Columns ({allColumns.length - hiddenColumns.size}/
                {allColumns.length})
              </span>
            </button>

            {columnsOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-1.5 w-56 rounded-xl border border-border bg-surface shadow-lg p-2 z-30 max-h-64 overflow-y-auto"
              >
                <div className="flex items-center justify-between px-2 py-1 border-b border-border mb-1">
                  <span className="text-xs font-semibold text-text">
                    Visible columns
                  </span>
                  {hiddenColumns.size > 0 && (
                    <button
                      type="button"
                      onClick={onResetColumns}
                      className="text-[11px] font-medium text-primary hover:underline cursor-pointer"
                    >
                      Show all
                    </button>
                  )}
                </div>
                {allColumns.map((col, idx) => {
                  const isVisible = !hiddenColumns.has(col);
                  const isPinnedFirst = idx === 0;
                  return (
                    <label
                      key={col}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-hover text-xs text-text cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={isVisible}
                        disabled={isPinnedFirst}
                        onChange={() => onToggleColumn(col)}
                        className="rounded border-border accent-primary"
                      />
                      <span className="truncate flex-1">
                        {toSentenceCaseHeader(col)}
                      </span>
                      {isPinnedFirst && (
                        <span className="text-[10px] text-text-muted">
                          Pinned
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
