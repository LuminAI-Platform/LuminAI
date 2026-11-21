import React, { useEffect, useRef, useState } from "react";
import { Sliders } from "../../../lib/icons";
import type { ColumnDef } from "./EntityTableRow";

interface EntityTableColumnMenuProps {
  allColumns: ColumnDef[];
  hiddenCols: Set<string>;
  onToggleColumn: (colId: string) => void;
}

export const EntityTableColumnMenu: React.FC<EntityTableColumnMenuProps> = ({
  allColumns,
  hiddenCols,
  onToggleColumn,
}) => {
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!colMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setColMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [colMenuOpen]);

  return (
    <div className="flex items-center justify-end px-4 py-2 border-b border-border-subtle bg-surface-subtle/50">
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setColMenuOpen((v) => !v)}
          aria-expanded={colMenuOpen}
          aria-haspopup="menu"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-text-secondary hover:text-text bg-surface border border-border hover:bg-surface-hover transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
        >
          <Sliders size={13} aria-hidden="true" />
          <span>Columns</span>
        </button>

        {colMenuOpen && (
          <div
            role="menu"
            aria-label="Toggle table columns"
            className="absolute right-0 mt-1.5 w-52 p-2 rounded-xl bg-surface border border-border shadow-lg z-30 flex flex-col gap-1"
          >
            {allColumns.map((col) => {
              const isVisible = !hiddenCols.has(col.id);
              const isLocked = col.id === "canonicalName";
              return (
                <label
                  key={col.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${
                    isLocked
                      ? "opacity-60 cursor-not-allowed"
                      : "hover:bg-surface-hover cursor-pointer"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    disabled={isLocked}
                    onChange={() => onToggleColumn(col.id)}
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                  />
                  <span className="text-text truncate">{col.label}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
