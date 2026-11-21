import React from "react";
import { Link } from "@tanstack/react-router";
import { RefreshCw, ArrowRight } from "../../lib/icons";
import type { EngineStatusKind } from "./engineStatusUtils";

export interface EngineStatusVisualConfig {
  label: string;
  dotClass: string;
  textClass: string;
  badgeBgClass: string;
}

interface EngineStatusPopoverProps {
  statusKind: EngineStatusKind;
  config: EngineStatusVisualConfig;
  versionText: string;
  latencyText: string;
  lastCheckedLabel: string;
  staleMinutes: number;
  isStale: boolean;
  isFetching: boolean;
  onRefresh?: () => void;
  onClose: () => void;
}

export const EngineStatusPopover: React.FC<EngineStatusPopoverProps> = ({
  statusKind,
  config,
  versionText,
  latencyText,
  lastCheckedLabel,
  staleMinutes,
  isStale,
  isFetching,
  onRefresh,
  onClose,
}) => {
  return (
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
        <dd className="text-right font-medium text-text">{lastCheckedLabel}</dd>
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
          onClick={onClose}
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
  );
};
