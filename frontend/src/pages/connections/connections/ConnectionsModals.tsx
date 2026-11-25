import React from "react";
import { FileUploadWizard } from "../../../features/connections/components/FileUploadWizard";
import { DatabaseConnectorForm } from "../../../features/connections/components/DatabaseConnectorForm";
import { RunDetailDrawer } from "../../../features/connections/components/pipeline-analysis/RunDetailDrawer";
import type { PipelineRunItem } from "../../../features/connections/components/pipeline-analysis/pipelineAnalysisTypes";
import { DeleteConnectionDialog } from "./DeleteConnectionDialog";
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
        existingSources={connData.unifiedSources}
        isSaving={connData.isSavingEdit}
        isTesting={
          !!connData.editTarget &&
          connData.testingSourceId === connData.editTarget.id
        }
        errorMessage={connData.editError}
        onClose={() => connData.setEditTarget(null)}
        onSave={connData.handleSaveEdit}
        onTestConnection={connData.handleTestConnection}
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

      <DeleteConnectionDialog
        source={connData.deleteTarget}
        isDeleting={connData.isDeleting}
        errorMessage={connData.deleteError}
        onClose={() => connData.setDeleteTarget(null)}
        onConfirm={connData.executeDelete}
      />
    </>
  );
};
