import React, { useState, useRef } from "react";
import { Search, CheckCircle2, XCircle } from "../../../../lib/icons";
import type { PipelineRunItem } from "./pipelineAnalysisTypes";
import { RunDetailDrawer } from "./RunDetailDrawer";
import { Select } from "../../../../components/ui/dropdown";
import { RunsTableHeader } from "./RunsTableHeader";
import { RunsTablePagination } from "./RunsTablePagination";

interface RunsTableProps {
  runs: PipelineRunItem[];
  totalElements?: number;
  totalPages?: number;
  currentPage: number;
  pageSize?: number;
  onPageChange: (newPage: number) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  sortBy: keyof PipelineRunItem;
  sortOrder: "asc" | "desc";
  onSortChange: (field: keyof PipelineRunItem) => void;
  selectedRunId?: string | null;
  onClearSelectedRunId?: () => void;
}

export const RunsTable: React.FC<RunsTableProps> = ({
  runs,
  totalElements = 0,
  totalPages = 1,
  currentPage,
  onPageChange,
  statusFilter,
  onStatusFilterChange,
  searchTerm,
  onSearchTermChange,
  sortBy,
  sortOrder,
  onSortChange,
  selectedRunId,
  onClearSelectedRunId,
}) => {
  const [selectedRun, setSelectedRun] = useState<PipelineRunItem | null>(null);
  const activeRowRef = useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    if (selectedRunId) {
      const match = runs.find((r) => r.id === selectedRunId);
      if (match) setSelectedRun(match);
      onClearSelectedRunId?.();
    }
  }, [selectedRunId, runs, onClearSelectedRunId]);

  const statusOptions = ["ALL", "RUNNING", "COMPLETED", "FAILED"];

  const formatNum = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "RUNNING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warning-bg border border-warning-border text-warning">
            <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
            <span>RUNNING</span>
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success-bg border border-success-border text-success">
            <CheckCircle2 className="w-3 h-3 text-success" />
            <span>COMPLETED</span>
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-error-bg border border-error-border text-error">
            <XCircle className="w-3 h-3 text-error" />
            <span>FAILED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-subtle border border-border text-text-secondary">
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl shadow-xs transition-colors select-none">
      <div className="p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-text">
            Historical Pipeline Runs
          </h3>
          <p className="text-xs text-text-secondary mt-0.5">
            Click any row to inspect execution timeline, stage logs, and
            diagnostic remediation
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="flex items-center bg-surface-subtle border border-border rounded-lg px-2.5 py-1.5 w-full sm:w-64 gap-2 focus-within:border-border-focus">
            <Search className="w-3.5 h-3.5 text-text-secondary shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              placeholder="Search runs..."
              className="bg-transparent border-none outline-none text-text text-xs placeholder:text-text-secondary w-full"
            />
          </div>

          <div className="w-36">
            <Select
              value={statusFilter}
              onChange={onStatusFilterChange}
              options={statusOptions.map((st) => ({
                value: st,
                label: st === "ALL" ? "All Statuses" : st,
              }))}
              ariaLabel="Filter runs by status"
              size="sm"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <RunsTableHeader
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={onSortChange}
          />
          <tbody className="divide-y divide-border">
            {runs.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="py-12 text-center text-xs text-text-secondary"
                >
                  {statusFilter === "ALL" && !searchTerm
                    ? "No pipeline runs yet"
                    : `No runs matching filter "${statusFilter}"`}
                </td>
              </tr>
            ) : (
              runs.map((run) => (
                <tr
                  key={run.id}
                  onClick={(e) => {
                    activeRowRef.current =
                      e.currentTarget as unknown as HTMLButtonElement;
                    setSelectedRun(run);
                  }}
                  className="hover:bg-surface-subtle/70 transition-colors cursor-pointer group"
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      activeRowRef.current =
                        e.currentTarget as unknown as HTMLButtonElement;
                      setSelectedRun(run);
                    }
                  }}
                >
                  <td className="py-3 px-4 font-semibold text-text group-hover:text-primary transition-colors">
                    {run.connectorName}
                  </td>
                  <td className="py-3 px-4 text-text-secondary font-mono text-[11px]">
                    {run.connectorType}
                  </td>
                  <td className="py-3 px-4">{getStatusBadge(run.status)}</td>
                  <td className="py-3 px-4 text-text-secondary font-mono text-[11px]">
                    {new Date(run.startedAt).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    {new Date(run.startedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-3 px-4 font-mono text-text">
                    {run.durationSeconds}s
                  </td>
                  <td className="py-3 px-4 font-mono text-text">
                    {formatNum(run.recordsInput)}
                  </td>
                  <td className="py-3 px-4 font-mono text-success font-medium">
                    {formatNum(run.recordsOutput)}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    <span
                      className={
                        run.recordsFailed > 0
                          ? "text-error font-medium"
                          : "text-text-secondary"
                      }
                    >
                      {formatNum(run.recordsFailed)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <RunsTablePagination
        runsCount={runs.length}
        totalElements={totalElements}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />

      {selectedRun && (
        <RunDetailDrawer
          run={selectedRun}
          onClose={() => setSelectedRun(null)}
          triggerButtonRef={activeRowRef}
        />
      )}
    </div>
  );
};
