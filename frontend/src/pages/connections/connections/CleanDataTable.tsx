import React, { useEffect, useRef } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, ICON_MAP } from "../../../lib/icons";
import { Tooltip } from "../../../components/ui/Tooltip";
import {
  getRowQualityState,
  getRowReasons,
  getRowScores,
  toSentenceCaseHeader,
} from "./cleanDataUtils";

interface CleanDataTableProps {
  rows: Record<string, unknown>[];
  visibleColumns: string[];
  showReasonColumn: boolean;
  sortColumn: string | null;
  sortDir: "asc" | "desc";
  onSort: (col: string) => void;
  selectedRowIndex: number | null;
  onSelectRow: (index: number) => void;
  resetScrollKey: string;
}

function formatCellText(val: unknown): string {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

export const CleanDataTable: React.FC<CleanDataTableProps> = ({
  rows,
  visibleColumns,
  showReasonColumn,
  sortColumn,
  sortDir,
  onSort,
  selectedRowIndex,
  onSelectRow,
  resetScrollKey,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
    }
  }, [resetScrollKey]);

  const renderSortIcon = (col: string) => {
    if (sortColumn !== col) {
      return (
        <ArrowUpDown
          size={12}
          className="text-text-muted opacity-60 shrink-0"
          aria-hidden="true"
        />
      );
    }
    const Icon = sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <Icon size={12} className="text-primary shrink-0" aria-hidden="true" />
    );
  };

  const displayRows = rows.slice(0, 200);

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-auto bg-surface min-h-0"
    >
      <table className="w-full text-left text-xs border-collapse">
        <thead className="sticky top-0 z-20 bg-surface-subtle border-b border-border">
          <tr>
            {visibleColumns.map((col, colIdx) => {
              const isPinnedFirst = colIdx === 0;
              const ariaSort =
                sortColumn === col
                  ? sortDir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none";
              return (
                <th
                  key={col}
                  aria-sort={ariaSort}
                  className={`py-2.5 px-4 font-semibold text-text text-xs whitespace-nowrap bg-surface-subtle ${
                    isPinnedFirst
                      ? "sticky left-0 z-30 border-r border-border min-w-[140px]"
                      : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSort(col)}
                    className="inline-flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded"
                  >
                    <span>{toSentenceCaseHeader(col)}</span>
                    {renderSortIcon(col)}
                  </button>
                </th>
              );
            })}

            {showReasonColumn && (
              <th className="py-2.5 px-4 font-semibold text-text text-xs whitespace-nowrap bg-surface-subtle min-w-[220px]">
                Reason
              </th>
            )}

            <th
              aria-sort={
                sortColumn === "__quality__"
                  ? sortDir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
              className="sticky right-0 z-30 py-2.5 px-4 font-semibold text-text text-xs whitespace-nowrap bg-surface-subtle border-l border-border min-w-[175px]"
            >
              <button
                type="button"
                onClick={() => onSort("__quality__")}
                className="inline-flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded"
              >
                <span>Quality</span>
                {renderSortIcon("__quality__")}
              </button>
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-border">
          {displayRows.map((row, idx) => {
            const state = getRowQualityState(row);
            const scores = getRowScores(row);
            const reasons = getRowReasons(row);
            const isSelected = selectedRowIndex === idx;

            const stateMeta =
              state === "QUARANTINED"
                ? {
                    Icon: ICON_MAP.status.failed,
                    label: "Quarantined",
                    badge: "bg-error-bg text-error border-error-border",
                    rowBg: isSelected
                      ? "bg-primary-tint/50"
                      : "bg-error-bg/40 hover:bg-error-bg/60",
                    stickyBg: isSelected ? "bg-primary-tint" : "bg-error-bg",
                  }
                : state === "NEEDS_REVIEW"
                  ? {
                      Icon: ICON_MAP.status.completedWithIssues,
                      label: "Needs review",
                      badge: "bg-warning-bg text-warning border-warning-border",
                      rowBg: isSelected
                        ? "bg-primary-tint/50"
                        : "bg-warning-bg/40 hover:bg-warning-bg/60",
                      stickyBg: isSelected
                        ? "bg-primary-tint"
                        : "bg-warning-bg",
                    }
                  : {
                      Icon: ICON_MAP.status.completed,
                      label: "Verified",
                      badge: "bg-success-bg text-success border-success-border",
                      rowBg: isSelected
                        ? "bg-primary-tint/50"
                        : "bg-surface hover:bg-surface-hover",
                      stickyBg: isSelected ? "bg-primary-tint" : "bg-surface",
                    };
            const {
              Icon: StateIcon,
              label: stateLabel,
              badge: badgeClass,
              rowBg,
              stickyBg,
            } = stateMeta;

            const scoreTooltip = scores.scoresDiffer
              ? `Quality score: ${scores.qualityScore}% · Confidence: ${scores.confidenceScore}%`
              : scores.primaryScore !== null
                ? `Quality score: ${scores.primaryScore}%`
                : "No score returned";

            const reasonSummary =
              reasons.length > 0
                ? reasons
                    .map((r) =>
                      r.field
                        ? `${toSentenceCaseHeader(r.field)}: ${r.problem}`
                        : r.problem,
                    )
                    .join("; ")
                : state !== "VERIFIED"
                  ? "No reason provided"
                  : "—";

            return (
              <tr
                key={idx}
                tabIndex={0}
                onClick={() => onSelectRow(idx)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectRow(idx);
                  }
                }}
                className={`${rowBg} transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary`}
              >
                {visibleColumns.map((col, colIdx) => {
                  const isPinnedFirst = colIdx === 0;
                  const text = formatCellText(row[col]);
                  const isCodeCol =
                    col.toLowerCase() === "id" ||
                    col.toLowerCase().endsWith("_id") ||
                    col.toLowerCase() === "mrn";

                  return (
                    <td
                      key={col}
                      title={text || undefined}
                      className={`py-2.5 px-4 whitespace-nowrap max-w-[240px] truncate ${
                        isCodeCol ? "font-mono text-[11px]" : "text-xs"
                      } ${
                        isPinnedFirst
                          ? `sticky left-0 z-10 border-r border-border font-medium text-text ${stickyBg}`
                          : "text-text"
                      }`}
                    >
                      {text ? (
                        text
                      ) : (
                        <span className="text-text-muted italic">Empty</span>
                      )}
                    </td>
                  );
                })}

                {showReasonColumn && (
                  <td
                    title={reasonSummary}
                    className={`py-2.5 px-4 max-w-[280px] truncate text-xs ${
                      reasons.length > 0
                        ? state === "QUARANTINED"
                          ? "text-error"
                          : "text-warning"
                        : "text-text-muted"
                    }`}
                  >
                    {reasonSummary}
                  </td>
                )}

                <td
                  className={`sticky right-0 z-10 py-2.5 px-4 whitespace-nowrap border-l border-border ${stickyBg}`}
                >
                  <Tooltip label={scoreTooltip} side="left">
                    <div className="inline-flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${badgeClass}`}
                      >
                        <StateIcon size={12} aria-hidden="true" />
                        {stateLabel}
                      </span>
                      {scores.primaryScore !== null && (
                        <span className="text-xs font-medium text-text-secondary tabular-nums">
                          {scores.primaryScore}%
                        </span>
                      )}
                    </div>
                  </Tooltip>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
