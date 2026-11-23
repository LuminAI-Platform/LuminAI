import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, FilterX, RefreshCw } from "../../../lib/icons";
import type { Dataset, DatasetLayer } from "../../../features/datasets/types";

const DATASET_LAYER_BADGES: Record<
  DatasetLayer,
  { bg: string; text: string; border: string }
> = {
  RAW: {
    bg: "bg-slate-500/10",
    text: "text-slate-400",
    border: "border-slate-500/20",
  },
  WORKING: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
  },
  PREPARED: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/20",
  },
  CURATED: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
  },
  ANALYTICAL: {
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/20",
  },
  MODEL_READY: {
    bg: "bg-indigo-500/10",
    text: "text-indigo-400",
    border: "border-indigo-500/20",
  },
};

interface DatasetCatalogTableProps {
  datasets: Dataset[];
  isLoading: boolean;
  selectedLayer: string;
}

export const DatasetCatalogTable: React.FC<DatasetCatalogTableProps> = ({
  datasets,
  isLoading,
  selectedLayer,
}) => {
  if (isLoading) {
    return (
      <div className="p-12 text-center text-text-secondary text-sm flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        <span>Loading enterprise dataset catalog...</span>
      </div>
    );
  }

  if (datasets.length === 0) {
    return (
      <div className="p-12 text-center text-text-secondary flex flex-col items-center justify-center gap-3">
        <FilterX className="w-8 h-8 text-text-secondary" />
        <span className="text-sm font-medium">
          No datasets found in tier "{selectedLayer}".
        </span>
        <span className="text-xs text-text-secondary max-w-sm">
          Ingest a data source via Data Connections or adjust your search
          filter.
        </span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-surface-subtle border-b border-border text-text-secondary font-semibold uppercase tracking-wider">
          <tr>
            <th className="py-3 px-4">Dataset Name</th>
            <th className="py-3 px-4">Layer Tier</th>
            <th className="py-3 px-4">Project</th>
            <th className="py-3 px-4">Version</th>
            <th className="py-3 px-4">Record Count</th>
            <th className="py-3 px-4">Quality Score</th>
            <th className="py-3 px-4">Format</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {datasets.map((d) => {
            const badge =
              DATASET_LAYER_BADGES[d.layer] || DATASET_LAYER_BADGES.RAW;
            return (
              <tr
                key={d.id}
                className="hover:bg-surface-subtle/50 transition-colors"
              >
                <td className="py-3.5 px-4">
                  <Link
                    to="/datasets/$datasetId"
                    params={{ datasetId: d.id }}
                    className="font-semibold text-text hover:text-primary transition-colors flex flex-col"
                  >
                    <span>{d.displayName || d.name}</span>
                    <span className="text-[11px] font-normal text-text-secondary font-mono">
                      {d.name}
                    </span>
                  </Link>
                </td>
                <td className="py-3.5 px-4">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                  >
                    {d.layer}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-text-secondary">
                  <span className="text-[11px] font-medium">
                    {d.projectType}
                  </span>
                </td>
                <td className="py-3.5 px-4 font-mono text-text">
                  {d.currentVersion != null ? `v${d.currentVersion}` : "—"}
                </td>
                <td className="py-3.5 px-4 font-mono text-text">
                  {(d.rowCount || 0).toLocaleString()}
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-surface-subtle rounded-full overflow-hidden border border-border">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{
                          width: `${Math.min(100, d.qualityScore || 0)}%`,
                        }}
                      />
                    </div>
                    <span className="font-semibold text-text">
                      {d.qualityScore
                        ? `${Math.round(d.qualityScore)}%`
                        : "N/A"}
                    </span>
                  </div>
                </td>
                <td className="py-3.5 px-4 font-mono text-text-secondary uppercase">
                  {d.storageFormat || "—"}
                </td>
                <td className="py-3.5 px-4 text-right">
                  <Link
                    to="/datasets/$datasetId"
                    params={{ datasetId: d.id }}
                    className="inline-flex items-center gap-1 text-primary hover:text-primary/80 font-medium text-xs"
                  >
                    <span>Inspect</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
