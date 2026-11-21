import React, { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import type { EngineMetricsResponse } from "../../pages/dashboard/useDashboardData";
import {
  deriveEngineStatus,
  formatLastChecked,
  type EngineStatusKind,
} from "./engineStatusUtils";
import {
  EngineStatusPopover,
  type EngineStatusVisualConfig,
} from "./EngineStatusPopover";

export interface EngineStatusPillViewProps {
  engineMetrics?: EngineMetricsResponse | null;
  hasError?: boolean;
  isFetching?: boolean;
  dataUpdatedAt?: number;
  onRefresh?: () => void;
  defaultOpen?: boolean;
}

const STATUS_CONFIG: Record<EngineStatusKind, EngineStatusVisualConfig> = {
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
        <EngineStatusPopover
          statusKind={statusKind}
          config={config}
          versionText={versionText}
          latencyText={latencyText}
          lastCheckedLabel={lastCheckedLabel}
          staleMinutes={staleMinutes}
          isStale={isStale}
          isFetching={isFetching}
          onRefresh={onRefresh}
          onClose={() => setOpen(false)}
        />
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
