import React from "react";
import { Search } from "../../../lib/icons";
import type { CleanDataResponse, IngestedFile } from "./connectionsTypes";

interface CleanDataToolbarProps {
  cleanPreviewFile: IngestedFile;
  cleanData: CleanDataResponse | null;
  verifiedCount: number;
  needsReviewCount: number;
  rejectedCount: number;
  cleanSearchFilter: string;
  setCleanSearchFilter: (v: string) => void;
  selectedStateFilter: string;
  setSelectedStateFilter: (v: string) => void;
  selectedTableFilter: string;
  setSelectedTableFilter: (v: string) => void;
  availableTables: string[];
}

export const CleanDataToolbar: React.FC<CleanDataToolbarProps> = ({
  cleanPreviewFile,
  cleanData,
  verifiedCount,
  needsReviewCount,
  rejectedCount,
  cleanSearchFilter,
  setCleanSearchFilter,
  selectedStateFilter,
  setSelectedStateFilter,
  selectedTableFilter,
  setSelectedTableFilter,
  availableTables,
}) => {
  const rows = cleanData?.rows || [];

  return (
    <>
      {/* Telemetry Strip */}
      <div className="px-5 py-2.5 bg-surface-subtle border-b border-border flex flex-wrap items-center justify-between gap-4 text-xs shrink-0">
        <div className="flex items-center gap-5">
          <div>
            <span className="text-[10px] uppercase text-text-secondary block font-semibold">
              Raw Records
            </span>
            <span className="font-mono text-text font-bold">
              {cleanData?.totalRawRecords ?? cleanPreviewFile.recordsCount}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-text-secondary block font-semibold">
              Clean Records
            </span>
            <span className="font-mono text-success font-bold">
              {cleanData?.totalCleanRecords ?? cleanPreviewFile.recordsCount}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-text-secondary block font-semibold">
              Duplicates Merged
            </span>
            <span className="font-mono text-primary font-bold">
              {cleanData?.duplicatesMerged ?? 0}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-text-secondary block font-semibold">
              Verified
            </span>
            <span className="font-mono text-success font-bold">
              {verifiedCount}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-text-secondary block font-semibold">
              Needs Review
            </span>
            <span className="font-mono text-warning font-bold">
              {needsReviewCount}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-text-secondary block font-semibold">
              Quarantined
            </span>
            <span className="font-mono text-error font-bold">
              {rejectedCount}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-text-secondary block font-semibold">
              DAMA Quality Score
            </span>
            <span className="font-mono text-success font-bold">
              {cleanData?.dataQualityScore != null
                ? `${cleanData.dataQualityScore}%`
                : "N/A"}
            </span>
          </div>
        </div>
        <div className="relative w-52">
          <Search
            className="w-3.5 h-3.5 text-text-secondary absolute left-2.5 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder="Filter records..."
            aria-label="Filter clean records"
            value={cleanSearchFilter}
            onChange={(e) => setCleanSearchFilter(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 rounded-lg bg-surface border border-border text-xs text-text placeholder:text-text-secondary focus:outline-none focus:border-border-focus"
          />
        </div>
      </div>

      {/* Quality State & Table Filters */}
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
              type="button"
              onClick={() => setSelectedStateFilter(st.id)}
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
              type="button"
              onClick={() => setSelectedTableFilter("ALL")}
              className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                selectedTableFilter === "ALL"
                  ? "bg-primary text-primary-text font-semibold shadow-xs"
                  : "bg-surface-subtle border border-border text-text-secondary hover:text-text"
              }`}
            >
              All ({rows.length})
            </button>
            {availableTables.map((tbl) => {
              const count = rows.filter((r) => r._table === tbl).length;
              return (
                <button
                  key={tbl}
                  type="button"
                  onClick={() => setSelectedTableFilter(tbl)}
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
    </>
  );
};
