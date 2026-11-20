import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/layout/PageHeader";
import {
  Icons,
  Search,
  RefreshCw,
  Plus,
  Database,
  ArrowRight,
  ShieldCheck,
  Layers,
  FilterX,
  ICON_SIZES,
} from "../../lib/icons";
import { Button } from "../../components/ui/Button";
import { fetchDatasets } from "../../features/datasets/datasetApi";
import type { Dataset, DatasetLayer } from "../../features/datasets/types";

const LAYER_BADGES: Record<DatasetLayer, { bg: string; text: string; border: string }> = {
  RAW: { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20" },
  PREPARED: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  CURATED: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  ANALYTICAL: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  MODEL_READY: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
};

export const DatasetsPage: React.FC = () => {
  const [selectedLayer, setSelectedLayer] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const {
    data: datasets = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<Dataset[]>({
    queryKey: ["datasets", selectedLayer, searchTerm],
    queryFn: () =>
      fetchDatasets({
        layer: selectedLayer === "ALL" ? undefined : selectedLayer,
        search: searchTerm || undefined,
      }),
  });

  const totalRows = datasets.reduce((sum, d) => sum + (d.rowCount || 0), 0);
  const avgQuality =
    datasets.length > 0
      ? Math.round(
          datasets.reduce((sum, d) => sum + (d.qualityScore || 0), 0) /
            datasets.length,
        )
      : 100;

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        breadcrumbs={[{ label: "Datasets" }]}
        title="Dataset Management & Catalog"
        description="Palantir Foundry-grade governed dataset catalog spanning Raw, Prepared, Curated, and Model-Ready tiers."
        icon={
          <Database
            size={ICON_SIZES.header}
            className="text-text-secondary"
            aria-hidden="true"
          />
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              isLoading={isRefetching}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />}
            >
              Refresh
            </Button>
            <Link to="/connections">
              <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
                Ingest New Dataset
              </Button>
            </Link>
          </div>
        }
      />

      {/* KPI Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-1">
          <div className="flex items-center justify-between text-text-secondary text-xs font-medium">
            <span>Total Datasets</span>
            <Database className="w-4 h-4 text-primary" />
          </div>
          <span className="text-2xl font-bold text-text">{datasets.length}</span>
          <span className="text-xs text-text-secondary">Across all storage tiers</span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-1">
          <div className="flex items-center justify-between text-text-secondary text-xs font-medium">
            <span>Catalog Volume</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-2xl font-bold text-text">{totalRows.toLocaleString()}</span>
          <span className="text-xs text-text-secondary">Total records under management</span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-1">
          <div className="flex items-center justify-between text-text-secondary text-xs font-medium">
            <span>Avg Quality Score</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-bold text-emerald-400">{avgQuality}%</span>
          <span className="text-xs text-text-secondary">DAMA-aligned 6-dimension evaluation</span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-1">
          <div className="flex items-center justify-between text-text-secondary text-xs font-medium">
            <span>Active Tiers</span>
            <Icons.PipelineMonitor className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-2xl font-bold text-text">5 Tiers</span>
          <span className="text-xs text-text-secondary">Raw → Curated → Model-Ready</span>
        </div>
      </div>

      {/* Layer Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-1 rounded-xl bg-surface border border-border">
        <div className="flex items-center gap-1 overflow-x-auto p-1">
          {["ALL", "RAW", "PREPARED", "CURATED", "ANALYTICAL", "MODEL_READY"].map((layer) => (
            <button
              key={layer}
              onClick={() => setSelectedLayer(layer)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                selectedLayer === layer
                  ? "bg-primary text-primary-text font-semibold shadow-xs"
                  : "text-text-secondary hover:text-text hover:bg-surface-subtle"
              }`}
            >
              {layer.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px] px-2 py-1">
          <Search className="w-4 h-4 text-text-secondary absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search datasets by name..."
            className="w-full bg-surface-subtle border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-text placeholder:text-text-secondary focus:outline-hidden focus:border-primary"
          />
        </div>
      </div>

      {/* Dataset Catalog Table */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-text-secondary text-sm flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            <span>Loading enterprise dataset catalog...</span>
          </div>
        ) : datasets.length === 0 ? (
          <div className="p-12 text-center text-text-secondary flex flex-col items-center justify-center gap-3">
            <FilterX className="w-8 h-8 text-text-secondary" />
            <span className="text-sm font-medium">No datasets found in tier "{selectedLayer}".</span>
            <span className="text-xs text-text-secondary max-w-sm">
              Ingest a data source via Data Connections or adjust your search filter.
            </span>
          </div>
        ) : (
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
                  const badge = LAYER_BADGES[d.layer] || LAYER_BADGES.RAW;
                  return (
                    <tr key={d.id} className="hover:bg-surface-subtle/50 transition-colors">
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
                        <span className="text-[11px] font-medium">{d.projectType}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-text">
                        v{d.currentVersion || 1}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-text">
                        {(d.rowCount || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-surface-subtle rounded-full overflow-hidden border border-border">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${Math.min(100, d.qualityScore || 0)}%` }}
                            />
                          </div>
                          <span className="font-semibold text-text">
                            {d.qualityScore ? `${Math.round(d.qualityScore)}%` : "N/A"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-text-secondary uppercase">
                        {d.storageFormat || "PARQUET"}
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
        )}
      </div>
    </div>
  );
};

export default DatasetsPage;
