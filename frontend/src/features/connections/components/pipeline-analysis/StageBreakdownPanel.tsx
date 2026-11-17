import React from "react";
import { Layers, Clock, AlertTriangle } from "lucide-react";
import type { StageMetric } from "./pipelineAnalysisTypes";

interface StageBreakdownPanelProps {
  stages: StageMetric[];
}

export const StageBreakdownPanel: React.FC<StageBreakdownPanelProps> = ({
  stages = [],
}) => {
  const hasData = stages.length > 0;

  const formatNum = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-xs transition-colors select-none">
      <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-primary">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text">
              Pipeline Stage Breakdown & Funnel
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Throughput retention, drop volume, and compute duration per stage
            </p>
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="py-10 text-center text-xs text-text-secondary border border-dashed border-border rounded-lg bg-surface-subtle/30">
          No records processed across cleaning stages yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border text-text-secondary font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Stage</th>
                <th className="py-2.5 px-3">Records In</th>
                <th className="py-2.5 px-3">Records Out</th>
                <th className="py-2.5 px-3">Dropped</th>
                <th className="py-2.5 px-3">Retention / Yield</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3 text-right">Highlights</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stages.map((st) => {
                const yieldPct =
                  st.recordsIn > 0
                    ? ((st.recordsOut / st.recordsIn) * 100).toFixed(1)
                    : "100.0";

                return (
                  <tr
                    key={st.stage}
                    className="hover:bg-surface-subtle/50 transition-colors"
                  >
                    <td className="py-3 px-3 font-semibold text-text flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      <span>{st.label}</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-text">
                      {formatNum(st.recordsIn)}
                    </td>
                    <td className="py-3 px-3 font-mono text-text">
                      {formatNum(st.recordsOut)}
                    </td>
                    <td className="py-3 px-3 font-mono">
                      <span
                        className={
                          st.dropped > 0
                            ? "text-error font-medium"
                            : "text-text-secondary"
                        }
                      >
                        {formatNum(st.dropped)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-surface-subtle border border-border h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-success h-full rounded-full"
                            style={{
                              width: `${Math.min(Number(yieldPct), 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-mono text-text-secondary">
                          {yieldPct}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-text">
                      {st.durationSeconds}s
                    </td>
                    <td className="py-3 px-3 text-right space-x-1">
                      {st.isSlowest && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-warning-bg border border-warning-border text-warning">
                          <Clock className="w-2.5 h-2.5" />
                          <span>Slowest Stage</span>
                        </span>
                      )}
                      {st.isHighestDrop && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-error-bg border border-error-border text-error">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>Highest Drop</span>
                        </span>
                      )}
                      {!st.isSlowest && !st.isHighestDrop && (
                        <span className="text-[10px] text-text-secondary">
                          Normal
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
