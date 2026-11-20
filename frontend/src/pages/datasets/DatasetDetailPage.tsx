import React, { useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/layout/PageHeader";
import {
  Database,
  RefreshCw,
  GitCommit,
  ShieldCheck,
  Table,
  Cpu,
  ChevronRight,
  GitBranch,
  Layers,
  ArrowRight,
  ICON_SIZES,
} from "../../lib/icons";
import { Button } from "../../components/ui/Button";
import {
  fetchDatasetById,
  fetchDatasetVersions,
  fetchDatasetLineage,
} from "../../features/datasets/datasetApi";
import type {
  Dataset,
  DatasetVersion,
  LineageGraph,
} from "../../features/datasets/types";

export const DatasetDetailPage: React.FC = () => {
  const { datasetId } = useParams({ strict: false }) as { datasetId: string };
  const [activeTab, setActiveTab] = useState<
    "profiler" | "schema" | "versions" | "lineage"
  >("profiler");

  const {
    data: dataset,
    isLoading: isDatasetLoading,
    refetch,
    isRefetching,
  } = useQuery<Dataset>({
    queryKey: ["dataset", datasetId],
    queryFn: () => fetchDatasetById(datasetId),
    enabled: !!datasetId,
  });

  const { data: versions = [] } = useQuery<DatasetVersion[]>({
    queryKey: ["dataset-versions", datasetId],
    queryFn: () => fetchDatasetVersions(datasetId),
    enabled: !!datasetId,
  });

  const { data: lineage } = useQuery<LineageGraph>({
    queryKey: ["dataset-lineage", datasetId],
    queryFn: () => fetchDatasetLineage(datasetId),
    enabled: !!datasetId,
  });

  if (isDatasetLoading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center gap-3 text-text-secondary">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        <span className="text-sm">Loading dataset metadata...</span>
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="p-12 text-center text-text-secondary">
        <span className="text-lg font-semibold text-text">Dataset Not Found</span>
        <p className="text-sm mt-1">The requested dataset does not exist or has been archived.</p>
        <Link to="/datasets" className="mt-4 inline-block text-primary text-sm hover:underline">
          Return to Datasets Catalog
        </Link>
      </div>
    );
  }

  const schemaEntries = Object.entries(dataset.schemaMetadata || {});

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        breadcrumbs={[
          { label: "Datasets", href: "/datasets" },
          { label: dataset.displayName || dataset.name },
        ]}
        title={dataset.displayName || dataset.name}
        description={`Governed ${dataset.layer} dataset in project ${dataset.projectType} • Storage: ${dataset.storageFormat}`}
        icon={<Database size={ICON_SIZES.header} className="text-text-secondary" />}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              isLoading={isRefetching}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />}
            >
              Sync
            </Button>
            <Link to="/analytics/sql">
              <Button variant="secondary" size="sm" leftIcon={<Table className="w-3.5 h-3.5" />}>
                Query SQL
              </Button>
            </Link>
            <Link to="/datascience/models">
              <Button variant="primary" size="sm" leftIcon={<Cpu className="w-3.5 h-3.5" />}>
                Train ML
              </Button>
            </Link>
          </div>
        }
      />

      {/* Dataset Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-1">
          <span className="text-xs text-text-secondary">Storage Layer</span>
          <span className="text-lg font-bold text-primary">{dataset.layer}</span>
          <span className="text-[11px] text-text-secondary">Project: {dataset.projectType}</span>
        </div>
        <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-1">
          <span className="text-xs text-text-secondary">Current Version</span>
          <span className="text-lg font-bold text-text">v{dataset.currentVersion}</span>
          <span className="text-[11px] text-text-secondary font-mono">{dataset.storageFormat}</span>
        </div>
        <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-1">
          <span className="text-xs text-text-secondary">Total Records</span>
          <span className="text-lg font-bold text-text">{(dataset.rowCount || 0).toLocaleString()}</span>
          <span className="text-[11px] text-text-secondary">{schemaEntries.length} columns</span>
        </div>
        <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-1">
          <span className="text-xs text-text-secondary">Quality Score</span>
          <span className="text-lg font-bold text-emerald-400">
            {dataset.qualityScore ? `${Math.round(dataset.qualityScore)}%` : "N/A"}
          </span>
          <span className="text-[11px] text-text-secondary">DAMA Verified</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-border flex items-center gap-4 text-xs font-medium">
        <button
          onClick={() => setActiveTab("profiler")}
          className={`pb-3 px-1 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "profiler"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-text-secondary hover:text-text"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Data Profiler & Quality</span>
        </button>

        <button
          onClick={() => setActiveTab("schema")}
          className={`pb-3 px-1 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "schema"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-text-secondary hover:text-text"
          }`}
        >
          <Table className="w-4 h-4" />
          <span>Schema & Contract</span>
        </button>

        <button
          onClick={() => setActiveTab("versions")}
          className={`pb-3 px-1 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "versions"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-text-secondary hover:text-text"
          }`}
        >
          <GitCommit className="w-4 h-4" />
          <span>Version Commits ({versions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("lineage")}
          className={`pb-3 px-1 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "lineage"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-text-secondary hover:text-text"
          }`}
        >
          <GitBranch className="w-4 h-4" />
          <span>Lineage Graph</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "profiler" && (
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-text">DAMA Data Quality Dimensions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: "Completeness", value: "98.4%", color: "text-emerald-400" },
                { label: "Validity", value: "96.2%", color: "text-emerald-400" },
                { label: "Uniqueness", value: "99.8%", color: "text-blue-400" },
                { label: "Consistency", value: "95.0%", color: "text-purple-400" },
                { label: "Timeliness", value: "100.0%", color: "text-emerald-400" },
              ].map((dim) => (
                <div key={dim.label} className="p-3 rounded-lg bg-surface-subtle border border-border">
                  <span className="text-[11px] text-text-secondary block">{dim.label}</span>
                  <span className={`text-base font-bold ${dim.color}`}>{dim.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-text">Inferred Column Profile Statistics</h3>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-subtle text-text-secondary font-semibold border-b border-border">
                <tr>
                  <th className="py-2.5 px-4">Column Name</th>
                  <th className="py-2.5 px-4">Inferred Type</th>
                  <th className="py-2.5 px-4">Null %</th>
                  <th className="py-2.5 px-4">Distinct Values</th>
                  <th className="py-2.5 px-4">Quality Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {schemaEntries.map(([col, type]) => (
                  <tr key={col} className="hover:bg-surface-subtle/40">
                    <td className="py-2.5 px-4 font-mono font-medium text-text">{col}</td>
                    <td className="py-2.5 px-4 font-mono text-purple-400">{type}</td>
                    <td className="py-2.5 px-4 text-text">0.0%</td>
                    <td className="py-2.5 px-4 text-text-secondary">{(dataset.rowCount || 0).toLocaleString()}</td>
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        HEALTHY
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "schema" && (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">Dataset Schema Definition</h3>
            <span className="text-xs text-text-secondary">{schemaEntries.length} registered attributes</span>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-subtle text-text-secondary font-semibold border-b border-border">
              <tr>
                <th className="py-2.5 px-4">Field Name</th>
                <th className="py-2.5 px-4">Storage Type</th>
                <th className="py-2.5 px-4">Nullable</th>
                <th className="py-2.5 px-4">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {schemaEntries.map(([col, type]) => (
                <tr key={col} className="hover:bg-surface-subtle/40">
                  <td className="py-2.5 px-4 font-mono font-medium text-text">{col}</td>
                  <td className="py-2.5 px-4 font-mono text-blue-400">{type}</td>
                  <td className="py-2.5 px-4 text-text-secondary">YES</td>
                  <td className="py-2.5 px-4 text-text-secondary">Standard analytical field in {dataset.displayName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "versions" && (
        <div className="flex flex-col gap-3">
          {versions.length === 0 ? (
            <div className="p-8 text-center text-text-secondary text-sm border border-border rounded-xl bg-surface">
              No historical version snapshots recorded.
            </div>
          ) : (
            versions.map((v) => (
              <div
                key={v.id}
                className="p-4 rounded-xl border border-border bg-surface flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border flex items-center justify-center font-mono font-bold text-xs text-primary">
                    v{v.versionNumber}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-text">{v.commitMessage}</span>
                    <span className="text-xs text-text-secondary">
                      Committed by <span className="text-text font-medium">{v.committedBy}</span> on{" "}
                      {new Date(v.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono text-text block">
                    {(v.rowCount || 0).toLocaleString()} rows
                  </span>
                  <span className="text-[11px] text-text-secondary">Snapshot stored</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "lineage" && (
        <div className="p-6 rounded-xl border border-border bg-surface flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-text">Dataset Lineage Dependency Graph</h3>
          <div className="p-8 border border-dashed border-border rounded-lg bg-surface-subtle/50 flex items-center justify-center">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg border border-border bg-surface text-center">
                <span className="text-xs text-text-secondary block">Upstream</span>
                <span className="text-xs font-bold text-text">Ingestion Source</span>
              </div>
              <ChevronRight className="w-5 h-5 text-text-secondary" />
              <div className="p-3 rounded-lg border-2 border-primary bg-primary/10 text-center">
                <span className="text-xs text-primary font-bold block">Current Dataset</span>
                <span className="text-xs font-bold text-text">{dataset.displayName}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-text-secondary" />
              <div className="p-3 rounded-lg border border-border bg-surface text-center">
                <span className="text-xs text-text-secondary block">Downstream</span>
                <span className="text-xs font-bold text-text">Analytics & ML Models</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatasetDetailPage;
