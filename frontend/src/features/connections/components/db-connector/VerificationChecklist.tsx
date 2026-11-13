import React from "react";
import type { ConnectionCheckStep } from "./dbConnectorTypes";

interface VerificationChecklistProps {
  checkSteps: ConnectionCheckStep[];
}

export const VerificationChecklist: React.FC<VerificationChecklistProps> = ({
  checkSteps,
}) => {
  return (
    <div className="flex flex-col h-full bg-zinc-950/60 border border-zinc-850/60 p-6 rounded-lg justify-center gap-6 select-none">
      <div className="flex flex-col gap-2 mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Connection Handshake Checklist
        </h3>
        <p className="text-xs text-zinc-500">
          Validating database host connectivity, port reachability, role
          permissions, and schema catalog discovery.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {checkSteps.map((step) => (
          <div
            key={step.id}
            className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
              step.status === "loading"
                ? "bg-primary-tint/50 border-primary-border"
                : step.status === "success"
                  ? "bg-success-bg border-success-border"
                  : step.status === "error"
                    ? "bg-error-bg border-error-border"
                    : "bg-surface-subtle border-border"
            }`}
          >
            <div className="mt-0.5">
              {step.status === "loading" && (
                <svg
                  className="animate-spin text-primary"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    className="opacity-25"
                  />
                  <path
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4"
                    className="opacity-75"
                  />
                </svg>
              )}
              {step.status === "success" && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {step.status === "error" && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2.5"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              )}
              {step.status === "idle" && (
                <div className="w-3.5 h-3.5 rounded-full border border-zinc-700 bg-zinc-850" />
              )}
            </div>

            <div className="flex-1">
              <span
                className={`text-xs font-semibold ${
                  step.status === "loading"
                    ? "text-primary"
                    : step.status === "success"
                      ? "text-success"
                      : step.status === "error"
                        ? "text-error"
                        : "text-text-secondary"
                }`}
              >
                {step.label}
              </span>
              {step.errorMsg && (
                <p className="text-[10px] text-error mt-1 leading-relaxed">
                  {step.errorMsg}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
