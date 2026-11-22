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
import { ConnectionsTabsBar } from "./connections/ConnectionsTabsBar";
import { ConnectionsModals } from "./connections/ConnectionsModals";
import { ConnectionsTabContent } from "./connections/ConnectionsTabContent";
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

  const connData = useConnectionsData();
  const {
    openWizardWithFile,
    openDbModalWithType,
    unifiedSources,
    customConnectors,
    ingestedFiles,
    setDeleteTarget,
    setEditTarget,
    isRefreshing,
    isPollingPaused,
    lastRefreshedAt,
    error,
    activeTab,
    setActiveTab,
    loadConnectors,
    handleOpenRawPreview,
    handleInspectCleanData,
    handleTestConnection,
    handleTogglePause,
    testingSourceId,
    togglingSourceId,
    isLoading,
  } = connData;

  const visibleSources = useMemo(() => {
    if (activeTab === "connectors") {
      return unifiedSources.filter((s) => s.category === "database");
    }
    if (activeTab === "files") {
      return unifiedSources.filter((s) => s.category === "file");
    }
    return unifiedSources;
  }, [activeTab, unifiedSources]);

  const primaryAction = (() => {
    if (activeTab === "files") {
      return {
        id: "btn-upload-file",
        label: "Upload file",
        onClick: () => openWizardWithFile(null),
      };
    }
    if (activeTab === "connectors") {
      return {
        id: "btn-add-connection",
        label: "Connect database",
        onClick: () => openDbModalWithType("postgresql"),
      };
    }
    return {
      id: "btn-new-connection",
      label: "New connection",
      onClick: openChooser,
    };
  })();

  const handleRequestDelete = (source: UnifiedSource) => {
    setDeleteTarget({
      id: source.id,
      name: source.name,
      type: source.category === "database" ? "connection" : "file",
    });
  };

  const statusSummaryText = `${
    isPollingPaused ? "Auto-refresh paused" : "Auto-refresh every 15s"
  } - Updated ${formatRelativeTime(lastRefreshedAt)}`;

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
              onClick={() => loadConnectors(false)}
              isLoading={isRefreshing}
              disabled={isRefreshing}
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

      {error && (
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
              onClick={() => loadConnectors(false)}
              isLoading={isRefreshing}
            >
              Retry
            </Button>
          </div>
          <details className="text-xs text-text-secondary">
            <summary className="cursor-pointer select-none hover:text-text transition-colors">
              Show details
            </summary>
            <p className="mt-1.5 text-error break-words">{error}</p>
          </details>
        </div>
      )}

      <ConnectionsTabsBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unifiedSourcesCount={unifiedSources.length}
        customConnectorsCount={customConnectors.length}
        ingestedFilesCount={ingestedFiles.length}
      />

      <ConnectionsTabContent
        isLoading={isLoading}
        visibleSources={visibleSources}
        activeTab={activeTab}
        testingSourceId={testingSourceId}
        togglingSourceId={togglingSourceId}
        onTestConnection={handleTestConnection}
        onEditSource={setEditTarget}
        onTogglePause={handleTogglePause}
        onDeleteSource={handleRequestDelete}
        onOpenRawPreview={handleOpenRawPreview}
        onInspectCleanData={handleInspectCleanData}
        onOpenDbModal={() => openDbModalWithType("postgresql")}
        onOpenWizard={() => openWizardWithFile(null)}
      />

      <div className="grid grid-cols-1 min-[1100px]:grid-cols-2 gap-5 mt-2 items-start">
        <SyncJobDetails onOpenRunDetail={handleOpenRunDetail} />
        <ExecutionLogs onOpenRunDetail={handleOpenRunDetail} />
      </div>

      <ConnectionsModals
        selectedRunDetail={selectedRunDetail}
        onCloseRunDetail={() => setSelectedRunDetail(null)}
        runDetailTriggerRef={runDetailTriggerRef}
        connData={connData}
      />
    </div>
  );
};
