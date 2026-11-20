import React from "react";
import { MultiSelect } from "../../../../components/ui/dropdown";
import { FilterPill } from "./pipelineMonitorTypes";
import type { FilterStatus } from "./pipelineMonitorUtils";

interface PipelineFilterToolbarProps {
  filter: FilterStatus;
  setFilter: (f: FilterStatus) => void;
  selectedStatuses: string[];
  setSelectedStatuses: (s: string[]) => void;
  counts: Record<FilterStatus, number>;
}

export const PipelineFilterToolbar: React.FC<PipelineFilterToolbarProps> = ({
  filter,
  setFilter,
  selectedStatuses,
  setSelectedStatuses,
  counts,
}) => {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <MultiSelect
        label="Status"
        values={selectedStatuses}
        onChange={(newVals) => {
          setSelectedStatuses(newVals);
          if (newVals.length > 0) {
            setFilter("ALL");
          }
        }}
        options={[
          { value: "RUNNING", label: "RUNNING", count: counts.RUNNING },
          { value: "CLEANED", label: "CLEANED", count: counts.CLEANED },
          { value: "COMPLETED", label: "COMPLETED", count: counts.COMPLETED },
          { value: "FAILED", label: "FAILED", count: counts.FAILED },
        ]}
        searchPlaceholder="Filter status…"
      />

      <div className="flex items-center gap-1.5 flex-wrap">
        {(
          [
            "ALL",
            "RUNNING",
            "CLEANED",
            "COMPLETED",
            "FAILED",
          ] as FilterStatus[]
        ).map((st) => (
          <FilterPill
            key={st}
            id={`filter-${st.toLowerCase()}`}
            label={st}
            count={counts[st]}
            active={selectedStatuses.length === 0 && filter === st}
            onClick={() => {
              setSelectedStatuses([]);
              setFilter(st);
            }}
          />
        ))}
      </div>
    </div>
  );
};
