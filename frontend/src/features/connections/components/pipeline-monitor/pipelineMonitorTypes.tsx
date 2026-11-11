import React from "react";

export const ConnectionDot: React.FC<{
  connected: boolean;
  polling: boolean;
}> = ({ connected, polling }) => (
  <div className="flex items-center gap-1.5">
    <span
      className={`w-1.5 h-1.5 rounded-full ${
        connected ? "bg-emerald-500" : polling ? "bg-amber-500" : "bg-zinc-600"
      }`}
    />
    <span className="text-[10px] text-zinc-500 select-none">
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
}> = ({ label, value, sub, accent = "text-zinc-100", icon }) => (
  <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-400">
      {icon}
    </div>
    <div>
      <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
        {label}
      </div>
      <div className={`text-sm font-bold leading-tight mt-0.5 ${accent}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-zinc-600 mt-0.5">{sub}</div>}
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
    onClick={onClick}
    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
      active
        ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20"
        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
    }`}
  >
    {label}
    <span
      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
        active ? "bg-blue-500/30 text-blue-100" : "bg-zinc-800 text-zinc-500"
      }`}
    >
      {count}
    </span>
  </button>
);
