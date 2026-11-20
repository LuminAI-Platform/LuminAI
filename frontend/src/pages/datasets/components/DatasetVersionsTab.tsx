import React from "react";
import type { DatasetVersion } from "../../../features/datasets/types";

interface DatasetVersionsTabProps {
  versions: DatasetVersion[];
}

export const DatasetVersionsTab: React.FC<DatasetVersionsTabProps> = ({
  versions,
}) => {
  if (versions.length === 0) {
    return (
      <div className="p-8 text-center text-text-secondary text-sm border border-border rounded-xl bg-surface">
        No historical version snapshots recorded.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {versions.map((v) => (
        <div
          key={v.id}
          className="p-4 rounded-xl border border-border bg-surface flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border flex items-center justify-center font-mono font-bold text-xs text-primary">
              v{v.versionNumber}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-text">
                {v.commitMessage}
              </span>
              <span className="text-xs text-text-secondary">
                Committed by{" "}
                <span className="text-text font-medium">{v.committedBy}</span>{" "}
                on {new Date(v.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono text-text block">
              {(v.rowCount || 0).toLocaleString()} rows
            </span>
            <span className="text-[11px] text-text-secondary">
              Snapshot stored
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
