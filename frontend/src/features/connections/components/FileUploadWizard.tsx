import React from "react";
import type { FileUploadWizardProps } from "./file-upload/fileUploadTypes";
import { useFileUpload } from "./file-upload/useFileUpload";
import { StepDropzone } from "./file-upload/StepDropzone";
import { StepMapping } from "./file-upload/StepMapping";
import { StepPreview } from "./file-upload/StepPreview";
import { StepIngesting } from "./file-upload/StepIngesting";

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
      role="dialog"
      aria-modal="true"
      aria-labelledby="file-wizard-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/75 backdrop-blur-md transition-opacity"
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-[96vw] max-w-7xl h-[92vh] max-h-[920px] flex flex-col overflow-hidden shadow-2xl shadow-black/80">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/40 select-none">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-300">
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
                className="text-base font-bold text-zinc-100"
              >
                File Ingestion Wizard
              </h2>
              <p className="text-[11px] text-zinc-400">
                Ingest flat files (CSV, JSON) into semantic data graphs
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
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
        <div className="flex justify-between items-center px-8 py-3 border-b border-zinc-800/60 bg-zinc-950/20 select-none text-xs font-semibold">
          {[
            { s: 1, name: "Upload File" },
            { s: 2, name: "Define Types & Mapping" },
            { s: 3, name: "Preview Data" },
            { s: 4, name: "Ingestion Summary" },
          ].map((item) => (
            <div key={item.s} className="flex items-center gap-2">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center border text-xs font-medium transition-all ${
                  step === item.s
                    ? "bg-blue-600 border-blue-500 text-white"
                    : step > item.s
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-zinc-950 border-zinc-800 text-zinc-500"
                }`}
              >
                {item.s}
              </span>
              <span
                className={step === item.s ? "text-zinc-100" : "text-zinc-500"}
              >
                {item.name}
              </span>
              {item.s < 4 && (
                <span className="text-zinc-700 mx-4 font-normal">➔</span>
              )}
            </div>
          ))}
        </div>

        {/* Core content area */}
        <div className="flex-1 p-6 overflow-y-auto min-h-0 bg-zinc-900/10">
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
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/40 flex items-center justify-between select-none">
          <div>
            {step > 1 && (
              <button
                disabled={ingesting}
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)}
                className="px-4 py-2 border border-zinc-850 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100 rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Previous Step
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              disabled={ingesting}
              onClick={handleClose}
              className="px-4 py-2 border border-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {step < 4 && step > 1 && (
              <button
                onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-blue-500/10 transition-colors cursor-pointer"
              >
                Next Step
              </button>
            )}

            {step === 4 && ingestionFailed && (
              <button
                onClick={startIngestion}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-rose-500/10 transition-colors cursor-pointer"
              >
                Retry Ingestion
              </button>
            )}

            {step === 4 && ingestionFinished && (
              <button
                onClick={handleClose}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-emerald-500/10 transition-colors cursor-pointer"
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
