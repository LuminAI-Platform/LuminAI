import React from "react";
import type { Dataset } from "../../../features/datasets/types";

interface DatasetSummaryCardsProps {
  dataset: Dataset;
  columnCount: number;
}

export const DatasetSummaryCards: React.FC<DatasetSummaryCardsProps> = ({
  dataset,
  columnCount,
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-1">
        <span className="text-xs text-text-secondary">Storage Layer</span>
        <span className="text-lg font-bold text-primary">{dataset.layer}</span>
        <span className="text-[11px] text-text-secondary">
          Project: {dataset.projectType}
        </span>
      </div>
      <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-1">
        <span className="text-xs text-text-secondary">Current Version</span>
        <span className="text-lg font-bold text-text">
          v{dataset.currentVersion}
        </span>
        <span className="text-[11px] text-text-secondary font-mono">
          {dataset.storageFormat}
        </span>
      </div>
      <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-1">
        <span className="text-xs text-text-secondary">Total Records</span>
        <span className="text-lg font-bold text-text">
          {(dataset.rowCount || 0).toLocaleString()}
        </span>
        <span className="text-[11px] text-text-secondary">
          {columnCount} columns
        </span>
      </div>
      <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-1">
        <span className="text-xs text-text-secondary">Quality Score</span>
        <span className="text-lg font-bold text-emerald-400">
          {dataset.qualityScore !== undefined && dataset.qualityScore !== null
            ? `${Math.round(dataset.qualityScore)}%`
            : "N/A"}
        </span>
        <span className="text-[11px] text-text-secondary">DAMA Verified</span>
      </div>
    </div>
  );
};
