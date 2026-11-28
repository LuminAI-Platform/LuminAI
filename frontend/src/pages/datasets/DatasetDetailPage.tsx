import React, { useState } from "react";
import { useParams, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "../../components/layout/PageHeader";
import {
  Database,
  RefreshCw,
  GitCommit,
  ShieldCheck,
  Shield,
  Table,
  Cpu,
  GitBranch,
  Trash2,
  BarChart3,
  Eye,
  Wand2,
  ICON_SIZES,
} from "../../lib/icons";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import {
  fetchDatasetById,
  fetchDatasetVersions,
  fetchDatasetLineage,
  transitionDatasetLayer,
  deleteDataset,
  generateEdaReport,
} from "../../features/datasets/datasetApi";
import type {
  Dataset,
  DatasetLayer,
  DatasetVersion,
  LineageGraph,
} from "../../features/datasets/types";
import { DatasetProfilerTab } from "./components/DatasetProfilerTab";
import { DatasetPreviewTab } from "./components/DatasetPreviewTab";
import { DatasetSchemaTab } from "./components/DatasetSchemaTab";
import { DatasetPrepTab } from "./components/DatasetPrepTab";
import { DatasetQualityRulesTab } from "./components/DatasetQualityRulesTab";
import { DatasetVersionsTab } from "./components/DatasetVersionsTab";
import { DatasetLineageTab } from "./components/DatasetLineageTab";
import { DatasetSummaryMetrics } from "./components/DatasetSummaryMetrics";

export const DatasetDetailPage: React.FC = () => {
  const { datasetId } = useParams({ strict: false }) as { datasetId: string };
  const navigate = useNavigate();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    | "profiler"
    | "preview"
    | "schema"
    | "prep"
    | "rules"
    | "versions"
    | "lineage"
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

  const { data: versions = [], refetch: refetchVersions } = useQuery<
    DatasetVersion[]
  >({
    queryKey: ["dataset-versions", datasetId],
    queryFn: () => fetchDatasetVersions(datasetId),
    enabled: !!datasetId,
  });

  const { data: lineage } = useQuery<LineageGraph>({
    queryKey: ["dataset-lineage", datasetId],
    queryFn: () => fetchDatasetLineage(datasetId),
    enabled: !!datasetId,
  });

  const transitionMutation = useMutation({
    mutationFn: (newLayer: DatasetLayer) =>
      transitionDatasetLayer(datasetId, newLayer),
    onSuccess: () => void refetch(),
  });

  const edaMutation = useMutation({
    mutationFn: () => generateEdaReport(datasetId),
    onSuccess: () => void refetch(),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDataset(datasetId),
    onSuccess: () => void navigate({ to: "/datasets" }),
  });

  const actionError =
    transitionMutation.error || edaMutation.error || deleteMutation.error;

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
            <Button
              variant="secondary"
              size="sm"
              onClick={() => edaMutation.mutate()}
              isLoading={edaMutation.isPending}
              leftIcon={<BarChart3 className="w-3.5 h-3.5" />}
            >
              Run EDA
            </Button>
            <Link to="/analytics/sql" search={{ datasetId: dataset.id }}>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Table className="w-3.5 h-3.5" />}
              >
                Query SQL
              </Button>
            </Link>
            <Link to="/datascience/models" search={{ datasetId: dataset.id }}>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Cpu className="w-3.5 h-3.5" />}
              >
                Train ML
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setConfirmDeleteOpen(true)}
              leftIcon={<Trash2 className="w-3.5 h-3.5 text-error" />}
            >
              Delete
            </Button>
          </div>
        }
      />

      {actionError && (
        <div className="p-3 rounded-lg border border-error/30 bg-error/10 text-error text-xs">
          {actionError instanceof Error
            ? actionError.message
            : "Dataset operation failed."}
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete Dataset"
        description={`Permanently delete "${dataset.displayName || dataset.name}" and its catalog metadata?`}
        confirmText="Delete Dataset"
        isDestructive={true}
        onConfirm={() => deleteMutation.mutate()}
        isLoading={deleteMutation.isPending}
      />

      <DatasetSummaryMetrics
        dataset={dataset}
        schemaEntriesLength={schemaEntries.length}
        onTransitionLayer={(layer) => transitionMutation.mutate(layer)}
        isTransitioning={transitionMutation.isPending}
      />

      <div className="border-b border-border flex items-center gap-4 text-xs font-medium overflow-x-auto">
        {(
          [
            {
              key: "profiler",
              label: "Data Profiler & Quality",
              Icon: ShieldCheck,
            },
            { key: "preview", label: "Data Preview", Icon: Eye },
            { key: "schema", label: "Schema & Contract", Icon: Table },
            { key: "prep", label: "Prep & Pipelines", Icon: Wand2 },
            { key: "rules", label: "Quality Rules", Icon: Shield },
            {
              key: "versions",
              label: `Version Commits (${versions.length})`,
              Icon: GitCommit,
            },
            { key: "lineage", label: "Lineage Graph", Icon: GitBranch },
          ] as const
        ).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`pb-3 px-1 border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === key
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-text-secondary hover:text-text"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {activeTab === "profiler" && (
        <DatasetProfilerTab
          dataset={dataset}
          schemaEntries={schemaEntries}
          onRunEda={() => edaMutation.mutate()}
          isRunningEda={edaMutation.isPending}
        />
      )}

      {activeTab === "preview" && <DatasetPreviewTab datasetId={datasetId} />}

      {activeTab === "schema" && (
        <DatasetSchemaTab dataset={dataset} schemaEntries={schemaEntries} />
      )}

      {activeTab === "prep" && (
        <DatasetPrepTab dataset={dataset} schemaEntries={schemaEntries} />
      )}

      {activeTab === "rules" && (
        <DatasetQualityRulesTab
          datasetId={datasetId}
          schemaEntries={schemaEntries}
        />
      )}

      {activeTab === "versions" && (
        <DatasetVersionsTab
          datasetId={datasetId}
          currentRowCount={dataset.rowCount}
          versions={versions}
          onVersionCommitted={() => {
            void refetch();
            void refetchVersions();
          }}
        />
      )}

      {activeTab === "lineage" && (
        <DatasetLineageTab
          dataset={dataset}
          lineage={lineage}
          datasetId={datasetId}
        />
      )}
    </div>
  );
};

export default DatasetDetailPage;
