import React from "react";
import { sanitizeHtml } from "../../../lib/sanitize";
import { EntityTypeIcon } from "./EntityTypeIcon";

interface EntityCardHeaderProps {
  entityType: string;
  typeColor: string;
  typeLabel: string;
  canonicalName: string;
  entityId: string;
  nameHighlighted?: string;
}

export const EntityCardHeader: React.FC<EntityCardHeaderProps> = ({
  entityType,
  typeColor,
  typeLabel,
  canonicalName,
  entityId,
  nameHighlighted,
}) => {
  return (
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
          <EntityTypeIcon entityType={entityType} size={18} />
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
              canonicalName || "Unnamed Entity"
            )}
          </h3>
          <span className="text-[11px] font-mono text-text-muted truncate block">
            {entityId.slice(0, 8)}
          </span>
        </div>
      </div>

      <span
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-md border shrink-0"
        style={{
          backgroundColor: `${typeColor}12`,
          borderColor: `${typeColor}30`,
          color: typeColor,
        }}
      >
        <EntityTypeIcon entityType={entityType} size={11} />
        <span className="max-w-[120px] truncate">{typeLabel}</span>
      </span>
    </div>
  );
};
