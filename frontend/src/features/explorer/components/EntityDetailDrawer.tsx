import React, { useEffect, useMemo, useRef, useState } from "react";
import { BodyPortal } from "../../../components/ui/BodyPortal";
import { Link } from "@tanstack/react-router";
import {
  Share2,
  ExternalLink,
  Calendar,
  Clock,
  AlertCircle,
  Copy,
  Check,
  Sparkles,
  ShieldCheck,
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
  extractQualityMetadata,
  formatShortDate,
  resolveEntityLabel,
  type TypeLabelFieldMap,
} from "../../../pages/explorer/utils";
import { EntityPropertiesSection } from "./EntityPropertiesSection";
import { EntityProvenanceSection } from "./EntityProvenanceSection";
import { EntityDrawerHeader } from "./EntityDrawerHeader";

interface EntityDetailDrawerProps {
  entity: SearchResultItem | null;
  ontologyTypes?: EntityType[];
  typeLabelFields?: TypeLabelFieldMap;
  maskSensitiveData: boolean;
  onClose: () => void;
}

function getQualityStateStyle(state: string): string {
  const upper = state.trim().toUpperCase();
  if (
    upper.includes("VERIFIED") ||
    upper.includes("CLEAN") ||
    upper.includes("VALID") ||
    upper.includes("PASS")
  ) {
    return "bg-success-bg text-success border-success-border";
  }
  if (
    upper.includes("QUARANTINE") ||
    upper.includes("WARN") ||
    upper.includes("REVIEW")
  ) {
    return "bg-warning-bg text-warning border-warning-border";
  }
  if (
    upper.includes("REJECT") ||
    upper.includes("FAIL") ||
    upper.includes("ERROR")
  ) {
    return "bg-error-bg text-error border-error-border";
  }
  return "bg-surface-subtle text-text-secondary border-border";
}

