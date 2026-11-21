import React from "react";
import type { SavedQuery } from "../../../features/datasets/types";

interface SqlSidePanelProps {
  savedQueries: SavedQuery[];
  onSelectQuery: (sqlText: string) => void;
}

export const SqlSidePanel: React.FC<SqlSidePanelProps> = ({
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
                type="button"
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

      <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
          Query Templates
        </h3>
        <button
          type="button"
          onClick={() =>
            onSelectQuery(
              "SELECT * FROM customers WHERE tier = 'Enterprise' LIMIT 50;",
            )
          }
          className="text-left text-xs text-primary hover:underline cursor-pointer"
        >
          • Filter by Customer Tier
        </button>
        <button
          type="button"
          onClick={() =>
            onSelectQuery(
              "SELECT entity_type, COUNT(*) AS count FROM golden_records GROUP BY entity_type;",
            )
          }
          className="text-left text-xs text-primary hover:underline cursor-pointer"
        >
          • Golden Records Entity Breakdown
        </button>
      </div>
    </div>
  );
};
