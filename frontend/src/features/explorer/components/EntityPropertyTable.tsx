import React from "react";
import { GitBranch } from "lucide-react";

export interface ProvenanceLine {
  propertyKey: string;
  sourceDataset: string;
  sourceField: string;
  ingestedAt: string;
  confidence: "high" | "medium" | "low";
}

interface EntityPropertyTableProps {
  properties: Record<string, unknown>;
  provenance: ProvenanceLine[];
  onProvenanceClick: (key: string) => void;
  activeKey: string | null;
}

const CONFIDENCE_STYLES: Record<
  ProvenanceLine["confidence"],
  { label: string; cls: string }
> = {
  high: {
    label: "High",
    cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  medium: {
    label: "Med",
    cls: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  low: {
    label: "Low",
    cls: "bg-red-500/10 text-red-400 border-red-500/20",
  },
};

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") return val.toLocaleString();
  return String(val);
}

export const EntityPropertyTable: React.FC<EntityPropertyTableProps> = ({
  properties,
  provenance,
  onProvenanceClick,
  activeKey,
}) => {
  const entries = Object.entries(properties);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 border border-dashed border-zinc-800/80 rounded-2xl text-center">
        <span className="text-xs text-zinc-500 italic">
          No properties recorded for this entity.
        </span>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800/80">
      {/* Table Header */}
      <div className="grid grid-cols-[2fr_3fr_auto] gap-0 bg-zinc-950/60 border-b border-zinc-800/80 px-5 py-2.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Property
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Value
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Source
        </span>
      </div>

      {/* Table Rows */}
      <div className="divide-y divide-zinc-900/80">
        {entries.map(([key, val], idx) => {
          const prov = provenance.find((p) => p.propertyKey === key);
          const isActive = activeKey === key;
          const confStyle = prov ? CONFIDENCE_STYLES[prov.confidence] : null;

          return (
            <div
              key={key}
              className={`grid grid-cols-[2fr_3fr_auto] gap-0 items-center px-5 py-3.5 transition-colors duration-150 group ${
                isActive
                  ? "bg-blue-500/5 border-l-2 border-blue-500"
                  : idx % 2 === 0
                    ? "bg-zinc-900/20 hover:bg-zinc-900/40"
                    : "bg-transparent hover:bg-zinc-900/30"
              }`}
            >
              {/* Key */}
              <div className="flex flex-col min-w-0 pr-4">
                <span className="text-[11px] font-mono font-semibold text-zinc-400 uppercase tracking-wider truncate">
                  {key}
                </span>
              </div>

              {/* Value */}
              <div className="flex items-center gap-2 min-w-0 pr-4">
                <span className="text-sm font-medium text-zinc-200 truncate">
                  {formatValue(val)}
                </span>
              </div>

              {/* Provenance Trigger */}
              <div className="flex items-center justify-end gap-2 shrink-0">
                {confStyle && (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded border tracking-wider ${confStyle.cls}`}
                  >
                    {confStyle.label}
                  </span>
                )}
                <button
                  id={`provenance-btn-${key}`}
                  onClick={() => onProvenanceClick(key)}
                  title={`View provenance for "${key}"`}
                  className={`p-1.5 rounded-lg border transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-blue-500/15 border-blue-500/40 text-blue-400 shadow-md shadow-blue-500/10"
                      : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/60 group-hover:border-zinc-700"
                  }`}
                >
                  <GitBranch className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
