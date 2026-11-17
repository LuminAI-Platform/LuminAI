import React from "react";
import {
  Activity,
  CheckCircle2,
  AlertOctagon,
  Clock,
  Database,
  XCircle,
} from "lucide-react";
import type {
  EnginePipelineStatsDto,
  PipelineSummaryMetricsDto,
} from "./pipelineAnalysisTypes";

interface AnalysisSummaryCardsProps {
  pipelineStats?: EnginePipelineStatsDto;
  pipelineMetrics?: PipelineSummaryMetricsDto;
  failedRunsCount?: number;
}

export const AnalysisSummaryCards: React.FC<AnalysisSummaryCardsProps> = ({
  pipelineStats,
  pipelineMetrics,
  failedRunsCount = 0,
}) => {
  const totalRuns =
    pipelineStats?.totalRuns ?? pipelineMetrics?.totalRunsCount ?? 0;
  const hasRuns = totalRuns > 0;
  const successRate = pipelineStats?.successRate;
  const avgDuration = pipelineStats?.avgDuration;
  const recordsProcessed =
    pipelineStats?.recordsProcessed ??
    pipelineMetrics?.totalRecordsCleaned ??
    0;
  const recordsRejected = pipelineMetrics?.totalFailedRecords ?? 0;
  const change = pipelineStats?.changeVsPrevious;

  const formatNum = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  const cards = [
    {
      id: "summary-total-runs",
      label: "Total Runs",
      value: hasRuns ? formatNum(totalRuns) : "No runs yet",
      sub:
        change?.totalRuns !== undefined
          ? `${change.totalRuns >= 0 ? "+" : ""}${change.totalRuns}% vs prev period`
          : hasRuns
            ? "All recorded executions"
            : "No executions recorded",
      accent: hasRuns ? "text-text" : "text-text-secondary",
      icon: <Activity className="w-4 h-4 text-primary" />,
    },
    {
      id: "summary-success-rate",
      label: "Success Rate",
      value:
        hasRuns && successRate !== undefined
          ? `${successRate.toFixed(1)}%`
          : "No runs yet",
      sub:
        change?.successRate !== undefined
          ? `${change.successRate >= 0 ? "+" : ""}${change.successRate}% vs prev period`
          : hasRuns
            ? "Successful completions"
            : "No executions evaluated",
      accent:
        hasRuns && (successRate ?? 0) >= 80
          ? "text-success"
          : hasRuns
            ? "text-warning"
            : "text-text-secondary",
      icon: <CheckCircle2 className="w-4 h-4 text-success" />,
    },
    {
      id: "summary-failed-runs",
      label: "Failed Runs",
      value: hasRuns ? formatNum(failedRunsCount) : "No runs yet",
      sub:
        hasRuns && failedRunsCount > 0
          ? "Requires review"
          : hasRuns
            ? "Zero failed runs"
            : "No executions evaluated",
      accent:
        hasRuns && failedRunsCount > 0 ? "text-error" : "text-text-secondary",
      icon: <AlertOctagon className="w-4 h-4 text-error" />,
    },
    {
      id: "summary-avg-duration",
      label: "Avg Duration",
      value:
        hasRuns && avgDuration !== undefined && avgDuration > 0
          ? `${avgDuration.toFixed(1)}s`
          : "No runs yet",
      sub:
        change?.avgDuration !== undefined
          ? `${change.avgDuration >= 0 ? "+" : ""}${change.avgDuration}% vs prev period`
          : hasRuns
            ? "Mean execution latency"
            : "No latency data",
      accent: hasRuns ? "text-text" : "text-text-secondary",
      icon: <Clock className="w-4 h-4 text-text-secondary" />,
    },
    {
      id: "summary-records-processed",
      label: "Records Processed",
      value: hasRuns ? formatNum(recordsProcessed) : "No runs yet",
      sub:
        change?.recordsProcessed !== undefined
          ? `${change.recordsProcessed >= 0 ? "+" : ""}${change.recordsProcessed}% vs prev period`
          : hasRuns
            ? "Total ingested & staged"
            : "No records processed",
      accent: hasRuns ? "text-success" : "text-text-secondary",
      icon: <Database className="w-4 h-4 text-primary" />,
    },
    {
      id: "summary-records-rejected",
      label: "Records Rejected",
      value: hasRuns ? formatNum(recordsRejected) : "No runs yet",
      sub:
        hasRuns && recordsRejected > 0
          ? "Quarantined / invalid"
          : hasRuns
            ? "Zero rejected records"
            : "No records evaluated",
      accent:
        hasRuns && recordsRejected > 0 ? "text-error" : "text-text-secondary",
      icon: <XCircle className="w-4 h-4 text-error" />,
    },
  ];

  return (
    <div
      className="grid gap-3 select-none"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
    >
      {cards.map((c) => (
        <div
          key={c.id}
          className="bg-surface border border-border rounded-xl p-4 shadow-xs transition-colors flex items-center gap-3.5"
        >
          <div className="w-10 h-10 rounded-lg bg-surface-subtle border border-border flex items-center justify-center shrink-0">
            {c.icon}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block truncate">
              {c.label}
            </span>
            <div
              className={`text-base font-bold tracking-tight mt-0.5 truncate ${c.accent}`}
            >
              {c.value}
            </div>
            <div className="text-[11px] text-text-secondary truncate mt-0.5">
              {c.sub}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
