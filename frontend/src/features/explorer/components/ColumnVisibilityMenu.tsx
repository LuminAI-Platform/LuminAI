import React, { useRef, useEffect } from "react";
import { Sliders } from "../../../lib/icons";
import type { ColumnDef } from "./EntityTableRow";

interface ColumnVisibilityMenuProps {
  allColumns: ColumnDef[];
  hiddenCols: Set<string>;
  isOpen: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
  onToggleColumn: (colId: string) => void;
}

export const ColumnVisibilityMenu: React.FC<ColumnVisibilityMenuProps> = ({
  allColumns,
  hiddenCols,
  isOpen,
  onToggleOpen,
  onClose,
  onToggleColumn,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen, onClose]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-text-secondary hover:text-text bg-surface border border-border hover:bg-surface-hover transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
      >
        <Sliders size={13} aria-hidden="true" />
        <span>Columns</span>
      </button>

      {isOpen && (
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
  );
};
