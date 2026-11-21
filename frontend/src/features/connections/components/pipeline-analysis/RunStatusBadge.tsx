import React from "react";
import { CheckCircle2, XCircle } from "../../../../lib/icons";

export const RunStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  switch (status.toUpperCase()) {
    case "RUNNING":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warning-bg border border-warning-border text-warning">
          <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
          <span>RUNNING</span>
        </span>
      );
    case "COMPLETED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success-bg border border-success-border text-success">
          <CheckCircle2 className="w-3 h-3 text-success" />
          <span>COMPLETED</span>
        </span>
      );
    case "FAILED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-error-bg border border-error-border text-error">
          <XCircle className="w-3 h-3 text-error" />
          <span>FAILED</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-subtle border border-border text-text-secondary">
          <span>{status}</span>
        </span>
      );
  }
};
