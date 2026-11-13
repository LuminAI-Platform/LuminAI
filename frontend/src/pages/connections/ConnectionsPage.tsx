import React from "react";
import { Link } from "@tanstack/react-router";
import { RefreshCw, Clock, Layers, Network, Plus, Radio } from "lucide-react";
import { FileUploadWizard } from "../../features/connections/components/FileUploadWizard";
import { DatabaseConnectorForm } from "../../features/connections/components/DatabaseConnectorForm";
import { SyncJobDetails } from "../../features/connections/components/SyncJobDetails";
import { ExecutionLogs } from "../../features/connections/components/ExecutionLogs";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { PageHeader } from "../../components/layout/PageHeader";
import { useConnectionsData } from "./connections/useConnectionsData";
import { FilesTable } from "./connections/FilesTable";
import { ConnectorsTable } from "./connections/ConnectorsTable";
import { CleanDataModal } from "./connections/CleanDataModal";
import { RawPreviewModal } from "./connections/RawPreviewModal";
import {
  type IngestedFile,
  type DatabaseConnector,
  formatRelativeTime,
} from "./connections/connectionsTypes";

export const ConnectionsPage: React.FC = () => {
  const {
    isWizardOpen,
    setIsWizardOpen,
    isDbModalOpen,
    setIsDbModalOpen,
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
    deleteTarget,
    setDeleteTarget,
    isDeleting,
    isRefreshing,
    lastRefreshedAt,
    error,
    activeTab,
    setActiveTab,
    loadConnectors,
    handleOpenRawPreview,
    handleInspectCleanData,
    executeDelete,
  } = useConnectionsData();

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-1 pb-8">
      {/* Page Header */}
      <PageHeader
        breadcrumbs={[
          { label: "Data Pipelines", to: "/connections" },
          { label: "Data Connections" },
        ]}
        title="Data Connections & Ingestion"
        description="Unified management for flat files, transactional databases, and object storage sync pipelines."
        icon={<Network className="w-5 h-5 text-zinc-300" />}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadConnectors(false)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span>Refresh</span>
            </button>
            <button
              id="btn-upload-file"
              onClick={() => setIsWizardOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-transparent hover:bg-surface-subtle border border-border text-xs font-semibold text-text transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Upload File
            </button>
            <button
              id="btn-add-connection"
              onClick={() => setIsDbModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-hover border border-primary text-xs font-semibold text-primary-text shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Connect Database
            </button>
          </div>
        }
      />

      {/* Auto-refresh Telemetry Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface border border-border rounded-lg text-xs text-text-secondary select-none">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-success animate-pulse" />
          <span>Real-time polling active (15s interval)</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-text-secondary font-mono">
          <Clock className="w-3 h-3" />
          <span>Updated {formatRelativeTime(lastRefreshedAt)}</span>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-error-bg border border-error-border rounded-lg text-xs text-error">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab("connectors")}
            className={`text-xs font-semibold pb-1 border-b-2 transition-colors cursor-pointer ${
              activeTab === "connectors"
                ? "border-primary text-text"
                : "border-transparent text-text-secondary hover:text-text"
            }`}
          >
            Database Connectors ({customConnectors.length})
          </button>
          <button
            onClick={() => setActiveTab("files")}
            className={`text-xs font-semibold pb-1 border-b-2 transition-colors cursor-pointer ${
              activeTab === "files"
                ? "border-primary text-text"
                : "border-transparent text-text-secondary hover:text-text"
            }`}
          >
            Flat Files & Datasets ({ingestedFiles.length})
          </button>
        </div>
        <Link
          to="/connections/schema-map"
          className="text-xs text-primary hover:text-primary-hover font-medium inline-flex items-center gap-1 cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5" /> Schema Studio & Graph Mapper
        </Link>
      </div>

      {activeTab === "connectors" ? (
        <ConnectorsTable
          customConnectors={customConnectors}
          onAddConnector={() => setIsDbModalOpen(true)}
          onDeleteConnector={(c: DatabaseConnector) =>
            setDeleteTarget({ id: c.id!, name: c.name, type: "connection" })
          }
        />
      ) : (
        <FilesTable
          ingestedFiles={ingestedFiles}
          onUploadFile={() => setIsWizardOpen(true)}
          onOpenRawPreview={handleOpenRawPreview}
          onInspectCleanData={handleInspectCleanData}
          onDeleteFile={(f: IngestedFile) =>
            setDeleteTarget({ id: f.id, name: f.name, type: "file" })
          }
        />
      )}

      {/* Observability Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-2">
        <SyncJobDetails />
        <ExecutionLogs />
      </div>

      {isWizardOpen && (
        <FileUploadWizard
          onClose={() => setIsWizardOpen(false)}
          onSuccess={() => {
            setIsWizardOpen(false);
            loadConnectors(false);
          }}
        />
      )}

      {isDbModalOpen && (
        <DatabaseConnectorForm
          onClose={() => setIsDbModalOpen(false)}
          onSuccess={() => {
            setIsDbModalOpen(false);
            loadConnectors(false);
          }}
        />
      )}

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
            ? "Delete Database Connector"
            : "Delete File Dataset"
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
