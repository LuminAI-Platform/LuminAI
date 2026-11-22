import React from "react";
import { ArrowUpDown } from "../../../../lib/icons";
import type { PipelineRunItem } from "./pipelineAnalysisTypes";

interface RunsTableHeaderProps {
  sortBy: keyof PipelineRunItem;
  sortOrder: "asc" | "desc";
  onSortChange: (field: keyof PipelineRunItem) => void;
}

export const RunsTableHeader: React.FC<RunsTableHeaderProps> = ({
  sortBy,
  sortOrder,
  onSortChange,
}) => {
  return (
    <thead>
      <tr className="border-b border-border bg-surface-subtle/40 text-text-secondary font-semibold uppercase tracking-wider text-[10px]">
        <th
          className="py-2.5 px-4 cursor-pointer hover:text-text"
          onClick={() => onSortChange("connectorName")}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={sortBy === "connectorName" ? "text-primary font-bold" : ""}
            >
              Pipeline
            </span>
            <ArrowUpDown
              className={`w-2.5 h-2.5 ${sortBy === "connectorName" ? "text-primary" : ""}`}
            />
            {sortBy === "connectorName" && (
              <span className="text-[9px] font-mono lowercase">({sortOrder})</span>
            )}
          </div>
        </th>
        <th className="py-2.5 px-4">Source</th>
        <th className="py-2.5 px-4">Status</th>
        <th
          className="py-2.5 px-4 cursor-pointer hover:text-text"
          onClick={() => onSortChange("startedAt")}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={sortBy === "startedAt" ? "text-primary font-bold" : ""}
            >
              Started
            </span>
            <ArrowUpDown
              className={`w-2.5 h-2.5 ${sortBy === "startedAt" ? "text-primary" : ""}`}
            />
            {sortBy === "startedAt" && (
              <span className="text-[9px] font-mono lowercase">({sortOrder})</span>
            )}
          </div>
        </th>
        <th
          className="py-2.5 px-4 cursor-pointer hover:text-text"
          onClick={() => onSortChange("durationSeconds")}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={
                sortBy === "durationSeconds" ? "text-primary font-bold" : ""
              }
            >
              Duration
            </span>
            <ArrowUpDown
              className={`w-2.5 h-2.5 ${sortBy === "durationSeconds" ? "text-primary" : ""}`}
            />
            {sortBy === "durationSeconds" && (
              <span className="text-[9px] font-mono lowercase">({sortOrder})</span>
            )}
          </div>
        </th>
        <th
          className="py-2.5 px-4 cursor-pointer hover:text-text"
          onClick={() => onSortChange("recordsInput")}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={sortBy === "recordsInput" ? "text-primary font-bold" : ""}
            >
              In
            </span>
            <ArrowUpDown
              className={`w-2.5 h-2.5 ${sortBy === "recordsInput" ? "text-primary" : ""}`}
            />
          </div>
        </th>
        <th
          className="py-2.5 px-4 cursor-pointer hover:text-text"
          onClick={() => onSortChange("recordsOutput")}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={sortBy === "recordsOutput" ? "text-primary font-bold" : ""}
            >
              Out
            </span>
            <ArrowUpDown
              className={`w-2.5 h-2.5 ${sortBy === "recordsOutput" ? "text-primary" : ""}`}
            />
          </div>
        </th>
        <th
          className="py-2.5 px-4 cursor-pointer hover:text-text"
          onClick={() => onSortChange("recordsFailed")}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={sortBy === "recordsFailed" ? "text-primary font-bold" : ""}
            >
              Rejected
            </span>
            <ArrowUpDown
              className={`w-2.5 h-2.5 ${sortBy === "recordsFailed" ? "text-primary" : ""}`}
            />
          </div>
        </th>
      </tr>
    </thead>
  );
};
