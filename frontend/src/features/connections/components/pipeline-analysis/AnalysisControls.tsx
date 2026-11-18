import React, { useState, useEffect } from "react";
import { RefreshCw, Clock } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { Select } from "../../../../components/ui/dropdown";
import type { TimeRangeOption } from "./pipelineAnalysisTypes";

interface AnalysisControlsProps {
  timeRange: TimeRangeOption;
  onTimeRangeChange: (range: TimeRangeOption) => void;
  pipelineFilter: string;
  onPipelineFilterChange: (pipeline: string) => void;
  uniquePipelines: string[];
  metricsUpdatedAt?: number;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const AnalysisControls: React.FC<AnalysisControlsProps> = ({
  timeRange,
  onTimeRangeChange,
  pipelineFilter,
  onPipelineFilterChange,
  uniquePipelines,
  metricsUpdatedAt,
  onRefresh,
  isRefreshing,
}) => {
  const [updatedLabel, setUpdatedLabel] = useState<string>("Updated just now");

  useEffect(() => {
    if (!metricsUpdatedAt) {
      setUpdatedLabel("Updated just now");
      return;
    }

    const updateAgo = () => {
      const diffMs = Date.now() - metricsUpdatedAt;
      const minutes = Math.floor(diffMs / 60000);
      if (minutes <= 0) {
        setUpdatedLabel("Updated just now");
      } else {
        setUpdatedLabel(`Updated ${minutes}m ago`);
      }
    };

    updateAgo();
    const timer = setInterval(updateAgo, 30000);
    return () => clearInterval(timer);
  }, [metricsUpdatedAt]);

  const ranges: TimeRangeOption[] = ["24H", "7D", "30D"];

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 bg-surface border border-border rounded-xl shadow-xs transition-colors select-none">
      {/* Left: Time range selector pills */}
      <div className="flex items-center gap-1.5 bg-surface-subtle border border-border p-1 rounded-lg">
        <Clock className="w-3.5 h-3.5 text-text-secondary ml-1 mr-0.5 shrink-0" />
        {ranges.map((r) => {
          const active = timeRange === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => onTimeRangeChange(r)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                active
                  ? "bg-surface text-text border border-border shadow-2xs"
                  : "text-text-secondary hover:text-text hover:bg-surface/50 border border-transparent"
              }`}
            >
              {r}
            </button>
          );
        })}
      </div>

      {/* Middle & Right: Pipeline selector & Refresh button */}
      <div className="flex items-center gap-3">
        {/* Pipeline Filter dropdown */}
        <div className="w-48">
          <Select
            value={pipelineFilter}
            onChange={(val) => onPipelineFilterChange(val)}
            options={[
              { value: "ALL", label: "All Pipelines" },
              ...uniquePipelines.map((p) => ({ value: p, label: p })),
            ]}
            ariaLabel="Pipeline Filter"
            size="sm"
          />
        </div>

        {/* Refresh button with Updated Xm ago label */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-text-secondary font-mono hidden md:inline">
            {updatedLabel}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            isLoading={isRefreshing}
            leftIcon={
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              />
            }
          >
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
};
