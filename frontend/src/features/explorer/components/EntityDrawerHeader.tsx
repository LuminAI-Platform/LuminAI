import React from "react";
import { X, GitMerge, Sparkles } from "../../../lib/icons";
import { EntityTypeIcon } from "./EntityTypeIcon";

interface EntityDrawerHeaderProps {
  title: string;
  activeEntityType: string;
  typeLabel: string;
  typeColor: string;
  confidencePct: number | null;
  sourceCount?: number;
  closeBtnRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}

export const EntityDrawerHeader: React.FC<EntityDrawerHeaderProps> = ({
  title,
  activeEntityType,
  typeLabel,
  typeColor,
  confidencePct,
  sourceCount,
  closeBtnRef,
  onClose,
}) => {
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
            {title}
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
  );
};
