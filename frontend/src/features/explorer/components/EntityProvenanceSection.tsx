import React from "react";
import { Database } from "../../../lib/icons";
import type { EntityDetail } from "../../../pages/explorer/types";
import {
  formatPropertyLabel,
  formatShortDate,
  maskSensitiveValue,
} from "../../../pages/explorer/utils";

interface EntityProvenanceSectionProps {
  loading: boolean;
  provenance: Array<{
    fieldName?: string;
    propertyKey?: string;
    contributedValue?: unknown;
    sourceName?: string;
    sourceDataset?: string;
    sourceRecordId?: string | number;
    action?: string;
    occurredAt?: string;
    ingestedAt?: string;
  }>;
  sourceRecordIds: string[];
  isMasked: boolean;
  confidencePct: number | null;
  sourceCount?: number;
  matchReasons?: EntityDetail["matchReasons"];
}

export const EntityProvenanceSection: React.FC<EntityProvenanceSectionProps> = ({
  loading,
  provenance,
  sourceRecordIds,
  isMasked,
  confidencePct,
  sourceCount,
  matchReasons,
}) => {
  return (
    <>
      {/* Source Records & Provenance Section */}
      <section aria-labelledby="drawer-sources-heading">
        <h3
          id="drawer-sources-heading"
          className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3"
        >
          Source Records &amp; Provenance
        </h3>

        {loading ? (
          <div className="flex flex-col gap-2">
            <div className="h-10 rounded-xl bg-surface-subtle animate-pulse motion-reduce:animate-none" />
            <div className="h-10 rounded-xl bg-surface-subtle animate-pulse motion-reduce:animate-none" />
          </div>
        ) : provenance.length > 0 ? (
          <div className="flex flex-col gap-2">
            {provenance.map((p, idx) => {
              const fieldKey = p.fieldName || p.propertyKey || "attribute";
              const maskedVal = maskSensitiveValue(
                fieldKey,
                p.contributedValue,
                isMasked,
              );
              return (
                <div
                  key={`${fieldKey}-${p.sourceRecordId || idx}`}
                  className="p-3 rounded-xl border border-border bg-surface-subtle/40 flex flex-col gap-1 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-text">
                      {formatPropertyLabel(fieldKey)}
                    </span>
                    {p.action && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary-tint text-primary border border-primary-border uppercase">
                        {p.action}
                      </span>
                    )}
                  </div>
                  {p.contributedValue !== undefined &&
                    p.contributedValue !== null && (
                      <div className="text-text-secondary truncate">
                        Value:{" "}
                        <span className="text-text font-medium">
                          {maskedVal}
                        </span>
                      </div>
                    )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
                    {(p.sourceName || p.sourceDataset) && (
                      <span className="inline-flex items-center gap-1">
                        <Database size={11} aria-hidden="true" />
                        <span>{p.sourceName || p.sourceDataset}</span>
                      </span>
                    )}
                    {p.sourceRecordId && (
                      <span className="font-mono">
                        Record {String(p.sourceRecordId).slice(0, 8)}
                      </span>
                    )}
                    {(p.occurredAt || p.ingestedAt) && (
                      <span>
                        {formatShortDate(p.occurredAt || p.ingestedAt)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : sourceRecordIds.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {sourceRecordIds.map((srcId) => (
              <li
                key={srcId}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface-subtle/40 text-xs font-mono text-text-secondary"
              >
                <Database
                  size={13}
                  className="text-text-muted shrink-0"
                  aria-hidden="true"
                />
                <span className="truncate">{srcId}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-text-muted py-4 text-center border border-dashed border-border rounded-xl">
            No field-level provenance records returned for this entity.
          </p>
        )}
      </section>

      {/* Match Details */}
      {(confidencePct !== null || (matchReasons && matchReasons.length > 0)) && (
        <section aria-labelledby="drawer-match-heading">
          <h3
            id="drawer-match-heading"
            className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3"
          >
            Resolution Details
          </h3>
          <div className="p-4 rounded-xl border border-border bg-surface-subtle/40 flex flex-col gap-2 text-xs">
            {confidencePct !== null && (
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">
                  Engine confidence score
                </span>
                <span className="font-semibold text-primary">
                  {confidencePct}%
                </span>
              </div>
            )}
            {typeof sourceCount === "number" && (
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">
                  Merged source records
                </span>
                <span className="font-semibold text-text">{sourceCount}</span>
              </div>
            )}
            {matchReasons && matchReasons.length > 0 && (
              <ul className="mt-2 pt-2 border-t border-border-subtle flex flex-col gap-1.5">
                {matchReasons.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between text-[11px] text-text-secondary"
                  >
                    <span>{r.field || r.rule || r.detail}</span>
                    {typeof r.score === "number" && (
                      <span className="font-mono font-semibold text-primary">
                        {Math.round(r.score <= 1 ? r.score * 100 : r.score)}%
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </>
  );
};
