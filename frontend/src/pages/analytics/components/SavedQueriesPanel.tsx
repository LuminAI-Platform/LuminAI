import React from "react";
import type { SavedQuery } from "../../../features/datasets/types";

interface SavedQueriesPanelProps {
  savedQueries: SavedQuery[];
  onSelectQuery: (sql: string) => void;
}

export const SavedQueriesPanel: React.FC<SavedQueriesPanelProps> = ({
  savedQueries,
  onSelectQuery,
}) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
          Saved Queries ({savedQueries.length})
        </h3>
        {savedQueries.length === 0 ? (
          <span className="text-xs text-text-secondary">
            No queries saved yet.
          </span>
        ) : (
          <div className="flex flex-col gap-2">
            {savedQueries.map((sq) => (
              <button
                key={sq.id}
                onClick={() => onSelectQuery(sq.sqlText)}
                className="p-2.5 rounded-lg border border-border bg-surface-subtle hover:border-primary text-left text-xs transition-colors cursor-pointer"
              >
                <span className="font-semibold text-text block">{sq.name}</span>
                <span className="text-[11px] text-text-secondary truncate block font-mono mt-0.5">
                  {sq.sqlText}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
