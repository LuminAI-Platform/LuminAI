import React from "react";
import type { Dataset, DatasetLayer } from "../../../features/datasets/types";

const ALL_LAYERS: DatasetLayer[] = [
  "RAW",
  "WORKING",
  "PREPARED",
  "CURATED",
  "ANALYTICAL",
  "MODEL_READY",
];

interface DatasetSummaryMetricsProps {
  dataset: Dataset;
  schemaEntriesLength: number;
  onTransitionLayer?: (newLayer: DatasetLayer) => void;
  isTransitioning?: boolean;
}

export const DatasetSummaryMetrics: React.FC<DatasetSummaryMetricsProps> = ({
  dataset,
  schemaEntriesLength,
  onTransitionLayer,
  isTransitioning,
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">Storage Layer</span>
          {onTransitionLayer && (
            <select
              value={dataset.layer}
              disabled={isTransitioning}
              onChange={(e) =>
                onTransitionLayer(e.target.value as DatasetLayer)
              }
              aria-label="Storage Layer Tier"
              className="text-[10px] bg-surface-subtle border border-border rounded px-1.5 py-0.5 text-text font-semibold cursor-pointer"
            >
              {ALL_LAYERS.map((layer) => (
                <option key={layer} value={layer}>
                  {layer}
                </option>
              ))}
            </select>
          )}
        </div>
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
          {schemaEntriesLength} columns
        </span>
      </div>

      <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-1">
        <span className="text-xs text-text-secondary">Quality Score</span>
        <span className="text-lg font-bold text-emerald-400">
          {dataset.qualityScore ? `${Math.round(dataset.qualityScore)}%` : "N/A"}
        </span>
        <span className="text-[11px] text-text-secondary">DAMA Verified</span>
      </div>
    </div>
  );
};
