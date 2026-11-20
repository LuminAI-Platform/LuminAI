import React, { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  X,
  Share2,
  ExternalLink,
  GitMerge,
  Sparkles,
  Calendar,
  Clock,
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
import { formatShortDate } from "../../../pages/explorer/utils";
import { EntityTypeIcon } from "./EntityTypeIcon";
import { EntityPropertiesSection } from "./EntityPropertiesSection";
import { EntityProvenanceSection } from "./EntityProvenanceSection";

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

  useEffect(() => {
    setLocalReveal(false);
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

  if (!entity) return null;

  const activeEntityType = detail?.entityType || entity.entityType || "Entity";
  const matchedType = ontologyTypes.find(
    (t) => (t.name || "").toLowerCase() === activeEntityType.toLowerCase(),
  );
  const typeColor =
    matchedType?.color || getEntityColor(activeEntityType, isDark);
  const typeLabel = matchedType?.label || activeEntityType;

  const properties = detail?.properties || entity.properties || {};
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
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-150 motion-reduce:transition-none"
      />

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

          <EntityPropertiesSection
            properties={properties}
            maskSensitiveData={maskSensitiveData}
            localReveal={localReveal}
            onToggleReveal={() => setLocalReveal((v) => !v)}
          />

          <EntityProvenanceSection
            loading={loading}
            provenance={provenance}
            sourceRecordIds={sourceRecordIds}
            isMasked={isMasked}
            confidencePct={confidencePct}
            sourceCount={sourceCount}
            matchReasons={detail?.matchReasons}
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
    </>
  );
};
