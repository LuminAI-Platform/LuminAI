import React from "react";
import { FileUploadWizard } from "../../../features/connections/components/FileUploadWizard";
import { DatabaseConnectorForm } from "../../../features/connections/components/DatabaseConnectorForm";
import { RunDetailDrawer } from "../../../features/connections/components/pipeline-analysis/RunDetailDrawer";
import type { PipelineRunItem } from "../../../features/connections/components/pipeline-analysis/pipelineAnalysisTypes";
import type { DBType } from "../../../features/connections/components/db-connector/dbConnectorTypes";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { EditConnectionModal } from "./EditConnectionModal";
import { CleanDataModal } from "./CleanDataModal";
import { RawPreviewModal } from "./RawPreviewModal";
import type {
  CleanDataResponse,
  IngestedFile,
  UnifiedSource,
} from "./connectionsTypes";
import type { DeleteTarget } from "./useConnectionMutations";

interface ConnectionsModalsProps {
  selectedRunDetail: {
    run: PipelineRunItem | null;
    runId?: string | null;
  } | null;
  onCloseRunDetail: () => void;
  runDetailTriggerRef: React.RefObject<HTMLElement | null>;
  isWizardOpen: boolean;
  initialUploadFile: File | null;
  closeWizard: () => void;
  isDbModalOpen: boolean;
  setIsDbModalOpen: (open: boolean) => void;
  initialDbType: DBType;
  editTarget: UnifiedSource | null;
  isSavingEdit: boolean;
  setEditTarget: (target: UnifiedSource | null) => void;
  handleSaveEdit: (newName: string) => void;
  cleanPreviewFile: IngestedFile | null;
  setCleanPreviewFile: (file: IngestedFile | null) => void;
  cleanData: CleanDataResponse | null;
  isCleanDataLoading: boolean;
  cleanSearchFilter: string;
  setCleanSearchFilter: (val: string) => void;
  previewingFile: IngestedFile | null;
  setPreviewingFile: (file: IngestedFile | null) => void;
  isRawPreviewLoading: boolean;
  deleteTarget: DeleteTarget | null;
  setDeleteTarget: (target: DeleteTarget | null) => void;
  isDeleting: boolean;
  executeDelete: () => void;
  onRefresh: () => void;
}

export const ConnectionsModals: React.FC<ConnectionsModalsProps> = ({
  selectedRunDetail,
  onCloseRunDetail,
  runDetailTriggerRef,
  isWizardOpen,
  initialUploadFile,
  closeWizard,
  isDbModalOpen,
  setIsDbModalOpen,
  initialDbType,
  editTarget,
  isSavingEdit,
  setEditTarget,
  handleSaveEdit,
  cleanPreviewFile,
  setCleanPreviewFile,
  cleanData,
  isCleanDataLoading,
  cleanSearchFilter,
  setCleanSearchFilter,
  previewingFile,
  setPreviewingFile,
  isRawPreviewLoading,
  deleteTarget,
  setDeleteTarget,
  isDeleting,
  executeDelete,
  onRefresh,
}) => (
  <>
    {selectedRunDetail && (
      <RunDetailDrawer
        run={selectedRunDetail.run}
        runId={selectedRunDetail.runId}
        onClose={onCloseRunDetail}
        triggerButtonRef={runDetailTriggerRef}
      />
    )}

    {isWizardOpen && (
      <FileUploadWizard
        initialFile={initialUploadFile}
        onClose={closeWizard}
        onSuccess={() => {
          closeWizard();
          onRefresh();
        }}
      />
    )}

    {isDbModalOpen && (
      <DatabaseConnectorForm
        initialDbType={initialDbType}
        onClose={() => setIsDbModalOpen(false)}
        onSuccess={() => {
          setIsDbModalOpen(false);
          onRefresh();
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
  </>
);
