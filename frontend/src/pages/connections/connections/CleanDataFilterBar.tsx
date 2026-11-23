import React from "react";

interface CleanDataFilterBarProps {
  selectedStateFilter: string;
  onSelectStateFilter: (state: string) => void;
  verifiedCount: number;
  needsReviewCount: number;
  rejectedCount: number;
  availableTables: string[];
  selectedTableFilter: string;
  onSelectTableFilter: (table: string) => void;
  totalRowsCount: number;
  rows: Record<string, unknown>[];
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
}) => {
  return (
    <div className="px-5 py-2 bg-surface border-b border-border flex items-center justify-between gap-4 overflow-x-auto shrink-0">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider mr-1">
          Quality State:
        </span>
        {[
          { id: "ALL", label: "All" },
          { id: "VERIFIED", label: `Verified (${verifiedCount})` },
          { id: "REVIEW", label: `Review (${needsReviewCount})` },
          { id: "REJECT", label: `Quarantined (${rejectedCount})` },
        ].map((st) => (
          <button
            key={st.id}
            onClick={() => onSelectStateFilter(st.id)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
              selectedStateFilter === st.id
                ? "bg-primary text-primary-text font-semibold shadow-xs"
                : "bg-surface-subtle border border-border text-text-secondary hover:text-text"
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {availableTables.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider mr-1">
            Tables:
          </span>
          <button
            onClick={() => onSelectTableFilter("ALL")}
            className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
              selectedTableFilter === "ALL"
                ? "bg-primary text-primary-text font-semibold shadow-xs"
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
                onClick={() => onSelectTableFilter(tbl)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                  selectedTableFilter === tbl
                    ? "bg-primary text-primary-text font-semibold shadow-xs"
                    : "bg-surface-subtle border border-border text-text-secondary hover:text-text"
                }`}
              >
                {tbl} ({count})
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
