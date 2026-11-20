import React, { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  X,
  Share2,
  ExternalLink,
  Eye,
  EyeOff,
  GitMerge,
  Sparkles,
  Calendar,
  Clock,
  Database,
  AlertCircle,
} from "../../../lib/icons";
import { apiFetch } from "../../../lib/api";
import type { EntityType } from "../../ontology/types";
import { getEntityColor } from "../../../lib/entityColors";
import { useThemeStore } from "../../../stores/themeStore";
import type {
  EntityDetail,
  SearchResultItem,
} from "../../../pages/explorer/types";
import {
  formatPropertyLabel,
  formatShortDate,
  hasSensitiveProperties,
  isSensitiveField,
  maskSensitiveValue,
} from "../../../pages/explorer/utils";
import { EntityTypeIcon } from "./EntityTypeIcon";

interface EntityDetailDrawerProps {
  entity: SearchResultItem | null;
  ontologyTypes?: EntityType[];
  maskSensitiveData: boolean;
  onClose: () => void;
}

export const EntityDetailDrawer: React.FC<EntityDetailDrawerProps> = ({
  entity,
  ontologyTypes = [],
  maskSensitiveData,
  onClose,
}) => {
  const isOpen = entity !== null;
  const isDark = useThemeStore((s) => s.isDark);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const [detail, setDetail] = useState<EntityDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [localReveal, setLocalReveal] = useState(false);

  // Reset local reveal when switching entities
  useEffect(() => {
    setLocalReveal(false);
  }, [entity?.id]);

  // Move focus into the drawer when opened
  useEffect(() => {
    if (isOpen) {
      const id = window.requestAnimationFrame(() => {
        closeBtnRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(id);
    }
  }, [isOpen, entity?.id]);

  // Escape closes drawer
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch full entity detail (properties, sourceRecordIds, provenance)
  useEffect(() => {
    if (!entity?.id) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    const fetchDetail = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await apiFetch(`/api/v1/explorer/entities/${entity.id}`, {
          headers: { "X-Suppress-Toast": "true" },
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as EntityDetail;
        if (!cancelled) {
          setDetail(data);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load details",
          );
          setDetail(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [entity?.id]);

  if (!entity) return null;

  const activeEntityType = detail?.entityType || entity.entityType || "Entity";
  const matchedType = ontologyTypes.find(
    (t) => (t.name || "").toLowerCase() === activeEntityType.toLowerCase(),
  );
  const typeColor =
    matchedType?.color || getEntityColor(activeEntityType, isDark);
  const typeLabel = matchedType?.label || activeEntityType;

  const properties = detail?.properties || entity.properties || {};
  const propertyEntries = Object.entries(properties);
  const sensitivePresent = hasSensitiveProperties(properties);
  const isMasked = maskSensitiveData && !localReveal;

  const confidenceScore =
    typeof detail?.confidenceScore === "number"
      ? detail.confidenceScore
      : entity.confidenceScore;
  const confidencePct =
    typeof confidenceScore === "number" && Number.isFinite(confidenceScore)
      ? Math.round(
          confidenceScore <= 1 ? confidenceScore * 100 : confidenceScore,
        )
      : null;

  const sourceCount =
    typeof detail?.sourceCount === "number"
      ? detail.sourceCount
      : entity.sourceCount;

  const sourceRecordIds = Array.isArray(detail?.sourceRecordIds)
    ? detail.sourceRecordIds
    : [];
  const provenance = Array.isArray(detail?.provenance) ? detail.provenance : [];

  const createdLabel = formatShortDate(detail?.createdAt || entity.createdAt);
  const updatedLabel = formatShortDate(detail?.updatedAt || entity.updatedAt);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-150 motion-reduce:transition-none"
      />

      {/* Right-side Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="entity-drawer-title"
        className="fixed top-0 right-0 z-50 h-full w-full max-w-lg bg-surface border-l border-border shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 mt-0.5"
              style={{
                backgroundColor: `${typeColor}14`,
                borderColor: `${typeColor}33`,
                color: typeColor,
              }}
              aria-hidden="true"
            >
              <EntityTypeIcon entityType={activeEntityType} size={20} />
            </div>
            <div className="min-w-0">
              <h2
                id="entity-drawer-title"
                className="text-base font-bold text-text leading-snug break-words"
              >
                {detail?.canonicalName || entity.canonicalName}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border"
                  style={{
                    backgroundColor: `${typeColor}12`,
                    borderColor: `${typeColor}30`,
                    color: typeColor,
                  }}
                >
                  <EntityTypeIcon entityType={activeEntityType} size={11} />
                  <span>{typeLabel}</span>
                </span>

                {confidencePct !== null && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-primary-tint text-primary border border-primary-border">
                    <Sparkles size={11} aria-hidden="true" />
                    <span>{confidencePct}% confidence</span>
                  </span>
                )}

                {typeof sourceCount === "number" && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-text-secondary">
                    <GitMerge size={12} aria-hidden="true" />
                    <span>
                      {sourceCount > 1
                        ? `Merged from ${sourceCount} records`
                        : "1 source record"}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close entity details"
            className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-surface-hover border border-transparent hover:border-border transition-colors duration-150 motion-reduce:transition-none cursor-pointer shrink-0"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
          {/* Metadata timestamps & ID */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-secondary bg-surface-subtle/60 border border-border-subtle rounded-xl px-4 py-2.5">
            <span className="font-mono text-[11px] text-text-muted">
              ID: {entity.id}
            </span>
            {createdLabel && (
              <span className="inline-flex items-center gap-1">
                <Calendar
                  size={12}
                  className="text-text-muted"
                  aria-hidden="true"
                />
                <span>Created {createdLabel}</span>
              </span>
            )}
            {updatedLabel && (
              <span className="inline-flex items-center gap-1">
                <Clock
                  size={12}
                  className="text-text-muted"
                  aria-hidden="true"
                />
                <span>Updated {updatedLabel}</span>
              </span>
            )}
          </div>

          {loadError && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-error-bg border border-error-border text-xs text-error">
              <AlertCircle size={14} className="shrink-0" aria-hidden="true" />
              <span>
                Showing summary fields. Full detail request failed ({loadError}
                ).
              </span>
            </div>
          )}

          {/* Properties Section */}
          <section aria-labelledby="drawer-properties-heading">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3
                id="drawer-properties-heading"
                className="text-xs font-bold uppercase tracking-wider text-text-muted"
              >
                Properties ({propertyEntries.length})
              </h3>
              {maskSensitiveData && sensitivePresent && (
                <button
                  type="button"
                  onClick={() => setLocalReveal((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-text-secondary hover:text-text bg-surface-subtle hover:bg-surface-hover border border-border transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
                >
                  {localReveal ? (
                    <>
                      <EyeOff size={13} aria-hidden="true" />
                      <span>Mask sensitive</span>
                    </>
                  ) : (
                    <>
                      <Eye size={13} aria-hidden="true" />
                      <span>Reveal sensitive</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {propertyEntries.length === 0 ? (
              <p className="text-xs text-text-muted py-4 text-center border border-dashed border-border rounded-xl">
                No properties recorded for this entity.
              </p>
            ) : (
              <dl className="divide-y divide-border-subtle border border-border rounded-xl overflow-hidden bg-surface">
                {propertyEntries.map(([key, val]) => {
                  const sensitive = isSensitiveField(key);
                  const displayVal = maskSensitiveValue(key, val, isMasked);
                  return (
                    <div
                      key={key}
                      className="grid grid-cols-[140px_1fr] gap-3 px-4 py-2.5 text-xs items-baseline"
                    >
                      <dt
                        title={key}
                        className="font-medium text-text-secondary truncate"
                      >
                        {formatPropertyLabel(key)}
                      </dt>
                      <dd
                        className={`text-text break-words ${
                          sensitive && isMasked
                            ? "font-mono tracking-wider text-text-secondary"
                            : "font-medium"
                        }`}
                      >
                        {displayVal}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </section>

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

          {/* Match Details — only shows fields actually returned by the API */}
          {(confidencePct !== null ||
            (detail?.matchReasons && detail.matchReasons.length > 0)) && (
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
                    <span className="font-semibold text-text">
                      {sourceCount}
                    </span>
                  </div>
                )}
                {detail?.matchReasons && detail.matchReasons.length > 0 && (
                  <ul className="mt-2 pt-2 border-t border-border-subtle flex flex-col gap-1.5">
                    {detail.matchReasons.map((r, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between text-[11px] text-text-secondary"
                      >
                        <span>{r.field || r.rule || r.detail}</span>
                        {typeof r.score === "number" && (
                          <span className="font-mono font-semibold text-primary">
                            {Math.round(r.score <= 1 ? r.score * 100 : r.score)}
                            %
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border bg-surface shrink-0">
          <Link
            to="/explorer/$entityId"
            params={{ entityId: entity.id }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-text-secondary hover:text-text hover:bg-surface-hover border border-border transition-colors duration-150 motion-reduce:transition-none"
          >
            <ExternalLink size={14} aria-hidden="true" />
            <span>Full details</span>
          </Link>

          <Link
            to="/graph"
            search={{ entityId: entity.id }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-primary hover:bg-primary-hover text-primary-text transition-colors duration-150 motion-reduce:transition-none shadow-xs"
          >
            <Share2 size={14} aria-hidden="true" />
            <span>Open in Knowledge Graph</span>
          </Link>
        </div>
      </aside>
    </>
  );
};
