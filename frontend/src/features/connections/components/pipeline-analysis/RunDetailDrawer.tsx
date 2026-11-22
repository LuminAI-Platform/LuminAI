import React, { useEffect, useRef } from "react";
import { BodyPortal } from "../../../../components/ui/BodyPortal";
import { X, RefreshCw, ICON_SIZES } from "../../../../lib/icons";
import { Tooltip } from "../../../../components/ui/Tooltip";
import { Button } from "../../../../components/ui/Button";
import type { PipelineRunItem } from "./pipelineAnalysisTypes";
import { RunStagesTimeline } from "./RunStagesTimeline";
import { RunExecutionQualityAndLogs } from "./RunExecutionQualityAndLogs";
import { RunMetricsStrip } from "./RunMetricsStrip";
import { RunFailedDiagnosisBox } from "./RunFailedDiagnosisBox";
import { useRunDetailData } from "./useRunDetailData";

interface RunDetailDrawerProps {
  run: PipelineRunItem | null;
  runId?: string | null;
  onClose: () => void;
  triggerButtonRef?: React.RefObject<HTMLElement | null>;
}

export const RunDetailDrawer: React.FC<RunDetailDrawerProps> = ({
  run: propRun,
  runId,
  onClose,
  triggerButtonRef,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const {
    run,
    activeRunId,
    jobDetail,
    isFailed,
    hasIssues,
    statusDisplayLabel,
    failedStep,
    errorMessage,
    getSuggestedFix,
    isRetrying,
    retryMessage,
    handleRetry,
  } = useRunDetailData(propRun, runId);

  useEffect(() => {
    if (!activeRunId) return;

    const returnFocusElement = triggerButtonRef?.current;

    setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        returnFocusElement?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      returnFocusElement?.focus();
    };
  }, [activeRunId, onClose, triggerButtonRef]);

  if (!run) return null;

  return (
    <BodyPortal>
      <div
        className="fixed inset-0 z-[9990] flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 motion-reduce:animate-none motion-reduce:transition-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="run-drawer-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={drawerRef}
          className="w-full max-w-xl h-full bg-surface border-l border-border shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-250 motion-reduce:animate-none select-none"
        >
          {/* Drawer Header */}
          <div className="p-5 border-b border-border flex items-start justify-between gap-3 bg-surface-subtle/40">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                    isFailed
                      ? "bg-error-bg text-error border-error-border"
                      : hasIssues
                        ? "bg-warning-bg text-warning border-warning-border"
                        : run.status === "COMPLETED"
                          ? "bg-success-bg text-success border-success-border"
                          : "bg-warning-bg text-warning border-warning-border"
                  }`}
                >
                  {statusDisplayLabel}
                </span>
                <span className="text-[11px] font-mono text-text-secondary">
                  ID: {run.id.slice(0, 8)}...
                </span>
              </div>
              <h2
                id="run-drawer-title"
                className="text-base font-bold text-text mt-1"
              >
                {run.connectorName}
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Type: {run.connectorType} · Started{" "}
                {new Date(run.startedAt).toLocaleString()}
              </p>
            </div>

            <Tooltip label="Close drawer" side="left">
              <button
                ref={closeBtnRef}
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text hover:bg-surface-subtle border border-transparent hover:border-border transition-colors cursor-pointer"
                aria-label="Close drawer"
              >
                <X size={ICON_SIZES.header} aria-hidden="true" />
              </button>
            </Tooltip>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <RunMetricsStrip run={run} />

            {isFailed && (
              <RunFailedDiagnosisBox
                failedStep={failedStep}
                errorMessage={errorMessage}
                suggestedFix={getSuggestedFix()}
                retryMessage={retryMessage}
              />
            )}

            <RunStagesTimeline isFailed={isFailed} failedStep={failedStep} />

            <RunExecutionQualityAndLogs
              run={run}
              jobDetail={jobDetail}
              isFailed={isFailed}
              errorMessage={errorMessage}
            />
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-border flex items-center justify-between bg-surface-subtle/40">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>

            {isFailed && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleRetry}
                isLoading={isRetrying}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Retry Failed Step
              </Button>
            )}
          </div>
        </div>
      </div>
    </BodyPortal>
  );
};
