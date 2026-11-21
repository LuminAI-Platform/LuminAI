import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Upload, X, ICON_SIZES } from "../../../lib/icons";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import type { FileUploadWizardProps } from "./file-upload/fileUploadTypes";
import { useFileUpload } from "./file-upload/useFileUpload";
import { StepDropzone } from "./file-upload/StepDropzone";
import { StepMapping } from "./file-upload/StepMapping";
import { StepPreview } from "./file-upload/StepPreview";
import { StepIngesting } from "./file-upload/StepIngesting";
import { WizardStepper } from "./file-upload/WizardStepper";
import { FileUploadWizardFooter } from "./file-upload/FileUploadWizardFooter";

export const FileUploadWizard: React.FC<FileUploadWizardProps> = ({
  onClose,
  onSuccess,
  initialFile,
}) => {
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const {
    step,
    setStep,
    dragActive,
    file,
    parsedData,
    columnsConfig,
    mappings,
    ingesting,
    ingestionProgress,
    ingestionLogs,
    ingestedCount,
    ingestionFinished,
    ingestionFailed,
    errorMessage,
    fileInputRef,
    ontologyEntityTypes,
    primaryTargetEntity,
    inferredEntityName,
    isCreatingCustomEntity,
    setIsCreatingCustomEntity,
    customEntityInput,
    setCustomEntityInput,
    ontologyProperties,
    handleDrag,
    handleDrop,
    handleChange,
    toggleColumn,
    updateColumnType,
    handlePrimaryEntityChange,
    handleApplyCustomEntity,
    updateMapping,
    startIngestion,
    handleClose,
  } = useFileUpload(onClose, onSuccess, initialFile);

  const hasUnsavedWork = Boolean(file && !ingestionFinished && !ingesting);

  const requestClose = () => {
    if (ingesting) return;
    if (hasUnsavedWork) {
      setShowDiscardConfirm(true);
    } else {
      handleClose();
    }
  };

  const guardDismiss = (e: Event) => {
    if (ingesting) {
      e.preventDefault();
      return;
    }
    if (hasUnsavedWork) {
      e.preventDefault();
      setShowDiscardConfirm(true);
    }
  };

  return (
    <>
      <Dialog.Root
        open={true}
        onOpenChange={(open) => {
          if (!open) requestClose();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[99990] bg-black/70 backdrop-blur-xs" />
          <Dialog.Content
            aria-modal="true"
            onEscapeKeyDown={guardDismiss}
            onPointerDownOutside={guardDismiss}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[99991] w-[min(960px,calc(100vw-48px))] max-h-[calc(100vh-48px)] bg-surface border border-border rounded-lg shadow-lg flex flex-col overflow-hidden focus:outline-none"
          >
            {/* Fixed Top Header */}
            <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-border bg-surface select-none">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-primary shrink-0">
                  <Upload className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <Dialog.Title className="text-sm font-semibold text-text truncate">
                    Upload file
                  </Dialog.Title>
                  <Dialog.Description className="text-xs text-text-secondary mt-0.5 truncate">
                    Upload CSV or JSON datasets, map columns, and ingest into
                    LuminAI.
                  </Dialog.Description>
                </div>
              </div>
              <button
                type="button"
                disabled={ingesting}
                onClick={requestClose}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                aria-label="Close dialog"
              >
                <X size={ICON_SIZES.dropdown} aria-hidden="true" />
              </button>
            </div>

            {/* Fixed Step Indicator */}
            <div className="shrink-0">
              <WizardStepper step={step} />
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 bg-surface">
              {step === 1 && (
                <StepDropzone
                  dragActive={dragActive}
                  fileInputRef={fileInputRef}
                  onDrag={handleDrag}
                  onDrop={handleDrop}
                  onChange={handleChange}
                />
              )}

              {step === 2 && (
                <StepMapping
                  file={file}
                  columnsConfig={columnsConfig}
                  mappings={mappings}
                  ontologyEntityTypes={ontologyEntityTypes}
                  primaryTargetEntity={primaryTargetEntity}
                  inferredEntityName={inferredEntityName}
                  isCreatingCustomEntity={isCreatingCustomEntity}
                  customEntityInput={customEntityInput}
                  ontologyProperties={ontologyProperties}
                  setIsCreatingCustomEntity={setIsCreatingCustomEntity}
                  setCustomEntityInput={setCustomEntityInput}
                  toggleColumn={toggleColumn}
                  updateColumnType={updateColumnType}
                  handlePrimaryEntityChange={handlePrimaryEntityChange}
                  handleApplyCustomEntity={handleApplyCustomEntity}
                  updateMapping={updateMapping}
                />
              )}

              {step === 3 && (
                <StepPreview
                  columnsConfig={columnsConfig}
                  rows={parsedData.rows}
                  toggleColumn={toggleColumn}
                />
              )}

              {step === 4 && (
                <StepIngesting
                  file={file}
                  parsedRowsCount={parsedData.rows.length}
                  columnsConfig={columnsConfig}
                  mappings={mappings}
                  ingesting={ingesting}
                  ingestionProgress={ingestionProgress}
                  ingestionLogs={ingestionLogs}
                  ingestedCount={ingestedCount}
                  ingestionFinished={ingestionFinished}
                  ingestionFailed={ingestionFailed}
                  errorMessage={errorMessage}
                  startIngestion={startIngestion}
                />
              )}
            </div>

            <FileUploadWizardFooter
              step={step}
              ingesting={ingesting}
              ingestionFailed={ingestionFailed}
              ingestionFinished={ingestionFinished}
              onPreviousStep={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)}
              onNextStep={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
              onCancel={requestClose}
              onRetry={startIngestion}
              onDone={handleClose}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmDialog
        open={showDiscardConfirm}
        onOpenChange={setShowDiscardConfirm}
        title="Discard file upload?"
        description={`"${file?.name ?? "Your selected file"}" has not been ingested yet. Closing will discard your column mappings.`}
        confirmText="Discard"
        cancelText="Keep editing"
        isDestructive={true}
        onConfirm={() => {
          setShowDiscardConfirm(false);
          handleClose();
        }}
      />
    </>
  );
};
