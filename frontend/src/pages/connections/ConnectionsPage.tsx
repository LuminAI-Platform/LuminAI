import React, { useMemo, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  Icons,
  RefreshCw,
  Plus,
  AlertCircle,
  ICON_SIZES,
} from "../../lib/icons";
import { Button } from "../../components/ui/Button";
import { FileUploadWizard } from "../../features/connections/components/FileUploadWizard";
import { DatabaseConnectorForm } from "../../features/connections/components/DatabaseConnectorForm";
import { SyncJobDetails } from "../../features/connections/components/SyncJobDetails";
import { ExecutionLogs } from "../../features/connections/components/ExecutionLogs";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { PageHeader } from "../../components/layout/PageHeader";
import { useConnectionModalStore } from "../../stores/connectionModalStore";
import { useConnectionsData } from "./connections/useConnectionsData";
import { SourcesTable, SourcesTableSkeleton } from "./connections/SourcesTable";
import {
  AllSourcesEmptyState,
  DatabaseEmptyState,
  FilesEmptyState,
} from "./connections/ConnectionsEmptyStates";
import { EditConnectionModal } from "./connections/EditConnectionModal";
import { CleanDataModal } from "./connections/CleanDataModal";
import { RawPreviewModal } from "./connections/RawPreviewModal";
import {
  type ConnectionsTab,
  type UnifiedSource,
  formatRelativeTime,
} from "./connections/connectionsTypes";

const TAB_ORDER: ConnectionsTab[] = ["all", "connectors", "files"];

