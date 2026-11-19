import React from "react";
import type { FileUploadWizardProps } from "./file-upload/fileUploadTypes";
import { useFileUpload } from "./file-upload/useFileUpload";
import { StepDropzone } from "./file-upload/StepDropzone";
import { StepMapping } from "./file-upload/StepMapping";
import { StepPreview } from "./file-upload/StepPreview";
import { StepIngesting } from "./file-upload/StepIngesting";
import { WizardStepper } from "./file-upload/WizardStepper";

export const FileUploadWizard: React.FC<FileUploadWizardProps> = ({
  onClose,
  onSuccess,
}) => {
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
  } = useFileUpload(onClose, onSuccess);

  return (
    <div
      role="region"
      aria-labelledby="file-wizard-title"
      className="w-full max-w-[960px] mx-auto px-4 sm:px-6 pt-3 pb-6"
    >
      <div className="bg-surface border border-border rounded-lg shadow-sm flex flex-col">
        {/* Top Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-3.5 border-b border-border bg-surface select-none rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-text-secondary">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div>
              <h2
                id="file-wizard-title"
                className="text-base font-bold text-text"
              >
                File Ingestion Wizard
              </h2>
              <p className="text-[11px] text-text-secondary">
                Ingest flat files (CSV, JSON) into semantic data graphs
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg border border-border hover:border-border-focus text-text-secondary hover:text-text hover:bg-surface-subtle transition-colors cursor-pointer"
            aria-label="Close wizard"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Step Indicator */}
        <WizardStepper step={step} />

        {/* Core content area */}
        <div className="flex-1 px-6 py-5 min-h-[280px] bg-surface">
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

        {/* Bottom Actions footer */}
        <div className="shrink-0 px-6 py-3.5 border-t border-border bg-surface flex items-center justify-between select-none rounded-b-lg">
          <div>
            {step > 1 && (
              <button
                disabled={ingesting}
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)}
                className="px-4 py-2 border border-border hover:border-border-focus text-text hover:bg-surface-subtle rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Previous Step
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              disabled={ingesting}
              onClick={handleClose}
              className="px-4 py-2 border border-border hover:border-border-focus text-text-secondary hover:text-text hover:bg-surface-subtle rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {step < 4 && step > 1 && (
              <button
                onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-text border border-primary rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Next Step
              </button>
            )}

            {step === 4 && ingestionFailed && (
              <button
                onClick={startIngestion}
                className="px-5 py-2 bg-primary hover:bg-primary-hover text-primary-text border border-primary rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                Retry Ingestion
              </button>
            )}

            {step === 4 && ingestionFinished && (
              <button
                onClick={handleClose}
                className="px-5 py-2 bg-primary hover:bg-primary-hover text-primary-text border border-primary rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                Finish Wizard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
