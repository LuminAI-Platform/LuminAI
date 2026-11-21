import React from "react";
import { BodyPortal } from "../../../components/ui/BodyPortal";
import { Link } from "@tanstack/react-router";
import {
  Share2,
  ExternalLink,
  Calendar,
  Clock,
  AlertCircle,
} from "../../../lib/icons";
import type { EntityType } from "../../ontology/types";
import { getEntityColor } from "../../../lib/entityColors";
import { useThemeStore } from "../../../stores/themeStore";
import type { SearchResultItem } from "../../../pages/explorer/types";
import { formatShortDate } from "../../../pages/explorer/utils";
import { EntityPropertiesSection } from "./EntityPropertiesSection";
import { EntityProvenanceSection } from "./EntityProvenanceSection";
import { EntityDrawerHeader } from "./EntityDrawerHeader";
import { useEntityDetailDrawer } from "./useEntityDetailDrawer";

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
  const isDark = useThemeStore((s) => s.isDark);
  const {
    closeBtnRef,
    detail,
    loading,
    loadError,
    localReveal,
    toggleLocalReveal,
  } = useEntityDetailDrawer(entity?.id, onClose);

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
          title={detail?.canonicalName || entity.canonicalName}
          activeEntityType={activeEntityType}
          typeLabel={typeLabel}
          typeColor={typeColor}
          confidencePct={confidencePct}
          sourceCount={sourceCount}
          closeBtnRef={closeBtnRef}
          onClose={onClose}
        />

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
            onToggleReveal={toggleLocalReveal}
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
    </BodyPortal>
  );
};