export const ConnectionsPage: React.FC = () => {
  const openChooser = useConnectionModalStore((state) => state.openChooser);
  const tabRefs = useRef<Record<ConnectionsTab, HTMLButtonElement | null>>({
    all: null,
    connectors: null,
    files: null,
  });

  const {
    isWizardOpen,
    initialUploadFile,
    openWizardWithFile,
    closeWizard,
    isDbModalOpen,
    setIsDbModalOpen,
    initialDbType,
    openDbModalWithType,
    previewingFile,
    setPreviewingFile,
    isRawPreviewLoading,
    cleanPreviewFile,
    setCleanPreviewFile,
    cleanData,
    isCleanDataLoading,
    cleanSearchFilter,
    setCleanSearchFilter,
    ingestedFiles,
    customConnectors,
    unifiedSources,
    deleteTarget,
    setDeleteTarget,
    editTarget,
    setEditTarget,
    isDeleting,
    isSavingEdit,
    testingSourceId,
    togglingSourceId,
    isLoading,
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
    handleSaveEdit,
    executeDelete,
  } = useConnectionsData();

  const visibleSources = useMemo(() => {
    if (activeTab === "connectors") {
      return unifiedSources.filter((s) => s.category === "database");
    }
    if (activeTab === "files") {
      return unifiedSources.filter((s) => s.category === "file");
    }
    return unifiedSources;
  }, [activeTab, unifiedSources]);

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: ConnectionsTab,
  ) => {
    const idx = TAB_ORDER.indexOf(currentTab);
    let nextIdx: number | null = null;
    if (e.key === "ArrowRight") {
      nextIdx = (idx + 1) % TAB_ORDER.length;
    } else if (e.key === "ArrowLeft") {
      nextIdx = (idx - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    } else if (e.key === "Home") {
      nextIdx = 0;
    } else if (e.key === "End") {
      nextIdx = TAB_ORDER.length - 1;
    }

    if (nextIdx !== null) {
      e.preventDefault();
      const nextTab = TAB_ORDER[nextIdx];
      setActiveTab(nextTab);
      tabRefs.current[nextTab]?.focus();
    }
  };

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

  if (isWizardOpen) {
    return (
      <FileUploadWizard
        initialFile={initialUploadFile}
        onClose={closeWizard}
        onSuccess={() => {
          closeWizard();
          loadConnectors(false);
        }}
      />
    );
  }

  const tabs: { id: ConnectionsTab; label: string }[] = [
    { id: "all", label: `All sources (${unifiedSources.length})` },
    {
      id: "connectors",
      label: `Database connectors (${customConnectors.length})`,
    },
    { id: "files", label: `Flat files & datasets (${ingestedFiles.length})` },
  ];

  const statusSummaryText = `${
    isPollingPaused ? "Auto-refresh paused" : "Auto-refresh every 15s"
  } - Updated ${formatRelativeTime(lastRefreshedAt)}`;

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-1 pb-8">
      {/* Page Header */}
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

      {/* Error state with Retry and collapsed details */}
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

      {/* Tabs + Schema Studio link */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
        <div
          role="tablist"
          aria-label="Data source categories"
          className="flex flex-wrap items-center gap-5"
        >
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[tab.id] = el;
                }}
                id={`connections-tab-${tab.id}`}
                role="tab"
                type="button"
                aria-selected={isSelected}
                aria-controls="connections-tabpanel"
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
                className={`text-xs font-semibold pb-2 -mb-[9px] border-b-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  isSelected
                    ? "border-primary text-text"
                    : "border-transparent text-text-secondary hover:text-text"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <Link
          to="/connections/schema-map"
          className="text-xs text-primary hover:text-primary-hover font-medium inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Icons.SchemaStudio size={ICON_SIZES.inline} aria-hidden="true" />
          <span>Open Schema Studio</span>
        </Link>
      </div>

      {/* Active Tab Content */}
      <div
        id="connections-tabpanel"
        role="tabpanel"
        aria-labelledby={`connections-tab-${activeTab}`}
      >
        {isLoading ? (
          <SourcesTableSkeleton />
        ) : visibleSources.length > 0 ? (
          <SourcesTable
            sources={visibleSources}
            isLoading={false}
            showTypeFilter={activeTab === "all"}
            testingSourceId={testingSourceId}
            togglingSourceId={togglingSourceId}
            onTestConnection={handleTestConnection}
            onEditSource={setEditTarget}
            onTogglePause={handleTogglePause}
            onDeleteSource={handleRequestDelete}
            onOpenRawPreview={handleOpenRawPreview}
            onInspectCleanData={handleInspectCleanData}
          />
        ) : activeTab === "connectors" ? (
          <DatabaseEmptyState onSelectConnector={openDbModalWithType} />
        ) : activeTab === "files" ? (
          <FilesEmptyState onSelectFile={openWizardWithFile} />
        ) : (
          <AllSourcesEmptyState
            onSelectConnector={openDbModalWithType}
            onSelectFile={openWizardWithFile}
          />
        )}
      </div>

      {/* Observability Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-2">
        <SyncJobDetails />
        <ExecutionLogs />
      </div>

      {isDbModalOpen && (
        <DatabaseConnectorForm
          initialDbType={initialDbType}
          onClose={() => setIsDbModalOpen(false)}
          onSuccess={() => {
            setIsDbModalOpen(false);
            loadConnectors(false);
          }}
        />
      )}

      <EditConnectionModal
        source={editTarget}
        isSaving={isSavingEdit}
        onClose={() => setEditTarget(null)}
        onSave={handleSaveEdit}
      />

      {cleanPreviewFile && (
        <CleanDataModal
          cleanPreviewFile={cleanPreviewFile}
          cleanData={cleanData}
          isCleanDataLoading={isCleanDataLoading}
          cleanSearchFilter={cleanSearchFilter}
          setCleanSearchFilter={setCleanSearchFilter}
          onClose={() => setCleanPreviewFile(null)}
        />
      )}

      {previewingFile && (
        <RawPreviewModal
          previewingFile={previewingFile}
          isRawPreviewLoading={isRawPreviewLoading}
          onClose={() => setPreviewingFile(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={
          deleteTarget?.type === "connection"
            ? `Delete "${deleteTarget.name}"?`
            : `Delete "${deleteTarget?.name ?? "file"}"?`
        }
        description={`Are you sure you want to permanently delete "${deleteTarget?.name}"? Associated sync pipelines will be terminated.`}
        confirmText={isDeleting ? "Deleting..." : "Delete"}
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={executeDelete}
      />
    </div>
  );
};
