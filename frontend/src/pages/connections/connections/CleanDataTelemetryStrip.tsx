import React from "react";
import { Search } from "../../../lib/icons";
import type { CleanDataResponse } from "./connectionsTypes";

interface CleanDataTelemetryStripProps {
  cleanData: CleanDataResponse | null;
  recordsCount: number;
  verifiedCount: number;
  needsReviewCount: number;
  rejectedCount: number;
  cleanSearchFilter: string;
  onSearchChange: (v: string) => void;
}

export const CleanDataTelemetryStrip: React.FC<CleanDataTelemetryStripProps> = ({
  cleanData,
  recordsCount,
  verifiedCount,
  needsReviewCount,
  rejectedCount,
  cleanSearchFilter,
  onSearchChange,
}) => {
  return (
    <div className="px-5 py-2.5 bg-surface-subtle border-b border-border flex flex-wrap items-center justify-between gap-4 text-xs shrink-0">
      <div className="flex items-center gap-5">
        <div>
          <span className="text-[10px] uppercase text-text-secondary block font-semibold">
            Raw Records
          </span>
          <span className="font-mono text-text font-bold">
            {cleanData?.totalRawRecords ?? recordsCount}
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase text-text-secondary block font-semibold">
            Clean Records
          </span>
          <span className="font-mono text-success font-bold">
            {cleanData?.totalCleanRecords ?? recordsCount}
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
        <Search className="w-3.5 h-3.5 text-text-secondary absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Filter records..."
          value={cleanSearchFilter}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-8 pr-2.5 py-1 rounded-lg bg-surface border border-border text-xs text-text placeholder:text-text-secondary focus:outline-none focus:border-border-focus"
        />
      </div>
    </div>
  );
};
