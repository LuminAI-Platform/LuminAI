import React from "react";
import { formatNumber } from "./pipelineMonitorUtils";
import { ThroughputGauge } from "./ThroughputGauge";

interface PipelineThroughputBannerProps {
  totalThroughput: number;
  runningCount: number;
}

export const PipelineThroughputBanner: React.FC<
  PipelineThroughputBannerProps
> = ({ totalThroughput, runningCount }) => {
  return (
    <div className="bg-surface-subtle border border-border rounded-lg p-5 flex items-center justify-between">
      <div>
        <div className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider">
          Aggregate Engine Throughput
        </div>
        <div className="text-2xl font-bold text-text mt-1">
          {formatNumber(totalThroughput)}
          <span className="text-sm font-normal text-text-secondary ml-1.5">
            records / sec
          </span>
        </div>
        <div className="text-xs text-text-secondary mt-0.5">
          Summed across {runningCount} active pipeline
          {runningCount === 1 ? "" : "s"}
        </div>
      </div>
      <ThroughputGauge value={totalThroughput} max={100_000} />
    </div>
  );
};
