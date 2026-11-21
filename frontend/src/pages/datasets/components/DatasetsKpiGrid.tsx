import React from "react";
import { Icons, Database, ShieldCheck, Layers } from "../../../lib/icons";

interface DatasetsKpiGridProps {
  datasetCount: number;
  totalRows: number;
  avgQuality: number;
}

export const DatasetsKpiGrid: React.FC<DatasetsKpiGridProps> = ({
  datasetCount,
  totalRows,
  avgQuality,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-1">
        <div className="flex items-center justify-between text-text-secondary text-xs font-medium">
          <span>Total Datasets</span>
          <Database className="w-4 h-4 text-primary" />
        </div>
        <span className="text-2xl font-bold text-text">{datasetCount}</span>
        <span className="text-xs text-text-secondary">
          Across all storage tiers
        </span>
      </div>

      <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-1">
        <div className="flex items-center justify-between text-text-secondary text-xs font-medium">
          <span>Catalog Volume</span>
          <Layers className="w-4 h-4 text-purple-400" />
        </div>
        <span className="text-2xl font-bold text-text">
          {totalRows.toLocaleString()}
        </span>
        <span className="text-xs text-text-secondary">
          Total records under management
        </span>
      </div>

      <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-1">
        <div className="flex items-center justify-between text-text-secondary text-xs font-medium">
          <span>Avg Quality Score</span>
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
        </div>
        <span className="text-2xl font-bold text-emerald-400">
          {avgQuality}%
        </span>
        <span className="text-xs text-text-secondary">
          DAMA-aligned 6-dimension evaluation
        </span>
      </div>

      <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-1">
        <div className="flex items-center justify-between text-text-secondary text-xs font-medium">
          <span>Active Tiers</span>
          <Icons.PipelineMonitor className="w-4 h-4 text-blue-400" />
        </div>
        <span className="text-2xl font-bold text-text">5 Tiers</span>
        <span className="text-xs text-text-secondary">
          Raw → Curated → Model-Ready
        </span>
      </div>
    </div>
  );
};
