import React from "react";
import type { PipelineJob } from "../PipelineJobCard";
import { formatNumber } from "./pipelineMonitorUtils";
import { KpiCard } from "./pipelineMonitorTypes";
import {
  Clock,
  ArrowDown,
  Check,
  XCircle,
  ICON_SIZES,
} from "../../../../lib/icons";

interface PipelineKpisProps {
  jobs: PipelineJob[];
  counts: { RUNNING: number; ALL: number };
}

export const PipelineKpis: React.FC<PipelineKpisProps> = ({ jobs, counts }) => {
  const totalInput = jobs.reduce((acc, j) => acc + j.recordsInput, 0);
  const totalProcessed = jobs.reduce((acc, j) => acc + j.recordsOutput, 0);
  const totalFailed = jobs.reduce((acc, j) => acc + j.recordsFailed, 0);
  const hasEvaluated = totalInput > 0 || totalProcessed > 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        label="Active Jobs"
        value={counts.RUNNING}
        sub={counts.ALL > 0 ? `${counts.ALL} total tracked` : "No jobs tracked"}
        accent={counts.RUNNING > 0 ? "text-primary" : "text-text"}
        icon={<Clock size={ICON_SIZES.card} aria-hidden="true" />}
      />
      <KpiCard
        label="Records In"
        value={formatNumber(totalInput)}
        sub={
          hasEvaluated ? "Total queued across runs" : "No records queued yet"
        }
        icon={<ArrowDown size={ICON_SIZES.card} aria-hidden="true" />}
      />
      <KpiCard
        label="Cleaned & Output"
        value={formatNumber(totalProcessed)}
        sub={
          totalInput > 0
            ? `${((totalProcessed / totalInput) * 100).toFixed(1)}% yield`
            : "No records processed yet"
        }
        accent={totalProcessed > 0 ? "text-success" : "text-text-secondary"}
        icon={<Check size={ICON_SIZES.card} aria-hidden="true" />}
      />
      <KpiCard
        label="Failed / Quarantined"
        value={formatNumber(totalFailed)}
        sub={
          totalFailed > 0
            ? "Requires review"
            : hasEvaluated
              ? "All records clean"
              : "No records processed yet"
        }
        accent={totalFailed > 0 ? "text-error" : "text-text-secondary"}
        icon={<XCircle size={ICON_SIZES.card} aria-hidden="true" />}
      />
    </div>
  );
};
