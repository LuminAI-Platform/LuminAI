import React from "react";
import type { PipelineJob } from "../PipelineJobCard";
import { formatNumber } from "./pipelineMonitorUtils";
import { KpiCard } from "./pipelineMonitorTypes";

interface PipelineKpisProps {
  jobs: PipelineJob[];
  counts: { RUNNING: number; ALL: number };
}

export const PipelineKpis: React.FC<PipelineKpisProps> = ({ jobs, counts }) => {
  const totalInput = jobs.reduce((acc, j) => acc + j.recordsInput, 0);
  const totalProcessed = jobs.reduce((acc, j) => acc + j.recordsOutput, 0);
  const totalFailed = jobs.reduce((acc, j) => acc + j.recordsFailed, 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        label="Active Jobs"
        value={counts.RUNNING}
        sub={`${counts.ALL} total tracked`}
        accent={counts.RUNNING > 0 ? "text-blue-400" : "text-zinc-100"}
        icon={
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        }
      />
      <KpiCard
        label="Records In"
        value={formatNumber(totalInput)}
        sub="Total queued across runs"
        icon={
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </svg>
        }
      />
      <KpiCard
        label="Cleaned & Output"
        value={formatNumber(totalProcessed)}
        sub={
          totalInput > 0
            ? `${((totalProcessed / totalInput) * 100).toFixed(1)}% yield`
            : "0% yield"
        }
        accent="text-success"
        icon={
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        }
      />
      <KpiCard
        label="Failed / Quarantined"
        value={formatNumber(totalFailed)}
        sub={totalFailed > 0 ? "Requires review" : "All records clean"}
        accent={totalFailed > 0 ? "text-red-400" : "text-zinc-400"}
        icon={
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        }
      />
    </div>
  );
};
