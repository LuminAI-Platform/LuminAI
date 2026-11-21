import React from "react";
import { ArrowUpDown } from "../../../../lib/icons";
import type { PipelineRunItem } from "./pipelineAnalysisTypes";

interface RunsTableHeaderProps {
  sortBy: keyof PipelineRunItem;
  sortOrder: "asc" | "desc";
  onSortChange: (field: keyof PipelineRunItem) => void;
}

interface SortableColumnProps {
  field: keyof PipelineRunItem;
  label: string;
  showOrder?: boolean;
  sortBy: keyof PipelineRunItem;
  sortOrder: "asc" | "desc";
  onSortChange: (field: keyof PipelineRunItem) => void;
}

const SortableColumn: React.FC<SortableColumnProps> = ({
  field,
  label,
  showOrder = false,
  sortBy,
  sortOrder,
  onSortChange,
}) => {
  const isActive = sortBy === field;
  return (
    <th
      className="py-2.5 px-4 cursor-pointer hover:text-text"
      onClick={() => onSortChange(field)}
    >
      <div className="flex items-center gap-1.5">
        <span className={isActive ? "text-primary font-bold" : ""}>
          {label}
        </span>
        <ArrowUpDown
          className={`w-2.5 h-2.5 ${isActive ? "text-primary" : ""}`}
        />
        {showOrder && isActive && (
          <span className="text-[9px] font-mono lowercase">({sortOrder})</span>
        )}
      </div>
    </th>
  );
};

export const RunsTableHeader: React.FC<RunsTableHeaderProps> = ({
  sortBy,
  sortOrder,
  onSortChange,
}) => (
  <thead>
    <tr className="border-b border-border bg-surface-subtle/40 text-text-secondary font-semibold uppercase tracking-wider text-[10px]">
      <SortableColumn
        field="connectorName"
        label="Pipeline"
        showOrder
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={onSortChange}
      />
      <th className="py-2.5 px-4">Source</th>
      <th className="py-2.5 px-4">Status</th>
      <SortableColumn
        field="startedAt"
        label="Started"
        showOrder
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={onSortChange}
      />
      <SortableColumn
        field="durationSeconds"
        label="Duration"
        showOrder
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={onSortChange}
      />
      <SortableColumn
        field="recordsInput"
        label="In"
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={onSortChange}
      />
      <SortableColumn
        field="recordsOutput"
        label="Out"
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={onSortChange}
      />
      <SortableColumn
        field="recordsFailed"
        label="Rejected"
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={onSortChange}
      />
    </tr>
  </thead>
);
