import React from "react";
import { Eye, EyeOff, GitMerge, Info, Sparkles } from "../../../lib/icons";
import type { MatchReason } from "../../../pages/explorer/types";

interface EntityCardFooterProps {
  canonicalName: string;
  sourceSummary: string | null;
  confidencePct: number | null;
  matchReasons?: MatchReason[];
  showWhyMerged: boolean;
  onToggleWhyMerged: () => void;
  showRevealToggle: boolean;
  localReveal: boolean;
  onToggleReveal: () => void;
}

export const EntityCardFooter: React.FC<EntityCardFooterProps> = ({
  canonicalName,
  sourceSummary,
  confidencePct,
  matchReasons,
  showWhyMerged,
  onToggleWhyMerged,
  showRevealToggle,
  localReveal,
  onToggleReveal,
}) => {
  const hasMatchReasons =
    Array.isArray(matchReasons) && matchReasons.length > 0;

  return (
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
                onToggleWhyMerged();
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
                  {matchReasons!.map((reason, idx) => (
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

        {showRevealToggle && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleReveal();
            }}
            aria-label={
              localReveal
                ? `Mask sensitive fields for ${canonicalName}`
                : `Reveal sensitive fields for ${canonicalName}`
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
  );
};
