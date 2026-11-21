import React, { useState } from "react";
import {
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Cpu,
  Database,
} from "../../../../lib/icons";
import { Link } from "@tanstack/react-router";
import { Button } from "../../../../components/ui/Button";
import { Skeleton } from "../../../../components/ui/Skeleton";

interface EngineUnreachableViewProps {
  errorCode?: number;
  errorMessage: string;
  onRetry: () => void;
}

export const EngineUnreachableView: React.FC<EngineUnreachableViewProps> = ({
  errorCode,
  errorMessage,
  onRetry,
}) => {
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  return (
    <div
      className="flex flex-col items-center justify-center py-14 px-6 border border-error-border/60 bg-error-bg/30 rounded-xl text-center select-none"
      data-testid="engine-unreachable-error"
    >
      <div className="w-12 h-12 rounded-xl bg-surface border border-error-border flex items-center justify-center text-error mb-3.5 shadow-2xs">
        <Cpu className="w-6 h-6" />
      </div>

      <h4 className="text-base font-bold text-text mb-1">
        Can&apos;t reach the data engine
      </h4>
      <p className="text-xs text-text-secondary max-w-sm mb-4 leading-relaxed">
        The Python Data Engine is currently offline or unreachable. Telemetry
        computation and historical analysis are unavailable.
      </p>

      {errorCode && (
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-text-secondary mb-3">
          HTTP Status: {errorCode}
        </span>
      )}

      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Retry Connection
        </Button>

        <button
          type="button"
          onClick={() => setShowErrorDetails((v) => !v)}
          className="flex items-center gap-1 text-xs text-text-secondary hover:text-text cursor-pointer underline px-2 py-1"
        >
          <span>
            {showErrorDetails ? "Hide details" : "View technical details"}
          </span>
          {showErrorDetails ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {showErrorDetails && (
        <div className="w-full max-w-md p-3 rounded-lg bg-surface border border-border text-left font-mono text-[11px] text-text-secondary overflow-x-auto">
          <div>Target: Data Engine API (/api/v1/engine/metrics)</div>
          <div>Error: {errorMessage}</div>
          <div>Status: STANDBY / TIMEOUT</div>
        </div>
      )}
    </div>
  );
};

export const AnalysisLoadingSkeleton: React.FC = () => (
  <div className="flex flex-col gap-6">
    <Skeleton className="w-full h-14 rounded-xl" />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
    <Skeleton className="w-full h-72 rounded-xl" />
    <Skeleton className="w-full h-48 rounded-xl" />
    <Skeleton className="w-full h-96 rounded-xl" />
  </div>
);

export const AnalysisEmptyState: React.FC = () => (
  <div
    className="flex flex-col items-center justify-center py-16 px-6 border border-dashed border-border rounded-xl text-center bg-surface-subtle/40 select-none transition-colors"
    data-testid="analysis-empty-state"
  >
    <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center text-text-secondary mb-3.5 shadow-2xs">
      <Database className="w-6 h-6 text-primary" />
    </div>

    <h3 className="text-base font-bold text-text mb-1">No pipeline runs yet</h3>
    <p className="text-xs text-text-secondary max-w-md mb-6 leading-relaxed">
      Historical analysis, throughput trends, and quality metrics will appear
      once you run pipelines.
    </p>

    <Link
      to="/connections"
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover border border-primary text-primary-text text-xs font-semibold shadow-xs transition-colors cursor-pointer"
    >
      <span>Create a connection</span>
    </Link>
  </div>
);
