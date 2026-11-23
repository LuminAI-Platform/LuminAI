import React from "react";
import { FileUploadWizard } from "../../../features/connections/components/FileUploadWizard";
import { DatabaseConnectorForm } from "../../../features/connections/components/DatabaseConnectorForm";
import { RunDetailDrawer } from "../../../features/connections/components/pipeline-analysis/RunDetailDrawer";
import type { PipelineRunItem } from "../../../features/connections/components/pipeline-analysis/pipelineAnalysisTypes";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { EditConnectionModal } from "./EditConnectionModal";
import { CleanDataModal } from "./CleanDataModal";
import { RawPreviewModal } from "./RawPreviewModal";
import type { useConnectionsData } from "./useConnectionsData";

interface ConnectionsModalsProps {
  selectedRunDetail: {
    run: PipelineRunItem | null;
    runId?: string | null;
  } | null;
  onCloseRunDetail: () => void;
  runDetailTriggerRef: React.RefObject<HTMLElement | null>;
  connData: ReturnType<typeof useConnectionsData>;
}

export const ConnectionsModals: React.FC<ConnectionsModalsProps> = ({
  selectedRunDetail,
  onCloseRunDetail,
  runDetailTriggerRef,
  connData,
}) => {
  return (
    <>
      {selectedRunDetail && (
        <RunDetailDrawer
          run={selectedRunDetail.run}
          runId={selectedRunDetail.runId}
          onClose={onCloseRunDetail}
          triggerButtonRef={runDetailTriggerRef}
        />
      )}

      {connData.isWizardOpen && (
        <FileUploadWizard
          initialFile={connData.initialUploadFile}
          onClose={connData.closeWizard}
          onSuccess={() => {
            connData.closeWizard();
            connData.loadConnectors(false);
          }}
        />
      )}

      {connData.isDbModalOpen && (
        <DatabaseConnectorForm
          initialDbType={connData.initialDbType}
          onClose={() => connData.setIsDbModalOpen(false)}
          onSuccess={() => {
            connData.setIsDbModalOpen(false);
            connData.loadConnectors(false);
          }}
        />
      )}

      <EditConnectionModal
        source={connData.editTarget}
        isSaving={connData.isSavingEdit}
        onClose={() => connData.setEditTarget(null)}
        onSave={connData.handleSaveEdit}
      />

      {connData.cleanPreviewFile && (
        <CleanDataModal
          cleanPreviewFile={connData.cleanPreviewFile}
          cleanData={connData.cleanData}
          isCleanDataLoading={connData.isCleanDataLoading}
          cleanSearchFilter={connData.cleanSearchFilter}
          setCleanSearchFilter={connData.setCleanSearchFilter}
          onClose={() => connData.setCleanPreviewFile(null)}
        />
      )}

      {connData.previewingFile && (
        <RawPreviewModal
          previewingFile={connData.previewingFile}
          isRawPreviewLoading={connData.isRawPreviewLoading}
          onClose={() => connData.setPreviewingFile(null)}
        />
      )}

      <ConfirmDialog
        open={!!connData.deleteTarget}
        onOpenChange={(open) => {
          if (!open) connData.setDeleteTarget(null);
        }}
        title={
          connData.deleteTarget?.type === "connection"
            ? `Delete "${connData.deleteTarget.name}"?`
            : `Delete "${connData.deleteTarget?.name ?? "file"}"?`
        }
        description={`Are you sure you want to permanently delete "${connData.deleteTarget?.name}"? Associated sync pipelines will be terminated.`}
        confirmText={connData.isDeleting ? "Deleting..." : "Delete"}
        isDestructive={true}
        isLoading={connData.isDeleting}
        onConfirm={connData.executeDelete}
      />
    </>
  );
};
