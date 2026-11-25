import React from "react";
import { Database, Layers, ShieldCheck, ICON_MAP } from "../../../lib/icons";
import type { Dataset } from "../../../features/datasets/types";

interface DatasetKpiSummaryProps {
  datasets: Dataset[];
}

export const DatasetKpiSummary: React.FC<DatasetKpiSummaryProps> = ({
  datasets,
}) => {
  const totalRows = datasets.reduce((sum, d) => sum + (d.rowCount || 0), 0);
  const scoredDatasets = datasets.filter(
    (d) =>
      typeof d.qualityScore === "number" && Number.isFinite(d.qualityScore),
  );
  const avgQuality =
    scoredDatasets.length > 0
      ? Math.round(
          scoredDatasets.reduce((sum, d) => sum + (d.qualityScore ?? 0), 0) /
            scoredDatasets.length,
        )
      : null;
  const activeTierCount = new Set(datasets.map((d) => d.layer).filter(Boolean))
    .size;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-1">
        <div className="flex items-center justify-between text-text-secondary text-xs font-medium">
          <span>Total Datasets</span>
          <Database className="w-4 h-4 text-primary" />
        </div>
        <span className="text-2xl font-bold text-text">{datasets.length}</span>
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
          {avgQuality !== null ? `${avgQuality}%` : "N/A"}
        </span>
        <span className="text-xs text-text-secondary">
          DAMA-aligned 6-dimension evaluation
        </span>
      </div>

      <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-1">
        <div className="flex items-center justify-between text-text-secondary text-xs font-medium">
          <span>Active Tiers</span>
          <ICON_MAP.nav.datasetCatalog
            className="w-4 h-4 text-blue-400"
            aria-hidden="true"
          />
        </div>
        <span className="text-2xl font-bold text-text">
          {activeTierCount} {activeTierCount === 1 ? "Tier" : "Tiers"}
        </span>
        <span className="text-xs text-text-secondary">
          Raw → Working → Curated → Model-Ready
        </span>
      </div>
    </div>
  );
};
