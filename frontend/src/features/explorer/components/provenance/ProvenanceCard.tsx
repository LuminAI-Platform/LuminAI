import React from "react";
import { Database, Clock, Tag } from "lucide-react";
import type { ProvenanceLine } from "../EntityPropertyTable";

const CONFIDENCE_CONFIG = {
  high: {
    label: "High Confidence",
    badgeCls: "bg-success-bg text-success border-success-border font-medium",
    dotCls: "bg-success",
  },
  medium: {
    label: "Medium Confidence",
    badgeCls: "bg-warning-bg text-warning border-warning-border font-medium",
    dotCls: "bg-warning",
  },
  low: {
    label: "Low Confidence",
    badgeCls: "bg-error-bg text-error border-error-border font-medium",
    dotCls: "bg-error",
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
      className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-4 hover:border-text-secondary/40 transition-colors shadow-xs"
    >
      {/* Source name + confidence */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border flex items-center justify-center shrink-0 text-text-secondary">
            <Database className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-text truncate block">
              {line.sourceDataset}
            </span>
            <span className="text-[10px] text-text-secondary truncate block">
              Record: {line.sourceRecordId}
            </span>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] border shrink-0 ${conf.badgeCls}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${conf.dotCls}`}
          />
          {conf.label}
        </span>
      </div>

      {/* Value contributed */}
      <div className="bg-surface-subtle border border-border rounded-lg p-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-[10px] text-text-secondary block mb-0.5">
            Contributed value
          </span>
          <span className="text-xs font-mono font-medium text-text break-all">
            {line.sourceField}
          </span>
        </div>
        <Tag className="w-3.5 h-3.5 text-text-secondary shrink-0 mt-0.5" />
      </div>

      {/* Ingestion timestamp + attribution */}
      <div className="flex items-center justify-between text-[10px] text-text-secondary pt-1 border-t border-border">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{formatDateTime(line.ingestedAt)}</span>
        </div>
        <span>Via pipeline sync</span>
      </div>
    </div>
  );
};
