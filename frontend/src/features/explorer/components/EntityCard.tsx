import React, { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Eye,
  EyeOff,
  GitMerge,
  AlertTriangle,
  Info,
  Sparkles,
} from "../../../lib/icons";
import type { EntityType } from "../../ontology/types";
import { getEntityColor } from "../../../lib/entityColors";
import { useThemeStore } from "../../../stores/themeStore";
import type { SearchResultItem } from "../../../pages/explorer/types";
import {
  isSensitiveField,
  pickKeyCardFields,
} from "../../../pages/explorer/utils";
import { EntityCardHeader } from "./EntityCardHeader";
import { EntityCardFields } from "./EntityCardFields";

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

  const hasMatchReasons =
    Array.isArray(entity.matchReasons) && entity.matchReasons.length > 0;

  return (
    <article
      data-id={entity.id}
      className="relative bg-surface border border-border hover:border-primary/50 rounded-xl p-4 shadow-xs hover:shadow-sm transition-all duration-150 motion-reduce:transition-none flex flex-col justify-between gap-4 group has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:border-primary"
    >
      <button
        type="button"
        onClick={(e) => onSelect(entity, e.currentTarget)}
        aria-label={`Inspect ${entity.canonicalName} (${typeLabel})`}
        className="absolute inset-0 z-0 rounded-xl cursor-pointer focus:outline-none"
      />

      <EntityCardHeader
        entityType={entity.entityType}
        typeColor={typeColor}
        typeLabel={typeLabel}
        canonicalName={entity.canonicalName}
        entityId={entity.id}
        nameHighlighted={nameHighlighted}
      />

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

      <EntityCardFields
        keyFields={keyFields}
        isMasked={isMasked}
        highlights={entity.highlights}
      />

      <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <div className="flex flex-wrap items-center gap-2 min-w-0 pointer-events-none">
          {sourceSummary && (
            <span className="inline-flex items-center gap-1 text-[11px] text-text-secondary truncate">
              <GitMerge
                size={12}
                className="text-text-muted shrink-0"
                aria-hidden="true"
              />
              <span className="truncate">{sourceSummary}</span>
            </span>
          )}

          {confidencePct !== null && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-primary-tint text-primary border border-primary-border shrink-0">
              <Sparkles size={11} aria-hidden="true" />
              <span>{confidencePct}%</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {hasMatchReasons && (
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowWhyMerged((prev) => !prev);
                }}
                aria-expanded={showWhyMerged}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-primary hover:bg-primary-tint transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
              >
                <Info size={12} aria-hidden="true" />
                <span>Why merged?</span>
              </button>
              {showWhyMerged && (
                <div
                  role="dialog"
                  aria-label="Match reasons"
                  className="absolute right-0 bottom-full mb-2 w-64 p-3 rounded-xl bg-surface border border-border shadow-lg z-30 text-xs text-text"
                >
                  <div className="font-semibold text-text mb-1.5">
                    Match details
                  </div>
                  <ul className="flex flex-col gap-1">
                    {entity.matchReasons!.map((reason, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between gap-2 text-[11px] text-text-secondary"
                      >
                        <span className="truncate">
                          {reason.field || reason.rule || reason.detail}
                        </span>
                        {typeof reason.score === "number" && (
                          <span className="font-mono text-primary font-semibold shrink-0">
                            {Math.round(
                              reason.score <= 1
                                ? reason.score * 100
                                : reason.score,
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
          )}

          {maskSensitiveData && hasVisibleSensitiveField && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLocalReveal((prev) => !prev);
              }}
              aria-label={
                localReveal
                  ? `Mask sensitive fields for ${entity.canonicalName}`
                  : `Reveal sensitive fields for ${entity.canonicalName}`
              }
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-text-secondary hover:text-text hover:bg-surface-subtle border border-border-subtle transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
            >
              {localReveal ? (
                <>
                  <EyeOff size={12} aria-hidden="true" />
                  <span>Hide</span>
                </>
              ) : (
                <>
                  <Eye size={12} aria-hidden="true" />
                  <span>Reveal</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
