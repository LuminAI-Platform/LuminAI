import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Cpu, ShieldCheck, RefreshCw, AlertTriangle } from "../../../lib/icons";
import { apiFetch } from "../../../lib/api";
import { queryClient } from "../../../lib/queryClient";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import {
  useDataQuality,
  formatQualityMetric,
} from "../../../hooks/useDataQuality";
import {
  deriveEngineStatus,
  formatLastChecked,
} from "../../../components/layout/engineStatusUtils";
import type { EngineMetricsResponse } from "../../../pages/dashboard/useDashboardData";

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

  const dimensions = [
    {
      id: "completeness",
      label: "Completeness",
      description: "Non-null essential attributes",
      value: quality.dimensions.completeness,
    },
    {
      id: "uniqueness",
      label: "Uniqueness",
      description: "Deduplicated canonical records",
      value: quality.dimensions.uniqueness,
    },
    {
      id: "consistency",
      label: "Consistency",
      description: "Conforming to ontology schemas",
      value: quality.dimensions.consistency,
    },
    {
      id: "timeliness",
      label: "Timeliness",
      description: "Recency within SLA thresholds",
      value: quality.dimensions.timeliness,
    },
  ];

  // Show a specific, actionable status notice only when relevant
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
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck
              className="w-4 h-4 text-text-secondary"
              aria-hidden="true"
            />
            <span className="text-xs font-semibold text-text">
              Data Quality Breakdown
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-text-secondary">Overall:</span>
            <span
              className={`font-semibold tabular-nums ${
                quality.score === null ? "text-text-muted" : "text-text"
              }`}
            >
              {formatQualityMetric(quality.score)}
            </span>
            {quality.score === null && (
              <Badge variant="neutral">Unverified</Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {dimensions.map((dim) => {
            const isAvailable = dim.value !== null;
            return (
              <div
                key={dim.id}
                className="bg-surface-subtle border border-border rounded-lg p-3.5 flex flex-col justify-between transition-colors"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-text">{dim.label}</span>
                  {!isAvailable && (
                    <span className="text-[10px] text-text-muted">No data</span>
                  )}
                </div>

                <div
                  className={`text-xl font-bold tabular-nums tracking-tight mt-0.5 ${
                    isAvailable ? "text-text" : "text-text-muted"
                  }`}
                >
                  {formatQualityMetric(dim.value)}
                </div>

                <div className="text-[11px] text-text-secondary mt-1 leading-snug">
                  {dim.description}
                </div>

                <div className="w-full bg-surface border border-border h-1.5 rounded-full overflow-hidden mt-2.5">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-500"
                    style={{
                      width: isAvailable
                        ? `${Math.max(0, Math.min(dim.value!, 100))}%`
                        : "0%",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
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
