import React, { useMemo, useRef, useState } from "react";
import {
  Icons,
  RefreshCw,
  Plus,
  AlertCircle,
  ICON_SIZES,
} from "../../lib/icons";
import { Button } from "../../components/ui/Button";
import { SyncJobDetails } from "../../features/connections/components/SyncJobDetails";
import { ExecutionLogs } from "../../features/connections/components/ExecutionLogs";
import type { PipelineRunItem } from "../../features/connections/components/pipeline-analysis/pipelineAnalysisTypes";
import { PageHeader } from "../../components/layout/PageHeader";
import { useConnectionModalStore } from "../../stores/connectionModalStore";
import { useConnectionsData } from "./connections/useConnectionsData";
import { SourcesTable, SourcesTableSkeleton } from "./connections/SourcesTable";
import {
  AllSourcesEmptyState,
  DatabaseEmptyState,
  FilesEmptyState,
} from "./connections/ConnectionsEmptyStates";
import { ConnectionsTabBar } from "./connections/ConnectionsTabBar";
import { ConnectionsModals } from "./connections/ConnectionsModals";
import {
  type UnifiedSource,
  formatRelativeTime,
} from "./connections/connectionsTypes";

export const ConnectionsPage: React.FC = () => {
  const openChooser = useConnectionModalStore((state) => state.openChooser);
  const [selectedRunDetail, setSelectedRunDetail] = useState<{
    run: PipelineRunItem | null;
    runId?: string | null;
  } | null>(null);
  const runDetailTriggerRef = useRef<HTMLElement | null>(null);

  const handleOpenRunDetail = (
    runOrId: PipelineRunItem | string,
    triggerEl: HTMLElement | null,
  ) => {
    runDetailTriggerRef.current = triggerEl;
    if (typeof runOrId === "string") {
      setSelectedRunDetail({ run: null, runId: runOrId });
    } else {
      setSelectedRunDetail({ run: runOrId, runId: runOrId.id });
    }
  };

  const data = useConnectionsData();

  const visibleSources = useMemo(() => {
    if (data.activeTab === "connectors") {
      return data.unifiedSources.filter((s) => s.category === "database");
    }
    if (data.activeTab === "files") {
      return data.unifiedSources.filter((s) => s.category === "file");
    }
    return data.unifiedSources;
  }, [data.activeTab, data.unifiedSources]);

  const primaryAction = (() => {
    if (data.activeTab === "files") {
      return {
        id: "btn-upload-file",
        label: "Upload file",
        onClick: () => data.openWizardWithFile(null),
      };
    }
    if (data.activeTab === "connectors") {
      return {
        id: "btn-add-connection",
        label: "Connect database",
        onClick: () => data.openDbModalWithType("postgresql"),
      };
    }
    return {
      id: "btn-new-connection",
      label: "New connection",
      onClick: openChooser,
    };
  })();

  const handleRequestDelete = (source: UnifiedSource) => {
    data.setDeleteTarget({
      id: source.id,
      name: source.name,
      type: source.category === "database" ? "connection" : "file",
    });
  };

  const statusSummaryText = `${
    data.isPollingPaused ? "Auto-refresh paused" : "Auto-refresh every 15s"
  } - Updated ${formatRelativeTime(data.lastRefreshedAt)}`;

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-1 pb-8">
      <PageHeader
        breadcrumbs={[
          { label: "Data Pipelines", to: "/connections" },
          { label: "Data Connections" },
        ]}
        title="Data Connections & Ingestion"
        description="Unified management for flat files and transactional database sync pipelines."
        icon={
          <Icons.DataConnections
            size={ICON_SIZES.header}
            className="text-text-secondary"
            aria-hidden="true"
          />
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="text-xs text-text-secondary select-none">
              {statusSummaryText}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => data.loadConnectors(false)}
              isLoading={data.isRefreshing}
              disabled={data.isRefreshing}
              leftIcon={
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              }
            >
              Refresh
            </Button>
            <Button
              id={primaryAction.id}
              variant="primary"
              size="sm"
              onClick={primaryAction.onClick}
              leftIcon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />}
            >
              {primaryAction.label}
            </Button>
          </div>
        }
      />

      {data.error && (
        <div
          role="alert"
          className="p-4 bg-error-bg border border-error-border rounded-lg flex flex-col gap-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs text-error font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Could not load data connections.</span>
            </div>
            <Button
              variant="secondary"
              size="xs"
              onClick={() => data.loadConnectors(false)}
              isLoading={data.isRefreshing}
            >
              Retry
            </Button>
          </div>
          <details className="text-xs text-text-secondary">
            <summary className="cursor-pointer select-none hover:text-text transition-colors">
              Show details
            </summary>
            <p className="mt-1.5 text-error break-words">{data.error}</p>
          </details>
        </div>
      )}

      <ConnectionsTabBar
        activeTab={data.activeTab}
        onSelectTab={data.setActiveTab}
        totalCount={data.unifiedSources.length}
        connectorsCount={data.customConnectors.length}
        filesCount={data.ingestedFiles.length}
      />

      <div
        id="connections-tabpanel"
        role="tabpanel"
        aria-labelledby={`connections-tab-${data.activeTab}`}
      >
        {data.isLoading ? (
          <SourcesTableSkeleton />
        ) : visibleSources.length > 0 ? (
          <SourcesTable
            sources={visibleSources}
            isLoading={false}
            showTypeFilter={data.activeTab === "all"}
            testingSourceId={data.testingSourceId}
            togglingSourceId={data.togglingSourceId}
            onTestConnection={data.handleTestConnection}
            onEditSource={data.setEditTarget}
            onTogglePause={data.handleTogglePause}
            onDeleteSource={handleRequestDelete}
            onOpenRawPreview={data.handleOpenRawPreview}
            onInspectCleanData={data.handleInspectCleanData}
          />
        ) : data.activeTab === "connectors" ? (
          <DatabaseEmptyState onSelectConnector={data.openDbModalWithType} />
        ) : data.activeTab === "files" ? (
          <FilesEmptyState onSelectFile={data.openWizardWithFile} />
        ) : (
          <AllSourcesEmptyState
            onSelectConnector={data.openDbModalWithType}
            onSelectFile={data.openWizardWithFile}
          />
        )}
      </div>

      {/* Observability Section — stacks below 1100px */}
      <div className="grid grid-cols-1 min-[1100px]:grid-cols-2 gap-5 mt-2 items-start">
        <SyncJobDetails onOpenRunDetail={handleOpenRunDetail} />
        <ExecutionLogs onOpenRunDetail={handleOpenRunDetail} />
      </div>

      <ConnectionsModals
        selectedRunDetail={selectedRunDetail}
        onCloseRunDetail={() => setSelectedRunDetail(null)}
        runDetailTriggerRef={runDetailTriggerRef}
        isWizardOpen={data.isWizardOpen}
        initialUploadFile={data.initialUploadFile}
        closeWizard={data.closeWizard}
        isDbModalOpen={data.isDbModalOpen}
        setIsDbModalOpen={data.setIsDbModalOpen}
        initialDbType={data.initialDbType}
        editTarget={data.editTarget}
        isSavingEdit={data.isSavingEdit}
        setEditTarget={data.setEditTarget}
        handleSaveEdit={data.handleSaveEdit}
        cleanPreviewFile={data.cleanPreviewFile}
        setCleanPreviewFile={data.setCleanPreviewFile}
        cleanData={data.cleanData}
        isCleanDataLoading={data.isCleanDataLoading}
        cleanSearchFilter={data.cleanSearchFilter}
        setCleanSearchFilter={data.setCleanSearchFilter}
        previewingFile={data.previewingFile}
        setPreviewingFile={data.setPreviewingFile}
        isRawPreviewLoading={data.isRawPreviewLoading}
        deleteTarget={data.deleteTarget}
        setDeleteTarget={data.setDeleteTarget}
        isDeleting={data.isDeleting}
        executeDelete={data.executeDelete}
        onRefresh={() => data.loadConnectors(false)}
      />
    </div>
  );
};