export const EntityDetailDrawer: React.FC<EntityDetailDrawerProps> = ({
  entity,
  ontologyTypes = [],
  typeLabelFields,
  maskSensitiveData,
  onClose,
}) => {
  const isOpen = entity !== null;
  const isDark = useThemeStore((s) => s.isDark);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const [detail, setDetail] = useState<EntityDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    setCopiedId(false);
  }, [entity?.id]);

  useEffect(() => {
    if (isOpen) {
      const id = window.requestAnimationFrame(() => {
        closeBtnRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(id);
    }
  }, [isOpen, entity?.id]);

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

  const rawProperties = useMemo(
    () => detail?.properties || entity?.properties || {},
    [detail?.properties, entity?.properties],
  );

  const { qualityScore, qualityState, sourceProperties } = useMemo(
    () => extractQualityMetadata(rawProperties),
    [rawProperties],
  );

  if (!entity) return null;

  const activeEntityType = detail?.entityType || entity.entityType || "Entity";
  const matchedType = ontologyTypes.find(
    (t) => (t.name || "").toLowerCase() === activeEntityType.toLowerCase(),
  );
  const typeColor =
    matchedType?.color || getEntityColor(activeEntityType, isDark);
  const typeLabel = matchedType?.label || activeEntityType;

  const displayLabel = resolveEntityLabel(
    {
      id: entity.id,
      canonicalName: detail?.canonicalName || entity.canonicalName,
      entityType: activeEntityType,
      properties: sourceProperties,
    },
    typeLabelFields,
    maskSensitiveData,
  );

  const sourceCount =
    typeof detail?.sourceCount === "number"
      ? detail.sourceCount
      : entity.sourceCount;
  const isMerged = typeof sourceCount === "number" && sourceCount >= 2;

  const confidenceScore =
    typeof detail?.confidenceScore === "number"
      ? detail.confidenceScore
      : entity.confidenceScore;
  // Only display match confidence for merged entities (2+ source records)
  const confidencePct =
    isMerged &&
    typeof confidenceScore === "number" &&
    Number.isFinite(confidenceScore)
      ? Math.round(
          confidenceScore <= 1 ? confidenceScore * 100 : confidenceScore,
        )
      : null;

  const sourceRecordIds = Array.isArray(detail?.sourceRecordIds)
    ? detail.sourceRecordIds
    : [];
  const sourceSystems =
    detail?.sourceSystems && detail.sourceSystems.length > 0
      ? detail.sourceSystems
      : entity.sourceSystems;
  const provenance = Array.isArray(detail?.provenance) ? detail.provenance : [];
  const matchReasons = isMerged
    ? detail?.matchReasons || entity.matchReasons
    : undefined;

  const createdLabel = formatShortDate(detail?.createdAt || entity.createdAt);
  const updatedLabel = formatShortDate(detail?.updatedAt || entity.updatedAt);

  const hasQualityData =
    qualityScore !== null ||
    qualityState !== null ||
    confidencePct !== null ||
    (Array.isArray(matchReasons) && matchReasons.length > 0);

  const handleCopyFullId = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(entity.id);
    }
    setCopiedId(true);
    window.setTimeout(() => setCopiedId(false), 1500);
  };

  return (
    <BodyPortal>
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-[9990] bg-black/40 backdrop-blur-[2px] transition-opacity duration-150 motion-reduce:transition-none"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="entity-drawer-title"
        className="fixed top-0 right-0 z-[9991] h-full w-full max-w-lg bg-surface border-l border-border shadow-2xl flex flex-col"
      >
        <EntityDrawerHeader
          activeEntityType={activeEntityType}
          typeColor={typeColor}
          typeLabel={typeLabel}
          displayLabel={displayLabel}
          sourceCount={sourceCount}
          onClose={onClose}
          closeBtnRef={closeBtnRef}
        />

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
          {loadError && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-error-bg border border-error-border text-xs text-error">
              <AlertCircle size={14} className="shrink-0" aria-hidden="true" />
              <span>
                Showing summary fields. Full detail request failed ({loadError}
                ).
              </span>
            </div>
          )}

          {/* Identifiers */}
          <section aria-labelledby="drawer-identifiers-heading">
            <h3
              id="drawer-identifiers-heading"
              className="text-xs font-semibold text-text-secondary mb-2.5"
            >
              Identifiers
            </h3>
            <div className="p-3.5 rounded-xl border border-border bg-surface-subtle/40 flex flex-col gap-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-text-secondary shrink-0">Entity ID</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    title={entity.id}
                    className="font-mono text-[11px] text-text truncate"
                  >
                    {entity.id}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyFullId}
                    aria-label={
                      copiedId ? "Copied entity ID" : "Copy entity ID"
                    }
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium text-text-secondary hover:text-text hover:bg-surface-hover border border-border-subtle shrink-0 transition-colors duration-150 motion-reduce:transition-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {copiedId ? (
                      <>
                        <Check
                          size={11}
                          className="text-success"
                          aria-hidden="true"
                        />
                        <span className="text-success">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={11} aria-hidden="true" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border-subtle">
                <div className="flex items-center gap-1.5 text-text-secondary">
                  <Calendar
                    size={12}
                    className="text-text-muted shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Created:{" "}
                    <strong className="font-medium text-text">
                      {createdLabel || "—"}
                    </strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-text-secondary">
                  <Clock
                    size={12}
                    className="text-text-muted shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Updated:{" "}
                    <strong className="font-medium text-text">
                      {updatedLabel || "—"}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Data quality */}
          <section aria-labelledby="drawer-quality-heading">
            <h3
              id="drawer-quality-heading"
              className="text-xs font-semibold text-text-secondary mb-2.5"
            >
              Data quality
            </h3>
            {hasQualityData ? (
              <div className="p-3.5 rounded-xl border border-border bg-surface-subtle/40 flex flex-col gap-2.5 text-xs">
                {qualityScore !== null && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-text-secondary inline-flex items-center gap-1.5">
                      <ShieldCheck
                        size={12}
                        className="text-text-muted"
                        aria-hidden="true"
                      />
                      <span>Quality score</span>
                    </span>
                    <span className="font-mono font-semibold text-text">
                      {qualityScore}
                    </span>
                  </div>
                )}

                {qualityState !== null && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-text-secondary">Quality state</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ${getQualityStateStyle(
                        qualityState,
                      )}`}
                    >
                      {qualityState}
                    </span>
                  </div>
                )}

                {confidencePct !== null && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-text-secondary inline-flex items-center gap-1.5">
                      <Sparkles
                        size={12}
                        className="text-primary"
                        aria-hidden="true"
                      />
                      <span>Match confidence</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-primary-tint text-primary border border-primary-border">
                      {confidencePct}%
                    </span>
                  </div>
                )}

                {matchReasons && matchReasons.length > 0 && (
                  <div className="pt-2 border-t border-border-subtle">
                    <div className="text-[11px] font-medium text-text-secondary mb-1.5">
                      Match reasons
                    </div>
                    <ul className="flex flex-col gap-1">
                      {matchReasons.map((r, i) => (
                        <li
                          key={i}
                          className="flex items-center justify-between text-[11px] text-text-secondary"
                        >
                          <span>{r.field || r.rule || r.detail}</span>
                          {typeof r.score === "number" && (
                            <span className="font-mono font-semibold text-primary">
                              {Math.round(
                                r.score <= 1 ? r.score * 100 : r.score,
                              )}
                              %
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-text-muted py-3 px-4 border border-dashed border-border rounded-xl">
                No data quality metrics returned for this entity.
              </p>
            )}
          </section>

          {/* Properties */}
          <EntityPropertiesSection
            entityId={entity.id}
            properties={sourceProperties}
            maskSensitiveData={maskSensitiveData}
          />

          {/* Sources */}
          <EntityProvenanceSection
            loading={loading}
            provenance={provenance}
            sourceRecordIds={sourceRecordIds}
            sourceSystems={sourceSystems}
            isMasked={maskSensitiveData}
            sourceCount={sourceCount}
          />
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
    </BodyPortal>
  );
};
