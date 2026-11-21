import React from "react";
import { ChevronDown, ChevronRight } from "../../../lib/icons";
import { formatPropertyLabel } from "../../../pages/explorer/utils";

interface ExtraFacetGroupProps {
  groupKey: string;
  entries: Record<string, number>;
  isOpen: boolean;
  onToggle: () => void;
}

export const ExtraFacetGroup: React.FC<ExtraFacetGroupProps> = ({
  groupKey,
  entries,
  isOpen,
  onToggle,
}) => {
  const sortedEntries = Object.entries(entries).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );

  return (
    <div className="pt-3 border-t border-border-subtle flex flex-col gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex items-center justify-between w-full text-left py-1 text-xs font-semibold text-text hover:text-primary transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
      >
        <span>{formatPropertyLabel(groupKey)}</span>
        {isOpen ? (
          <ChevronDown
            size={14}
            className="text-text-muted"
            aria-hidden="true"
          />
        ) : (
          <ChevronRight
            size={14}
            className="text-text-muted"
            aria-hidden="true"
          />
        )}
      </button>

      {isOpen && (
        <div className="flex flex-col gap-1">
          {sortedEntries.map(([val, count]) => (
            <div
              key={val}
              title={val}
              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-text-secondary"
            >
              <span className="truncate">{val}</span>
              <span className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-surface-subtle text-text-muted shrink-0">
                {count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
