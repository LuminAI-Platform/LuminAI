import React from "react";
import { X, ICON_MAP, ICON_SIZES } from "../../../lib/icons";
import { Tooltip } from "../../../components/ui/Tooltip";
import {
  getRowOriginalAttributes,
  getRowQualityState,
  getRowReasons,
  getRowScores,
  toSentenceCaseHeader,
} from "./cleanDataUtils";

interface CleanDataRowPanelProps {
  row: Record<string, unknown>;
  businessColumns: string[];
  onClose: () => void;
}

function formatFieldVal(val: unknown): string {
  if (val === null || val === undefined || val === "") return "Empty";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

export const CleanDataRowPanel: React.FC<CleanDataRowPanelProps> = ({
  row,
  businessColumns,
  onClose,
}) => {
  const state = getRowQualityState(row);
  const scores = getRowScores(row);
  const reasons = getRowReasons(row);
  const originalAttrs = getRowOriginalAttributes(row);
  const rowId = row.id != null ? String(row.id) : null;

  const StateIcon =
    state === "QUARANTINED"
      ? ICON_MAP.status.failed
      : state === "NEEDS_REVIEW"
        ? ICON_MAP.status.completedWithIssues
        : ICON_MAP.status.completed;

  const stateLabel =
    state === "QUARANTINED"
      ? "Quarantined"
      : state === "NEEDS_REVIEW"
        ? "Needs review"
        : "Verified";

  const stateBadgeClass =
    state === "QUARANTINED"
      ? "bg-error-bg text-error border-error-border"
      : state === "NEEDS_REVIEW"
        ? "bg-warning-bg text-warning border-warning-border"
        : "bg-success-bg text-success border-success-border";

  return (
    <aside
      aria-label="Record details"
      className="w-full md:w-88 shrink-0 border-t md:border-t-0 md:border-l border-border bg-surface flex flex-col max-h-[40vh] md:max-h-none overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <h4 className="text-xs font-semibold text-text">Record details</h4>
          {rowId && (
            <p className="text-[11px] font-mono text-text-muted truncate mt-0.5">
              {rowId}
            </p>
          )}
        </div>
        <Tooltip label="Close record details" side="left">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close record details"
            className="p-1 rounded-lg text-text-secondary hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X size={ICON_SIZES.dropdown} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${stateBadgeClass}`}
          >
            <StateIcon size={12} aria-hidden="true" />
            {stateLabel}
          </span>
          {scores.primaryScore !== null && (
            <span className="text-xs font-medium text-text-secondary tabular-nums">
              Quality {scores.primaryScore}%
              {scores.scoresDiffer && scores.confidenceScore !== null
                ? ` · Confidence ${scores.confidenceScore}%`
                : ""}
            </span>
          )}
        </div>

        {(state !== "VERIFIED" || reasons.length > 0) && (
          <div className="space-y-1.5">
            <h5 className="text-xs font-semibold text-text">
              Validation reason
            </h5>
            {reasons.length > 0 ? (
              <ul className="space-y-1.5">
                {reasons.map((item, idx) => (
                  <li
                    key={idx}
                    className={`rounded-lg border px-2.5 py-2 text-xs ${
                      state === "QUARANTINED"
                        ? "bg-error-bg border-error-border text-error"
                        : "bg-warning-bg border-warning-border text-warning"
                    }`}
                  >
                    {item.field && (
                      <span className="font-semibold">
                        {toSentenceCaseHeader(item.field)}:{" "}
                      </span>
                    )}
                    <span>{item.problem}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-text-muted">No reason provided</p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <h5 className="text-xs font-semibold text-text">
            {originalAttrs ? "Raw vs cleaned values" : "Cleaned field values"}
          </h5>
          {!originalAttrs && (
            <p className="text-[11px] text-text-muted">
              Original raw values are not returned by the API for row-level
              comparison.
            </p>
          )}
          <dl className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            {businessColumns.map((col) => {
              const cleanedText = formatFieldVal(row[col]);
              const rawText = originalAttrs
                ? formatFieldVal(originalAttrs[col])
                : null;
              const changed = rawText !== null && rawText !== cleanedText;

              return (
                <div
                  key={col}
                  className={`px-3 py-2 ${changed ? "bg-warning-bg/40" : "bg-surface"}`}
                >
                  <dt className="text-[11px] font-medium text-text-secondary flex items-center justify-between gap-2">
                    <span>{toSentenceCaseHeader(col)}</span>
                    {changed && (
                      <span className="text-[10px] font-medium text-warning">
                        Changed
                      </span>
                    )}
                  </dt>
                  {originalAttrs ? (
                    <dd className="mt-1 space-y-0.5 text-xs">
                      <div className="text-text-muted break-words">
                        Raw:{" "}
                        <span className="text-text-secondary">{rawText}</span>
                      </div>
                      <div className="text-text font-medium break-words">
                        Cleaned: {cleanedText}
                      </div>
                    </dd>
                  ) : (
                    <dd className="mt-0.5 text-xs text-text break-words">
                      {cleanedText}
                    </dd>
                  )}
                </div>
              );
            })}
          </dl>
        </div>
      </div>
    </aside>
  );
};
