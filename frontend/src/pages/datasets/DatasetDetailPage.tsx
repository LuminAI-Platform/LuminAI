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
  GitBranch,
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
import { DatasetProfilerTab } from "./components/DatasetProfilerTab";
import { DatasetSchemaTab } from "./components/DatasetSchemaTab";
import { DatasetVersionsTab } from "./components/DatasetVersionsTab";
import { DatasetSummaryCards } from "./components/DatasetSummaryCards";
import { DatasetLineageTab } from "./components/DatasetLineageTab";

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
        <span className="text-lg font-semibold text-text">
          Dataset Not Found
        </span>
        <p className="text-sm mt-1">
          The requested dataset does not exist or has been archived.
        </p>
        <Link
          to="/datasets"
          className="mt-4 inline-block text-primary text-sm hover:underline"
        >
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
          { label: "Datasets", to: "/datasets" },
          { label: dataset.displayName || dataset.name },
        ]}
        title={dataset.displayName || dataset.name}
        description={`Governed ${dataset.layer} dataset in project ${dataset.projectType} • Storage: ${dataset.storageFormat}`}
        icon={
          <Database size={ICON_SIZES.header} className="text-text-secondary" />
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              isLoading={isRefetching}
              leftIcon={
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`}
                />
              }
            >
              Sync
            </Button>
            <Link to="/analytics/sql">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Table className="w-3.5 h-3.5" />}
              >
                Query SQL
              </Button>
            </Link>
            <Link to="/datascience/models">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Cpu className="w-3.5 h-3.5" />}
              >
                Train ML
              </Button>
            </Link>
          </div>
        }
      />

      <DatasetSummaryCards
        dataset={dataset}
        columnCount={schemaEntries.length}
      />

      {/* Navigation Tabs */}
      <div className="border-b border-border flex items-center gap-4 text-xs font-medium">
        <button
          type="button"
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
          type="button"
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
          type="button"
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
          type="button"
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
        <DatasetProfilerTab dataset={dataset} schemaEntries={schemaEntries} />
      )}

      {activeTab === "schema" && (
        <DatasetSchemaTab dataset={dataset} schemaEntries={schemaEntries} />
      )}

      {activeTab === "versions" && <DatasetVersionsTab versions={versions} />}

      {activeTab === "lineage" && (
        <DatasetLineageTab
          dataset={dataset}
          datasetId={datasetId}
          lineage={lineage}
        />
      )}
    </div>
  );
};

export default DatasetDetailPage;
