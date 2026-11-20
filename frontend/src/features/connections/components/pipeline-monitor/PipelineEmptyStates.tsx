import React from "react";
import { Link } from "@tanstack/react-router";
import { Activity, AlertCircle, ArrowRight, RefreshCw } from "../../../../lib/icons";
import { Button } from "../../../../components/ui/Button";
import { Skeleton } from "../../../../components/ui/Skeleton";

export const PipelineMonitorLoading: React.FC = () => {
  return (
    <div
      className="flex flex-col gap-5 select-none"
      data-testid="pipeline-monitor-loading"
    >
      {/* KPIs Row Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-surface border border-border flex flex-col gap-2.5"
          >
            <div className="flex justify-between items-center">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-6 w-6 rounded-md" />
            </div>
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>

      {/* Filter bar Skeleton */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border">
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-6 w-16 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-6 w-28 rounded-lg" />
      </div>

      {/* Job Cards Skeleton */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-surface border border-border flex flex-col gap-3"
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="flex justify-between pt-1">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface PipelineMonitorErrorProps {
  is404: boolean;
  effectiveError: string | null;
  onRetry: () => void;
}

export const PipelineMonitorError: React.FC<PipelineMonitorErrorProps> = ({
  is404,
  effectiveError,
  onRetry,
}) => {
  return (
    <div
      className="flex flex-col items-center justify-center py-14 px-6 border border-error-border/60 bg-error-bg/30 rounded-xl text-center select-none"
      data-testid="pipeline-monitor-error"
    >
      <div className="w-12 h-12 rounded-xl bg-surface border border-error-border flex items-center justify-center text-error mb-3.5 shadow-2xs">
        <AlertCircle className="w-6 h-6" />
      </div>

      <h4 className="text-base font-bold text-text mb-1">
        Can&apos;t reach the data engine
      </h4>
      <p className="text-xs text-text-secondary max-w-sm mb-5 leading-relaxed">
        {is404
          ? "The pipeline service endpoint was not found (404)."
          : effectiveError}
      </p>

      <Button
        variant="secondary"
        size="sm"
        onClick={onRetry}
        leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
      >
        Retry Connection
      </Button>
    </div>
  );
};

export const PipelineMonitorEmpty: React.FC = () => {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-6 border border-dashed border-border rounded-xl text-center bg-surface-subtle/40 select-none transition-colors"
      data-testid="pipeline-monitor-empty"
    >
      <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center text-text-secondary mb-3.5 shadow-2xs">
        <Activity className="w-6 h-6 text-primary" />
      </div>

      <h3 className="text-base font-bold text-text mb-1">Pipeline Monitor</h3>
      <p className="text-xs text-text-secondary max-w-md mb-4 leading-relaxed">
        Monitor ingest topics, data cleaning stage throughput, and real-time
        execution telemetry.
      </p>

      <span className="text-sm font-semibold text-text mb-1.5">
        No pipeline runs yet
      </span>
      <p className="text-xs text-text-secondary max-w-sm mb-6 leading-relaxed">
        No pipelines yet. Connect a data source to begin running pipelines and
        observing live execution telemetry.
      </p>

      <Link
        to="/connections"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover border border-primary text-primary-text text-xs font-semibold shadow-xs transition-colors cursor-pointer"
      >
        <span>Create a connection</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
};
