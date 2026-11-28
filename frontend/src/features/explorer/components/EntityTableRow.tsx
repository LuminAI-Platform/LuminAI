import React from "react";
import { Sparkles, GitMerge } from "../../../lib/icons";
import { Tooltip } from "../../../components/ui/Tooltip";
import type { EntityType } from "../../ontology/types";
import { getEntityColor } from "../../../lib/entityColors";
import type { SearchResultItem } from "../../../pages/explorer/types";
import {
  formatShortDate,
  getEntityTypeIcon,
  isSensitiveField,
  maskSensitiveValue,
  resolveEntityLabel,
  truncateMiddle,
  type TypeLabelFieldMap,
} from "../../../pages/explorer/utils";

export interface ColumnDef {
  id: string;
  label: string;
  sortable: boolean;
  isProperty?: boolean;
}

interface EntityTableRowProps {
  entity: SearchResultItem;
  ontologyTypes: EntityType[];
  typeLabelFields?: TypeLabelFieldMap;
  visibleColumns: ColumnDef[];
  maskSensitiveData: boolean;
  isDark: boolean;
  onSelect: (entity: SearchResultItem, triggerEl: HTMLElement | null) => void;
}

export const EntityTableRow: React.FC<EntityTableRowProps> = ({
  entity,
  ontologyTypes,
  typeLabelFields,
  visibleColumns,
  maskSensitiveData,
  isDark,
  onSelect,
}) => {
  const safeType = (entity.entityType || "Entity").toLowerCase();
  const matchedType = ontologyTypes.find(
    (t) => (t.name || "").toLowerCase() === safeType,
  );
  const typeColor =
    matchedType?.color || getEntityColor(entity.entityType, isDark);
  const TypeIcon = getEntityTypeIcon(entity.entityType);
  const typeLabel = matchedType?.label || entity.entityType;
  const displayLabel = resolveEntityLabel(
    entity,
    typeLabelFields,
    maskSensitiveData,
  );
  const isMerged =
    typeof entity.sourceCount === "number" && entity.sourceCount >= 2;

  return (
    <tr
      tabIndex={0}
      role="button"
      aria-label={`Inspect ${displayLabel} (${typeLabel})`}
      onClick={(e) => onSelect(entity, e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(entity, e.currentTarget);
        }
      }}
      className="hover:bg-surface-hover focus-visible:outline-none focus-visible:bg-primary-tint/50 transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
    >
      {visibleColumns.map((col) => {
        if (col.id === "canonicalName") {
          return (
            <td
              key={col.id}
              className="px-4 py-3 text-sm font-semibold text-text whitespace-nowrap max-w-[260px]"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center border shrink-0"
                  style={{
                    backgroundColor: `${typeColor}14`,
                    borderColor: `${typeColor}30`,
                    color: typeColor,
                  }}
                  aria-hidden="true"
                >
                  <TypeIcon size={14} />
                </span>
                <div className="min-w-0">
                  <div title={displayLabel} className="truncate">
                    {displayLabel}
                  </div>
                  <div className="text-[11px] font-mono font-normal text-text-muted">
                    {entity.id.slice(0, 8)}
                  </div>
                </div>
              </div>
            </td>
          );
        }

        if (col.id === "entityType") {
          return (
            <td key={col.id} className="px-4 py-3 whitespace-nowrap">
              <Tooltip label={typeLabel} side="top">
                <span
                  title={typeLabel}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border"
                  style={{
                    backgroundColor: `${typeColor}12`,
                    borderColor: `${typeColor}30`,
                    color: typeColor,
                  }}
                >
                  <TypeIcon size={11} aria-hidden="true" />
                  <span>{truncateMiddle(typeLabel, 34)}</span>
                </span>
              </Tooltip>
            </td>
          );
        }

        if (col.id === "confidenceScore") {
          const pct =
            isMerged && typeof entity.confidenceScore === "number"
              ? Math.round(
                  entity.confidenceScore <= 1
                    ? entity.confidenceScore * 100
                    : entity.confidenceScore,
                )
              : null;
          return (
            <td key={col.id} className="px-4 py-3 whitespace-nowrap">
              {pct !== null ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-primary-tint text-primary border border-primary-border">
                  <Sparkles size={10} aria-hidden="true" />
                  <span>{pct}%</span>
                </span>
              ) : (
                <span className="text-xs text-text-muted">—</span>
              )}
            </td>
          );
        }

        if (col.id === "sourceCount") {
          return (
            <td
              key={col.id}
              className="px-4 py-3 text-xs text-text-secondary whitespace-nowrap"
            >
              {typeof entity.sourceCount === "number" ? (
                <span className="inline-flex items-center gap-1">
                  <GitMerge
                    size={12}
                    className="text-text-muted"
                    aria-hidden="true"
                  />
                  <span>
                    {entity.sourceCount === 1
                      ? "Unique (1)"
                      : `${entity.sourceCount} merged`}
                  </span>
                </span>
              ) : (
                "—"
              )}
            </td>
          );
        }

        if (col.id === "updatedAt") {
          const dateStr = formatShortDate(entity.updatedAt || entity.createdAt);
          return (
            <td
              key={col.id}
              className="px-4 py-3 text-xs text-text-secondary whitespace-nowrap"
            >
              {dateStr || "—"}
            </td>
          );
        }

        if (col.id.startsWith("prop:")) {
          const propKey = col.id.slice(5);
          const val = entity.properties?.[propKey];
          const sensitive = isSensitiveField(propKey);
          const display = maskSensitiveValue(propKey, val, maskSensitiveData);
          return (
            <td
              key={col.id}
              className={`px-4 py-3 text-xs whitespace-nowrap max-w-[200px] truncate ${
                sensitive && maskSensitiveData
                  ? "font-mono text-text-secondary tracking-wider"
                  : "text-text"
              }`}
            >
              {display}
            </td>
          );
        }

        return null;
      })}
    </tr>
  );
};
