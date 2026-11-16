import React from "react";
import type { SyncDataset } from "./syncJobTypes";
import { STATUS_CONFIG } from "./syncJobTypes";
import { formatNumber } from "./syncJobHelpers";

interface SyncDatasetRowProps {
  ds: SyncDataset;
}

export const SyncDatasetRow: React.FC<SyncDatasetRowProps> = ({ ds }) => {
  const pct =
    ds.totalRecords > 0 ? (ds.syncedRecords / ds.totalRecords) * 100 : 0;
  const dsCfg = STATUS_CONFIG[ds.status];

  return (
    <div className="bg-surface border border-border rounded-lg p-3 hover:border-border-focus transition-all">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dsCfg.dot}`}
          />
          <span className="text-xs font-mono text-text truncate">
            {ds.name}
          </span>
          <span className="text-[10px] text-text-secondary font-semibold px-1.5 py-0.2 rounded bg-surface-subtle border border-border">
            {ds.source}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {ds.failedRecords > 0 && (
            <span className="text-[10px] text-error bg-error-bg px-1.5 py-0.5 rounded border border-error-border">
              {formatNumber(ds.failedRecords)} failed
            </span>
          )}
          <span className={`text-[10px] font-semibold ${dsCfg.text}`}>
            {Math.floor(pct)}%
          </span>
        </div>
      </div>

      <div className="w-full bg-surface-muted rounded-full h-1 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            ds.status === "failed"
              ? "bg-error"
              : ds.status === "paused"
                ? "bg-nodata"
                : "bg-success"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex justify-between items-center mt-1.5 text-[10px] text-text-secondary">
        <span>
          {formatNumber(ds.syncedRecords)} / {formatNumber(ds.totalRecords)}{" "}
          records
        </span>
        <span>
          Started{" "}
          {ds.startedAt.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
};
