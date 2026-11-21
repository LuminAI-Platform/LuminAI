import React from "react";
import { Tooltip } from "../../../components/ui/Tooltip";
import type { DataQuality } from "../../../pages/dashboard/useDashboardData";

export interface DataQualityDimensionsPanelProps {
  quality?: DataQuality;
  hasLiveRuns: boolean;
  hasCompletedRuns: boolean;
  liveRuns: number;
  recordsEvaluated?: number;
}

const QUALITY_DIMENSIONS: Array<{
  label: string;
  key: "completeness" | "uniqueness" | "consistency" | "timeliness";
}> = [
  { label: "Completeness", key: "completeness" },
  { label: "Uniqueness", key: "uniqueness" },
  { label: "Consistency", key: "consistency" },
  { label: "Timeliness", key: "timeliness" },
];

export const DataQualityDimensionsPanel: React.FC<
  DataQualityDimensionsPanelProps
> = ({
  quality,
  hasLiveRuns,
  hasCompletedRuns,
  liveRuns,
  recordsEvaluated,
}) => {
  let evaluationCaption: React.ReactNode;
  if (typeof recordsEvaluated === "number" && recordsEvaluated > 0) {
    evaluationCaption = `${recordsEvaluated.toLocaleString()} records evaluated`;
  } else if (!hasLiveRuns && hasCompletedRuns) {
    const tooltipText =
      "Run history is available, but the engine has not reported live metrics.";
    evaluationCaption = (
      <Tooltip label={tooltipText} side="top">
        <span
          title={tooltipText}
          className="cursor-help underline decoration-dotted underline-offset-2"
        >
          No live data from engine
        </span>
      </Tooltip>
    );
  } else if (hasLiveRuns) {
    evaluationCaption = `${liveRuns.toLocaleString()} runs recorded`;
  } else {
    evaluationCaption = "No runs yet";
  }

  const canShowScores = hasLiveRuns || hasCompletedRuns;

  return (
    <div className="bg-surface-subtle border border-border rounded-lg p-3">
      <div className="flex items-center justify-between text-xs text-text-secondary mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text">Data quality</span>
          {hasLiveRuns && (
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary bg-surface px-1.5 py-0.5 rounded border border-border">
              Live
            </span>
          )}
        </div>
        <span className="text-[11px] text-text-secondary">
          {evaluationCaption}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {QUALITY_DIMENSIONS.map(({ label, key }) => {
          const val = quality?.[key];
          const display =
            val !== undefined && val !== null && canShowScores
              ? `${val.toFixed(1)}%`
              : "–";
          return (
            <div key={key} className="flex flex-col">
              <span className="text-[11px] text-text-secondary">{label}</span>
              <span className="text-text font-semibold">{display}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
