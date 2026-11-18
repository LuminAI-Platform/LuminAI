import React from "react";
import { ShieldCheck } from "../../../../lib/icons";
import type { EngineDataQualityDto } from "./pipelineAnalysisTypes";

interface DataQualityPanelProps {
  dataQuality?: EngineDataQualityDto;
  recordsEvaluated?: number;
}

export const DataQualityPanel: React.FC<DataQualityPanelProps> = ({
  dataQuality,
  recordsEvaluated = 0,
}) => {
  const hasEvaluated = recordsEvaluated > 0 && dataQuality !== undefined;

  const dimensions = [
    {
      id: "completeness",
      label: "Completeness",
      description: "Non-null essential attributes",
      score: dataQuality?.completeness,
    },
    {
      id: "uniqueness",
      label: "Uniqueness",
      description: "Deduplicated canonical records",
      score: dataQuality?.uniqueness,
    },
    {
      id: "consistency",
      label: "Consistency",
      description: "Conforming to ontology schemas",
      score: dataQuality?.consistency,
    },
    {
      id: "timeliness",
      label: "Timeliness",
      description: "Recency within SLA thresholds",
      score: dataQuality?.timeliness,
    },
  ];

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-xs transition-colors select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-primary">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text">
              Engine Data Quality Dimensions
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Automated quality checks evaluated by Polars & DuckDB analytics
              engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">
            {hasEvaluated
              ? `${recordsEvaluated.toLocaleString()} records evaluated`
              : "No records evaluated"}
          </span>
          {hasEvaluated && dataQuality?.overallScore !== undefined && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-success-bg border border-success-border text-success">
              {dataQuality.overallScore.toFixed(1)}% Overall
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {dimensions.map((dim) => {
          const score = dim.score;
          const displayScore =
            hasEvaluated && score !== undefined && score > 0
              ? `${score.toFixed(1)}%`
              : "–";
          const subText =
            hasEvaluated && score !== undefined && score > 0
              ? dim.description
              : "No records evaluated";

          return (
            <div
              key={dim.id}
              className="bg-surface-subtle border border-border rounded-lg p-3.5 flex flex-col justify-between transition-colors"
            >
              <div className="flex items-center justify-between text-xs text-text-secondary mb-1.5">
                <span className="font-semibold text-text">{dim.label}</span>
                <span className="text-[10px] text-text-secondary font-mono">
                  {hasEvaluated ? "Point-in-time" : "–"}
                </span>
              </div>

              <div className="text-xl font-bold tracking-tight text-text mt-1">
                {displayScore}
              </div>

              <div className="text-[11px] text-text-secondary mt-1 leading-snug">
                {subText}
              </div>

              {/* Progress bar */}
              <div className="w-full bg-surface border border-border h-1.5 rounded-full overflow-hidden mt-2.5">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-500"
                  style={{
                    width:
                      hasEvaluated && score !== undefined
                        ? `${Math.min(score, 100)}%`
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
