import React from "react";
import { ShieldCheck } from "../../../lib/icons";
import { Badge } from "../../../components/ui/Badge";
import { formatQualityMetric } from "../../../hooks/useDataQuality";

interface QualityDimension {
  id: string;
  label: string;
  description: string;
  value: number | null;
}

interface DataQualityBreakdownProps {
  score: number | null;
  dimensions: QualityDimension[];
}

export const DataQualityBreakdown: React.FC<DataQualityBreakdownProps> = ({
  score,
  dimensions,
}) => {
  return (
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
              score === null ? "text-text-muted" : "text-text"
            }`}
          >
            {formatQualityMetric(score)}
          </span>
          {score === null && <Badge variant="neutral">Unverified</Badge>}
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
  );
};
