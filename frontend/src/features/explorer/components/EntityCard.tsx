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
import { sanitizeHtml } from "../../../lib/sanitize";
import type { EntityType } from "../../ontology/types";
import { getEntityColor } from "../../../lib/entityColors";
import { useThemeStore } from "../../../stores/themeStore";
import type { SearchResultItem } from "../../../pages/explorer/types";
import {
  isSensitiveField,
  maskSensitiveValue,
  pickKeyCardFields,
} from "../../../pages/explorer/utils";
import { EntityTypeIcon } from "./EntityTypeIcon";

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
      {keyFields.length > 0 && (
        <dl className="relative z-10 pointer-events-none grid grid-cols-2 gap-x-4 gap-y-2.5 py-3 border-t border-b border-border-subtle">
          {keyFields.map((field) => {
            const sensitive =
              !field.isSystemDate && isSensitiveField(field.key);
            const rawHighlight =
              !isMasked &&
              (entity.highlights?.[field.key]?.[0] ||
                entity.highlights?.[`properties.${field.key}`]?.[0]);

            const displayValue = field.isSystemDate
              ? String(field.value)
              : maskSensitiveValue(field.key, field.value, isMasked);

            return (
              <div key={field.key} className="min-w-0 flex flex-col gap-0.5">
                <dt className="text-[11px] text-text-muted font-medium truncate">
                  {field.label}
                </dt>
                <dd
                  className={`text-xs text-text font-medium truncate ${sensitive && isMasked
                      ? "font-mono tracking-wider text-text-secondary"
                      : ""
                    }`}
                >
                  {rawHighlight ? (
                    <span
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(rawHighlight),
                      }}
                      className="[&>em]:bg-primary-tint [&>em]:text-primary [&>em]:not-italic [&>em]:font-semibold [&>em]:px-0.5 [&>em]:rounded"
                    />
                  ) : (
                    displayValue
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      {/* Footer: Provenance, Confidence, Optional Reveal & Why Merged */}
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
          {/* Why merged? popover — ONLY rendered when API returns matchReasons */}
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

          {/* Per-card Reveal / Hide button when masking is enabled and sensitive fields are present */}
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
