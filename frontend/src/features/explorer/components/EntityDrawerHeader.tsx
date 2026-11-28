import React from "react";
import { X, GitMerge } from "../../../lib/icons";
import { Tooltip } from "../../../components/ui/Tooltip";
import { EntityTypeIcon } from "./EntityTypeIcon";

interface EntityDrawerHeaderProps {
  activeEntityType: string;
  typeColor: string;
  typeLabel: string;
  displayLabel: string;
  sourceCount?: number;
  onClose: () => void;
  closeBtnRef: React.RefObject<HTMLButtonElement | null>;
}

export const EntityDrawerHeader: React.FC<EntityDrawerHeaderProps> = ({
  activeEntityType,
  typeColor,
  typeLabel,
  displayLabel,
  sourceCount,
  onClose,
  closeBtnRef,
}) => {
  const sourceStatusLabel =
    typeof sourceCount === "number"
      ? sourceCount >= 2
        ? `Merged from ${sourceCount} records`
        : "Unique record"
      : null;

  return (
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
            {displayLabel}
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <Tooltip label={typeLabel} side="bottom">
              <span
                title={typeLabel}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border max-w-full"
                style={{
                  backgroundColor: `${typeColor}12`,
                  borderColor: `${typeColor}30`,
                  color: typeColor,
                }}
              >
                <EntityTypeIcon entityType={activeEntityType} size={11} />
                <span className="break-words leading-tight">{typeLabel}</span>
              </span>
            </Tooltip>

            {sourceStatusLabel && (
              <span className="inline-flex items-center gap-1 text-[11px] text-text-secondary">
                <GitMerge size={12} aria-hidden="true" />
                <span>{sourceStatusLabel}</span>
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
        className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-surface-hover border border-transparent hover:border-border transition-colors duration-150 motion-reduce:transition-none cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
};
