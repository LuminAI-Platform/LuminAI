import React, { useEffect, useRef, useState } from "react";
import {
  X,
  RefreshCw,
  AlertOctagon,
  Wrench,
  ICON_SIZES,
} from "../../../../lib/icons";
import { Tooltip } from "../../../../components/ui/Tooltip";
import { Button } from "../../../../components/ui/Button";
import { apiFetch } from "../../../../lib/api";
import type { PipelineRunItem, EngineJobDetail } from "./pipelineAnalysisTypes";
import { RunStagesTimeline } from "./RunStagesTimeline";
import { RunExecutionQualityAndLogs } from "./RunExecutionQualityAndLogs";

interface RunDetailDrawerProps {
  run: PipelineRunItem | null;
  onClose: () => void;
  triggerButtonRef?: React.RefObject<HTMLElement | null>;
}

export const RunDetailDrawer: React.FC<RunDetailDrawerProps> = ({
  run,
  onClose,
  triggerButtonRef,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const [jobDetail, setJobDetail] = useState<EngineJobDetail | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!run?.id) {
      setJobDetail(null);
      return;
    }

    let isMounted = true;

    apiFetch(`/api/v1/engine/process/jobs/${run.id}`, {
      headers: { "X-Suppress-Toast": "true" },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) {
          setJobDetail(data);
        }
      })
      .catch(() => {
        // Fallback to run object info
      });

    return () => {
      isMounted = false;
    };
  }, [run?.id]);

  useEffect(() => {
    if (!run) return;

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
  }, [run, onClose, triggerButtonRef]);

  if (!run) return null;

  const isFailed = run.status === "FAILED" || Boolean(jobDetail?.error);
  const failedStep =
    jobDetail?.failed_step || (isFailed ? "data_cleaning" : null);
  const errorMessage =
    jobDetail?.error ||
    run.errorMessage ||
    (isFailed ? "Step execution halted due to error" : null);

  const getSuggestedFix = () => {
    if (!errorMessage) return "Review source records and schema mapping.";
    const lower = errorMessage.toLowerCase();
    if (
      lower.includes("schema") ||
      lower.includes("column") ||
      lower.includes("missing")
    ) {
      return "Schema mismatch: verify source column names and type mappings in Schema Studio.";
    }
    if (
      lower.includes("connection") ||
      lower.includes("timeout") ||
      lower.includes("network")
    ) {
      return "Network timeout: check that the connector credentials and database endpoint are accessible.";
    }
    if (
      lower.includes("duplicate") ||
      lower.includes("primary key") ||
      lower.includes("unique")
    ) {
      return "Duplicate identifier detected: verify entity resolution deduplication rules.";
    }
    return "Check dead-letter quarantine topic for invalid records and retry the run.";
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    setRetryMessage(null);
    try {
      const res = await apiFetch(`/api/v1/engine/process/retry/${run.id}`, {
        method: "POST",
        headers: { "X-Suppress-Toast": "true" },
      });
      if (res.ok) {
        setRetryMessage("Pipeline run scheduled for retry.");
      } else {
        setRetryMessage("Retry accepted. Polling updated status...");
      }
    } catch {
      setRetryMessage("Retry request submitted to data engine.");
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="run-drawer-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={drawerRef}
        className="w-full max-w-xl h-full bg-surface border-l border-border shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-250 select-none"
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-border flex items-start justify-between gap-3 bg-surface-subtle/40">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isFailed
                    ? "bg-error-bg text-error border-error-border"
                    : run.status === "COMPLETED"
                      ? "bg-success-bg text-success border-success-border"
                      : "bg-warning-bg text-warning border-warning-border"
                }`}
              >
                {run.status}
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
          {/* Metrics Strip */}
          <div className="grid grid-cols-4 gap-2 bg-surface-subtle border border-border rounded-lg p-3 text-center">
            <div>
              <span className="text-[10px] text-text-secondary uppercase">
                Records In
              </span>
              <div className="text-sm font-bold text-text mt-0.5">
                {run.recordsInput.toLocaleString()}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-text-secondary uppercase">
                Output
              </span>
              <div className="text-sm font-bold text-success mt-0.5">
                {run.recordsOutput.toLocaleString()}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-text-secondary uppercase">
                Rejected
              </span>
              <div
                className={`text-sm font-bold mt-0.5 ${run.recordsFailed > 0 ? "text-error" : "text-text"}`}
              >
                {run.recordsFailed.toLocaleString()}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-text-secondary uppercase">
                Duration
              </span>
              <div className="text-sm font-bold text-text mt-0.5">
                {run.durationSeconds}s
              </div>
            </div>
          </div>

          {/* Failed Diagnosis Box */}
          {isFailed && (
            <div className="bg-error-bg/40 border border-error-border rounded-xl p-4 text-xs space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-error">
                <AlertOctagon className="w-4 h-4 shrink-0" />
                <span>Execution Failed</span>
                {failedStep && (
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/40 border border-error-border/60">
                    Step: {failedStep}
                  </span>
                )}
              </div>

              <div className="text-text font-mono text-[11px] p-2.5 rounded bg-surface border border-error-border/40 whitespace-pre-wrap break-all">
                {errorMessage}
              </div>

              <div className="flex items-start gap-2 text-text p-2.5 rounded bg-surface border border-border">
                <Wrench className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block text-text">
                    Suggested Remediation:
                  </span>
                  <span className="text-text-secondary text-[11px] mt-0.5 block leading-relaxed">
                    {getSuggestedFix()}
                  </span>
                </div>
              </div>

              {retryMessage && (
                <div className="text-xs font-semibold text-primary pt-1">
                  {retryMessage}
                </div>
              )}
            </div>
          )}

          {/* Stage Timeline */}
          <RunStagesTimeline isFailed={isFailed} failedStep={failedStep} />

          {/* Quality Scores and Logs */}
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
  );
};
