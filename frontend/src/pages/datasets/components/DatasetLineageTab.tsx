import React from "react";
import { ChevronRight } from "../../../lib/icons";
import type { Dataset, LineageGraph } from "../../../features/datasets/types";

interface DatasetLineageTabProps {
  dataset: Dataset;
  lineage?: LineageGraph;
  datasetId: string;
}

export const DatasetLineageTab: React.FC<DatasetLineageTabProps> = ({
  dataset,
  lineage,
  datasetId,
}) => {
  const nodeMap = new Map((lineage?.nodes ?? []).map((n) => [n.id, n]));
  const upstreamLabels = (lineage?.edges ?? [])
    .filter((e) => e.target === datasetId)
    .map((e) => nodeMap.get(e.source)?.label || e.source);
  const downstreamLabels = (lineage?.edges ?? [])
    .filter((e) => e.source === datasetId)
    .map((e) => nodeMap.get(e.target)?.label || e.target);

  return (
    <div className="p-6 rounded-xl border border-border bg-surface flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">
          Dataset Lineage Dependency Graph
        </h3>
        {lineage && (
          <span className="text-xs text-text-secondary font-mono">
            {lineage.nodes.length} nodes • {lineage.edges.length} edges
          </span>
        )}
      </div>
      <div className="p-8 border border-dashed border-border rounded-lg bg-surface-subtle/50 flex flex-col items-center justify-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg border border-border bg-surface text-center min-w-[140px]">
            <span className="text-xs text-text-secondary block">
              Upstream ({upstreamLabels.length})
            </span>
            <span className="text-xs font-bold text-text">
              {upstreamLabels.length > 0
                ? upstreamLabels.join(", ")
                : "None recorded"}
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-text-secondary" />
          <div className="p-3 rounded-lg border-2 border-primary bg-primary/10 text-center min-w-[140px]">
            <span className="text-xs text-primary font-bold block">
              Current Dataset
            </span>
            <span className="text-xs font-bold text-text">
              {dataset.displayName}
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-text-secondary" />
          <div className="p-3 rounded-lg border border-border bg-surface text-center min-w-[140px]">
            <span className="text-xs text-text-secondary block">
              Downstream ({downstreamLabels.length})
            </span>
            <span className="text-xs font-bold text-text">
              {downstreamLabels.length > 0
                ? downstreamLabels.join(", ")
                : "None recorded"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
