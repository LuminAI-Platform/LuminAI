import React, { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "../../../lib/icons";
import { sanitizeHtml } from "../../../lib/sanitize";
import type { EntityType } from "../../ontology/types";
import { getEntityColor } from "../../../lib/entityColors";
import { useThemeStore } from "../../../stores/themeStore";
import type { SearchResultItem } from "../../../pages/explorer/types";
import {
  isSensitiveField,
  pickKeyCardFields,
} from "../../../pages/explorer/utils";
import { EntityTypeIcon } from "./EntityTypeIcon";
import { EntityCardFields } from "./EntityCardFields";
import { EntityCardFooter } from "./EntityCardFooter";

interface EntityCardProps {
  entity: SearchResultItem;
  ontologyTypes?: EntityType[];
  maskSensitiveData: boolean;
  onSelect: (entity: SearchResultItem, triggerEl: HTMLElement | null) => void;
}

export const EntityCard: React.FC<EntityCardProps> = ({
  entity,
  ontologyTypes = [],
  maskSensitiveData,
  onSelect,
}) => {
  const isDark = useThemeStore((s) => s.isDark);
  const [localReveal, setLocalReveal] = useState(false);
  const [showWhyMerged, setShowWhyMerged] = useState(false);

  const safeType = (entity.entityType || "Entity").toLowerCase();
  const matchedType = ontologyTypes.find(
    (t) => (t.name || "").toLowerCase() === safeType,
  );

  const typeColor =
    matchedType?.color || getEntityColor(entity.entityType, isDark);
  const typeLabel = matchedType?.label || entity.entityType || "Entity";

  const keyFields = useMemo(
    () =>
      pickKeyCardFields(
        entity.entityType,
        entity.properties || {},
        entity.createdAt,
        4,
      ),
    [entity.entityType, entity.properties, entity.createdAt],
  );

  const hasVisibleSensitiveField = useMemo(
    () => keyFields.some((f) => !f.isSystemDate && isSensitiveField(f.key)),
    [keyFields],
  );

  const isMasked = maskSensitiveData && !localReveal;
  const nameHighlighted = entity.highlights?.["canonicalName"]?.[0];

  const hasConfidence =
    typeof entity.confidenceScore === "number" &&
    Number.isFinite(entity.confidenceScore);
  const confidencePct = hasConfidence
    ? Math.round(
        entity.confidenceScore! <= 1
          ? entity.confidenceScore! * 100
          : entity.confidenceScore!,
      )
    : null;

  const hasSourceCount =
    typeof entity.sourceCount === "number" &&
    Number.isFinite(entity.sourceCount);

  const sourceSummary = useMemo(() => {
    if (!hasSourceCount) return null;
    const count = entity.sourceCount!;
    const base = count > 1 ? `Merged from ${count} records` : "1 source record";
    if (entity.sourceSystems && entity.sourceSystems.length > 0) {
      return `${base} · ${entity.sourceSystems.join(", ")}`;
    }
    return base;
  }, [hasSourceCount, entity.sourceCount, entity.sourceSystems]);

  return (
    <article
      data-id={entity.id}
      className="relative bg-surface border border-border hover:border-primary/50 rounded-xl p-4 shadow-xs hover:shadow-sm transition-all duration-150 motion-reduce:transition-none flex flex-col justify-between gap-4 group has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:border-primary"
    >
      {/* Full-card stretched button so the entire card is a single keyboard-focusable button */}
      <button
        type="button"
        onClick={(e) => onSelect(entity, e.currentTarget)}
        aria-label={`Inspect ${entity.canonicalName} (${typeLabel})`}
        className="absolute inset-0 z-0 rounded-xl cursor-pointer focus:outline-none"
      />

      {/* Title Row */}
      <div className="relative z-10 pointer-events-none flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center border shrink-0"
            style={{
              backgroundColor: `${typeColor}14`,
              borderColor: `${typeColor}33`,
              color: typeColor,
            }}
            aria-hidden="true"
          >
            <EntityTypeIcon entityType={entity.entityType} size={18} />
          </div>

          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text leading-snug truncate group-hover:text-primary transition-colors duration-150 motion-reduce:transition-none">
              {nameHighlighted ? (
                <span
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(nameHighlighted),
                  }}
                  className="[&>em]:bg-primary-tint [&>em]:text-primary [&>em]:not-italic [&>em]:font-semibold [&>em]:px-0.5 [&>em]:rounded"
                />
              ) : (
                entity.canonicalName || "Unnamed Entity"
              )}
            </h3>
            <span className="text-[11px] font-mono text-text-muted truncate block">
              {entity.id.slice(0, 8)}
            </span>
          </div>
        </div>

        {/* Entity Type Tag */}
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-md border shrink-0"
          style={{
            backgroundColor: `${typeColor}12`,
            borderColor: `${typeColor}30`,
            color: typeColor,
          }}
        >
          <EntityTypeIcon entityType={entity.entityType} size={11} />
          <span className="max-w-[120px] truncate">{typeLabel}</span>
        </span>
      </div>

      {/* Possible duplicate banner — ONLY shown if API explicitly flags it */}
      {entity.possibleDuplicate && (
        <div className="relative z-20 flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-warning-bg border border-warning-border text-xs text-warning">
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertTriangle size={13} className="shrink-0" aria-hidden="true" />
            <span className="truncate">
              Possible duplicate of{" "}
              <strong className="font-semibold">
                {entity.possibleDuplicate.name}
              </strong>
            </span>
          </div>
          <Link
            to="/connections/merge-review"
            className="text-[11px] font-semibold underline shrink-0 hover:opacity-80"
          >
            Fusion Review
          </Link>
        </div>
      )}

      {/* 3 to 4 Key Fields Grid */}
      <EntityCardFields
        keyFields={keyFields}
        highlights={entity.highlights}
        isMasked={isMasked}
      />

      {/* Footer: Provenance, Confidence, Optional Reveal & Why Merged */}
      <EntityCardFooter
        canonicalName={entity.canonicalName}
        sourceSummary={sourceSummary}
        confidencePct={confidencePct}
        matchReasons={entity.matchReasons}
        showWhyMerged={showWhyMerged}
        onToggleWhyMerged={() => setShowWhyMerged((prev) => !prev)}
        showRevealToggle={maskSensitiveData && hasVisibleSensitiveField}
        localReveal={localReveal}
        onToggleReveal={() => setLocalReveal((prev) => !prev)}
      />
    </article>
  );
};
