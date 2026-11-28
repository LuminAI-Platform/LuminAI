import React, { useMemo } from "react";
import { Database, GitMerge } from "../../../lib/icons";
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
  sourceSystems?: string[];
  isMasked: boolean;
  sourceCount?: number;
}

export const EntityProvenanceSection: React.FC<
  EntityProvenanceSectionProps
> = ({
  loading,
  provenance,
  sourceRecordIds,
  sourceSystems,
  isMasked,
  sourceCount,
}) => {
  const datasetNames = useMemo(() => {
    const names = new Set<string>();
    if (Array.isArray(sourceSystems)) {
      for (const s of sourceSystems) {
        if (s && s.trim()) names.add(s.trim());
      }
    }
    for (const p of provenance) {
      const name = (p.sourceDataset || p.sourceName || "").trim();
      if (name) names.add(name);
    }
    return Array.from(names);
  }, [sourceSystems, provenance]);

  const effectiveSourceCount =
    typeof sourceCount === "number"
      ? sourceCount
      : sourceRecordIds.length > 0
        ? sourceRecordIds.length
        : undefined;

  return (
    <section aria-labelledby="drawer-sources-heading">
      <h3
        id="drawer-sources-heading"
        className="text-xs font-semibold text-text-secondary mb-2.5"
      >
        Sources
      </h3>

      <div className="p-3.5 rounded-xl border border-border bg-surface-subtle/40 flex flex-col gap-2 text-xs mb-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-text-secondary inline-flex items-center gap-1.5">
            <GitMerge
              size={12}
              className="text-text-muted"
              aria-hidden="true"
            />
            <span>Source records</span>
          </span>
          <span className="font-semibold text-text">
            {effectiveSourceCount !== undefined
              ? `${effectiveSourceCount} ${
                  effectiveSourceCount === 1 ? "record" : "records"
                }`
              : "—"}
          </span>
        </div>

        <div className="flex items-start justify-between gap-3">
          <span className="text-text-secondary inline-flex items-center gap-1.5 shrink-0">
            <Database
              size={12}
              className="text-text-muted"
              aria-hidden="true"
            />
            <span>Datasets</span>
          </span>
          {datasetNames.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-1.5">
              {datasetNames.map((name) => (
                <span
                  key={name}
                  title={name}
                  className="px-2 py-0.5 rounded-md bg-surface border border-border text-[11px] font-medium text-text max-w-[220px] truncate"
                >
                  {name}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-text-muted">Not reported</span>
          )}
        </div>
      </div>

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
                className="p-3 rounded-xl border border-border bg-surface flex flex-col gap-1 text-xs"
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
                      <span className="text-text font-medium">{maskedVal}</span>
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
                    <span>{formatShortDate(p.occurredAt || p.ingestedAt)}</span>
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
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface text-xs font-mono text-text-secondary"
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
      ) : null}
    </section>
  );
};
