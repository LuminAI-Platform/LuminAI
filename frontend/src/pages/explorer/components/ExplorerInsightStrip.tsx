import React, { useMemo } from "react";
import type { ExplorerInsightCounts } from "../types";

interface ExplorerInsightStripProps {
  insights?: ExplorerInsightCounts;
  onSelectInsight: (queryToken: string) => void;
}

export const ExplorerInsightStrip: React.FC<ExplorerInsightStripProps> = ({
  insights,
  onSelectInsight,
}) => {
  const insightChips = useMemo(() => {
    if (!insights) return [];
    const chips: Array<{ key: string; label: string; count: number }> = [];
    if (
      typeof insights.possibleDuplicates === "number" &&
      insights.possibleDuplicates > 0
    ) {
      chips.push({
        key: "duplicates",
        label: "Possible duplicates",
        count: insights.possibleDuplicates,
      });
    }
    if (
      typeof insights.missingValues === "number" &&
      insights.missingValues > 0
    ) {
      chips.push({
        key: "missing",
        label: "Missing values",
        count: insights.missingValues,
      });
    }
    if (typeof insights.needsReview === "number" && insights.needsReview > 0) {
      chips.push({
        key: "review",
        label: "Needs review",
        count: insights.needsReview,
      });
    }
    return chips;
  }, [insights]);

  if (insightChips.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-border"
      aria-label="Engine insights"
    >
      {insightChips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onSelectInsight(`${chip.key}:true`)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary-tint text-primary border border-primary-border hover:opacity-90 transition-opacity duration-150 motion-reduce:transition-none cursor-pointer"
        >
          <span>{chip.label}</span>
          <span className="font-mono font-bold">{chip.count}</span>
        </button>
      ))}
    </div>
  );
};
