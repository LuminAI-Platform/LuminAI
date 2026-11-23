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
          <div className="p-3 rounded-lg border border-border bg-surface text-center">
            <span className="text-xs text-text-secondary block">Upstream</span>
            <span className="text-xs font-bold text-text">
              {lineage?.nodes.find((n) => n.id !== datasetId)?.label ||
                "Ingestion Source"}
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-text-secondary" />
          <div className="p-3 rounded-lg border-2 border-primary bg-primary/10 text-center">
            <span className="text-xs text-primary font-bold block">
              Current Dataset
            </span>
            <span className="text-xs font-bold text-text">
              {dataset.displayName}
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-text-secondary" />
          <div className="p-3 rounded-lg border border-border bg-surface text-center">
            <span className="text-xs text-text-secondary block">
              Downstream
            </span>
            <span className="text-xs font-bold text-text">
              {lineage?.edges.length
                ? `${lineage.edges.length} Dependencies`
                : "Analytics & ML Models"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
