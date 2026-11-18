import React from "react";
import { RefreshCw } from "../../../../lib/icons";

export const ConnectionDot: React.FC<{
  connected: boolean;
  polling?: boolean;
  onReconnect?: () => void;
  fallbackNote?: string;
}> = ({
  connected,
  polling = false,
  onReconnect,
  fallbackNote = "polling every 30s",
}) => (
  <div className="flex items-center gap-2 flex-wrap">
    <div className="flex items-center gap-1.5">
      <span
        className={`w-2 h-2 rounded-full ${
          connected
            ? "bg-success"
            : polling
              ? "bg-warning animate-pulse"
              : "bg-warning"
        }`}
      />
      <span className="text-[11px] text-text-secondary select-none font-medium">
        {connected ? "SSE Live" : "Live feed disconnected"}
      </span>
    </div>

    {!connected && (
      <div className="flex items-center gap-1.5 text-[10px] text-text-secondary">
        <span className="opacity-80">
          ({polling ? "fallback polling active" : fallbackNote})
        </span>
        {onReconnect && (
          <button
            type="button"
            onClick={onReconnect}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-subtle hover:bg-surface border border-border text-text font-medium transition-colors cursor-pointer"
            title="Reconnect live stream"
          >
            <RefreshCw className="w-2.5 h-2.5" />
            <span>Reconnect</span>
          </button>
        )}
      </div>
    )}
  </div>
);

export const KpiCard: React.FC<{
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  icon: React.ReactNode;
}> = ({ label, value, sub, accent = "text-text", icon }) => (
  <div className="flex items-center gap-3 bg-surface border border-border rounded-lg p-4 shadow-xs transition-colors">
    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-text-secondary">
      {icon}
    </div>
    <div>
      <div className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider">
        {label}
      </div>
      <div className={`text-sm font-bold leading-tight mt-0.5 ${accent}`}>
        {value}
      </div>
      {sub && (
        <div className="text-[10px] text-text-secondary mt-0.5">{sub}</div>
      )}
    </div>
  </div>
);

export const FilterPill: React.FC<{
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  id: string;
}> = ({ label, count, active, onClick, id }) => (
  <button
    id={id}
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
      active
        ? "bg-surface text-text border border-border shadow-xs"
        : "text-text-secondary hover:text-text hover:bg-surface-subtle"
    }`}
  >
    <span>{label}</span>
    <span
      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
        active
          ? "bg-surface-subtle text-text"
          : "bg-surface-subtle text-text-secondary"
      }`}
    >
      {count}
    </span>
  </button>
);
