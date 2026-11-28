import React, { useState } from "react";
import { Check, Copy } from "../../../lib/icons";
import { Tooltip } from "../../../components/ui/Tooltip";
import { sanitizeHtml } from "../../../lib/sanitize";
import { truncateMiddle } from "../../../pages/explorer/utils";
import { EntityTypeIcon } from "./EntityTypeIcon";

interface EntityCardHeaderProps {
  entityType: string;
  typeColor: string;
  typeLabel: string;
  displayLabel: string;
  entityId: string;
  nameHighlighted?: string;
}

export const EntityCardHeader: React.FC<EntityCardHeaderProps> = ({
  entityType,
  typeColor,
  typeLabel,
  displayLabel,
  entityId,
  nameHighlighted,
}) => {
  const [copied, setCopied] = useState(false);

  const shortId = entityId.slice(0, 8);
  const chipDisplayLabel = truncateMiddle(typeLabel, 40);

  const handleCopyId = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(entityId);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative z-10 pointer-events-none flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 mt-0.5"
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
          <h3
            title={displayLabel}
            className="text-sm font-semibold text-text leading-snug truncate group-hover:text-primary transition-colors duration-150 motion-reduce:transition-none"
          >
            {nameHighlighted ? (
              <span
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(nameHighlighted),
                }}
                className="[&>em]:bg-primary-tint [&>em]:text-primary [&>em]:not-italic [&>em]:font-semibold [&>em]:px-0.5 [&>em]:rounded"
              />
            ) : (
              displayLabel
            )}
          </h3>
          <div className="flex items-center gap-1 mt-0.5">
            <span
              title={entityId}
              className="text-[11px] font-mono text-text-muted truncate"
            >
              {shortId}
            </span>
            <Tooltip
              label={copied ? "Copied ID" : "Copy full entity ID"}
              side="bottom"
            >
              <button
                type="button"
                onClick={handleCopyId}
                aria-label={
                  copied
                    ? `Copied entity ID ${shortId}`
                    : `Copy entity ID ${shortId}`
                }
                className="pointer-events-auto relative z-20 p-0.5 rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors duration-150 motion-reduce:transition-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {copied ? (
                  <Check
                    size={11}
                    className="text-success"
                    aria-hidden="true"
                  />
                ) : (
                  <Copy size={11} aria-hidden="true" />
                )}
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      <Tooltip label={typeLabel} side="top">
        <span
          title={typeLabel}
          className="pointer-events-auto relative z-20 inline-flex items-start gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-md border shrink-0 max-w-[185px]"
          style={{
            backgroundColor: `${typeColor}12`,
            borderColor: `${typeColor}30`,
            color: typeColor,
          }}
        >
          <span className="mt-0.5 shrink-0" aria-hidden="true">
            <EntityTypeIcon entityType={entityType} size={11} />
          </span>
          <span className="leading-tight line-clamp-2 break-words">
            {chipDisplayLabel}
          </span>
        </span>
      </Tooltip>
    </div>
  );
};
