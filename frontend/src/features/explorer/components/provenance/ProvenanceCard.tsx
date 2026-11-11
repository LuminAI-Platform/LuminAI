import React from "react";
import { Database, Clock, Tag } from "lucide-react";
import type { ProvenanceLine } from "../EntityPropertyTable";

const CONFIDENCE_CONFIG = {
  high: {
    label: "High Confidence",
    badgeCls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
    dotCls: "bg-emerald-400",
  },
  medium: {
    label: "Medium Confidence",
    badgeCls: "bg-amber-500/10 text-amber-400 border-amber-500/25",
    dotCls: "bg-amber-400",
  },
  low: {
    label: "Low Confidence",
    badgeCls: "bg-red-500/10 text-red-400 border-red-500/25",
    dotCls: "bg-red-400",
  },
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ProvenanceCardProps {
  line: ProvenanceLine;
  index: number;
}

export const ProvenanceCard: React.FC<ProvenanceCardProps> = ({
  line,
  index,
}) => {
  const conf = CONFIDENCE_CONFIG[line.confidence];
  return (
    <div
      key={`${line.sourceDataset}-${index}`}
      className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-4 hover:border-zinc-700 transition-colors"
    >
      {/* Source name + confidence */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700/80 flex items-center justify-center shrink-0">
            <Database className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-zinc-200 truncate">
              {line.sourceDataset}
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Source dataset</p>
          </div>
        </div>
        <span
          className={`text-[9px] font-bold px-2 py-1 rounded-lg border shrink-0 flex items-center gap-1.5 ${conf.badgeCls}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${conf.dotCls}`} />
          {conf.label}
        </span>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 gap-2">
        <div className="flex items-center gap-2.5 bg-zinc-950/60 border border-zinc-900 rounded-lg px-3 py-2">
          <Tag className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-bold mb-0.5">
              Source Field
            </p>
            <p className="text-xs font-mono text-zinc-300 truncate">
              {line.sourceField}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 bg-zinc-950/60 border border-zinc-900 rounded-lg px-3 py-2">
          <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-bold mb-0.5">
              Ingested At
            </p>
            <p className="text-xs text-zinc-300 truncate">
              {formatDateTime(line.ingestedAt)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
