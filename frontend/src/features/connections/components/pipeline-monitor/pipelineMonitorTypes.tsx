import React from "react";

export const ConnectionDot: React.FC<{
  connected: boolean;
  polling: boolean;
}> = ({ connected, polling }) => (
  <div className="flex items-center gap-1.5">
    <span
      className={`w-1.5 h-1.5 rounded-full ${
        connected ? "bg-success" : polling ? "bg-warning" : "bg-nodata"
      }`}
    />
    <span className="text-[10px] text-text-secondary select-none font-medium">
      {connected ? "SSE Live" : polling ? "Polling 3s" : "Disconnected"}
    </span>
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
