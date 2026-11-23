import React, { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { RefreshCw, ArrowRight } from "../../lib/icons";
import { apiFetch } from "../../lib/api";
import type { EngineMetricsResponse } from "../../pages/dashboard/useDashboardData";
import {
  deriveEngineStatus,
  formatLastChecked,
  type EngineStatusKind,
} from "./engineStatusUtils";

export interface EngineStatusPillViewProps {
  engineMetrics?: EngineMetricsResponse | null;
  hasError?: boolean;
  isFetching?: boolean;
  dataUpdatedAt?: number;
  onRefresh?: () => void;
  defaultOpen?: boolean;
}

const STATUS_CONFIG: Record<
  EngineStatusKind,
  {
    label: string;
    dotClass: string;
    textClass: string;
    badgeBgClass: string;
  }
> = {
  online: {
    label: "Online",
    dotClass: "bg-success",
    textClass: "text-text",
    badgeBgClass: "bg-success-bg text-success border-success-border",
  },
  degraded: {
    label: "Degraded",
    dotClass: "bg-warning",
    textClass: "text-warning",
    badgeBgClass: "bg-warning-bg text-warning border-warning-border",
  },
  offline: {
    label: "Offline",
    dotClass: "bg-error",
    textClass: "text-error",
    badgeBgClass: "bg-error-bg text-error border-error-border",
  },
};

export const EngineStatusPillView: React.FC<EngineStatusPillViewProps> = ({
  engineMetrics,
  hasError = false,
  isFetching = false,
  dataUpdatedAt = 0,
  onRefresh,
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
    }, 150);
  };

  const statusKind = deriveEngineStatus(engineMetrics, hasError);
  const config = STATUS_CONFIG[statusKind];
  const health = engineMetrics?.engineHealth;

  const versionText =
    health?.version && health.version !== "unknown"
      ? `v${health.version.replace(/^v/i, "")}`
      : "—";

  const latencyText =
    typeof health?.latencyMs === "number" &&
    Number.isFinite(health.latencyMs) &&
    statusKind !== "offline"
      ? `${health.latencyMs} ms`
      : "—";

  const { label: lastCheckedLabel, staleMinutes } =
    formatLastChecked(dataUpdatedAt);
  const isStale = staleMinutes >= 2;

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border bg-surface-subtle/70 hover:bg-surface-subtle transition-colors text-xs cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
        aria-label={`Engine status: ${config.label}. Click for engine details.`}
        aria-expanded={open}
        data-testid="engine-status-pill"
      >
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${config.dotClass}`}
          aria-hidden="true"
        />
        <span className="text-text-secondary">Engine:</span>
        <span className={`font-medium ${config.textClass}`}>
          {config.label}
        </span>
      </button>

      {open && (
        <div
          role="region"
          aria-label="Engine status details"
          className="absolute bottom-full left-0 mb-2 z-[200] w-64 rounded-lg bg-surface border border-border shadow-lg p-3 text-xs text-text outline-none"
          data-testid="engine-status-popover"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
            <span className="font-semibold text-text">Processing Engine</span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${config.badgeBgClass}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`}
                aria-hidden="true"
              />
              {config.label}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[11px]">
            <dt className="text-text-secondary">Version</dt>
            <dd className="text-right font-mono font-medium text-text">
              {versionText}
            </dd>

            <dt className="text-text-secondary">Response time</dt>
            <dd className="text-right font-mono font-medium text-text">
              {latencyText}
            </dd>

            <dt className="text-text-secondary">Last checked</dt>
            <dd className="text-right font-medium text-text">
              {lastCheckedLabel}
            </dd>
          </dl>

          {(statusKind !== "online" || isStale) && (
            <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between gap-2 text-[11px]">
              <span className="text-text-secondary leading-snug">
                {statusKind === "offline"
                  ? "Engine unreachable"
                  : isStale
                    ? `Engine data last updated ${staleMinutes} min ago`
                    : "Engine running in degraded mode"}
              </span>
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={isFetching}
                  className="inline-flex items-center gap-1 font-semibold text-primary hover:text-primary-hover shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                  <span>{statusKind === "offline" ? "Retry" : "Refresh"}</span>
                </button>
              )}
            </div>
          )}

          <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between">
            <Link
              to="/connections/pipelines"
              hash="system-health"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary-hover transition-colors"
            >
              <span>System Health</span>
              <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </Link>
            {onRefresh && statusKind === "online" && !isStale && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isFetching}
                className="inline-flex items-center gap-1 text-[11px] text-text-secondary hover:text-text transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                <span>Refresh</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const EngineStatusPill: React.FC = () => {
  const {
    data: engineMetrics,
    isError,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery<EngineMetricsResponse>({
    queryKey: ["engine", "metrics"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/engine/metrics", {
        headers: { "X-Suppress-Toast": "true" },
      });
      return res.json();
    },
    refetchInterval: () => {
      if (typeof document !== "undefined" && document.hidden) {
        return false;
      }
      return 60000;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return (
    <EngineStatusPillView
      engineMetrics={engineMetrics}
      hasError={isError}
      isFetching={isFetching}
      dataUpdatedAt={dataUpdatedAt}
      onRefresh={() => {
        void refetch();
      }}
    />
  );
};
