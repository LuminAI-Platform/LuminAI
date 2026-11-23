import React from "react";
import { AlertOctagon, Wrench } from "../../../../lib/icons";

interface RunFailedDiagnosisBoxProps {
  failedStep: string | null;
  errorMessage: string | null;
  suggestedFix: string;
  retryMessage: string | null;
}

export const RunFailedDiagnosisBox: React.FC<RunFailedDiagnosisBoxProps> = ({
  failedStep,
  errorMessage,
  suggestedFix,
  retryMessage,
}) => {
  return (
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
            {suggestedFix}
          </span>
        </div>
      </div>

      {retryMessage && (
        <div className="text-xs font-semibold text-primary pt-1">
          {retryMessage}
        </div>
      )}
    </div>
  );
};
