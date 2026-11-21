import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Cpu, RefreshCw, AlertTriangle } from "../../../lib/icons";
import { apiFetch } from "../../../lib/api";
import { queryClient } from "../../../lib/queryClient";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { useDataQuality } from "../../../hooks/useDataQuality";
import {
  deriveEngineStatus,
  formatLastChecked,
} from "../../../components/layout/engineStatusUtils";
import type { EngineMetricsResponse } from "../../../pages/dashboard/useDashboardData";
import { DataQualityBreakdown } from "./system-health/DataQualityBreakdown";

export interface SystemHealthSectionContentProps {
  engineMetrics?: EngineMetricsResponse | null;
  hasError?: boolean;
  isFetching?: boolean;
  dataUpdatedAt?: number;
  onRefresh?: () => void;
  nowMs?: number;
}

export const SystemHealthSectionContent: React.FC<
  SystemHealthSectionContentProps
> = ({
  engineMetrics,
  hasError = false,
  isFetching = false,
  dataUpdatedAt = 0,
  onRefresh,
  nowMs,
}) => {
  const statusKind = deriveEngineStatus(engineMetrics, hasError);
  const health = engineMetrics?.engineHealth;
  const quality = useDataQuality(engineMetrics);

  const { label: lastCheckedLabel, staleMinutes } = formatLastChecked(
    dataUpdatedAt,
    nowMs,
  );
  const isStale = staleMinutes >= 2;

  const statusBadge =
    statusKind === "online"
      ? { label: "Online", variant: "success" as const }
      : statusKind === "degraded"
        ? { label: "Degraded", variant: "warning" as const }
        : { label: "Offline", variant: "danger" as const };

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

  let statusNotice: string | null = null;
  if (statusKind === "offline") {
    statusNotice = "Engine unreachable — unable to load live quality metrics.";
  } else if (statusKind === "degraded") {
    statusNotice = "Processing engine is running in degraded mode.";
  } else if (isStale) {
    statusNotice = `Engine data last updated ${staleMinutes} min ago`;
  }

  return (
    <section
      id="system-health"
      aria-labelledby="system-health-heading"
      className="bg-surface border border-border rounded-lg p-5 shadow-xs transition-colors"
      data-testid="system-health-section"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-surface-subtle border border-border text-text-secondary flex items-center justify-center shrink-0">
            <Cpu className="w-4.5 h-4.5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                id="system-health-heading"
                className="text-sm font-semibold text-text tracking-tight"
              >
                System Health &amp; Data Quality
              </h2>
              <Badge variant={statusBadge.variant} withDot>
                {statusBadge.label}
              </Badge>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Processing engine status and data quality dimensions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap text-xs text-text-secondary">
          <span className="bg-surface-subtle px-2.5 py-1 rounded border border-border font-mono text-[11px]">
            {versionText}
          </span>
          <span className="bg-surface-subtle px-2.5 py-1 rounded border border-border text-[11px]">
            Response: <span className="font-mono text-text">{latencyText}</span>
          </span>
          <span className="text-[11px] text-text-muted">
            Checked: {lastCheckedLabel}
          </span>
          {onRefresh && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onRefresh}
              isLoading={isFetching}
              leftIcon={
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`}
                />
              }
            >
              {statusKind === "offline" ? "Retry" : "Refresh"}
            </Button>
          )}
        </div>
      </div>

      {/* Contextual Notice (only when offline, degraded, or stale) */}
      {statusNotice && (
        <div
          role="status"
          className={`mb-4 px-3.5 py-2.5 rounded-lg border flex items-center justify-between gap-3 text-xs ${
            statusKind === "offline"
              ? "bg-error-bg border-error-border text-error"
              : "bg-warning-bg border-warning-border text-warning"
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle
              className="w-3.5 h-3.5 shrink-0"
              aria-hidden="true"
            />
            <span className="font-medium">{statusNotice}</span>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isFetching}
              className="font-semibold underline underline-offset-2 hover:opacity-80 cursor-pointer shrink-0 disabled:opacity-50"
            >
              {statusKind === "offline" ? "Retry" : "Refresh"}
            </button>
          )}
        </div>
      )}

      {/* Data Quality Breakdown */}
      <DataQualityBreakdown
        score={quality.score}
        dimensions={quality.dimensions}
      />
    </section>
  );
};

export const SystemHealthSection: React.FC = () => {
  const isTestEnv =
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.MODE === "test";

  const {
    data: engineMetrics,
    isError,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery<EngineMetricsResponse>(
    {
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
      enabled: !isTestEnv,
    },
    queryClient,
  );

  return (
    <SystemHealthSectionContent
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
