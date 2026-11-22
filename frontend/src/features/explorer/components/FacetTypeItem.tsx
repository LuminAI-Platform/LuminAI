import React from "react";
import { getEntityTypeIcon } from "../../../pages/explorer/utils";

export interface MergedTypeRow {
  name: string;
  label: string;
  count: number;
  color: string;
}

interface FacetTypeItemProps {
  row: MergedTypeRow;
  isChecked: boolean;
  onToggle: (typeName: string) => void;
}

export const FacetTypeItem: React.FC<FacetTypeItemProps> = ({
  row,
  isChecked,
  onToggle,
}) => {
  return (
    <label
      key={row.name}
      title={row.label}
      className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border transition-colors duration-150 motion-reduce:transition-none cursor-pointer ${
        isChecked
          ? "bg-primary-tint border-primary-border text-text"
          : "bg-transparent border-transparent hover:bg-surface-hover text-text-secondary hover:text-text"
      } ${row.count === 0 && !isChecked ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => onToggle(row.name)}
          className="h-4 w-4 rounded border-border accent-primary cursor-pointer shrink-0"
        />

        <span
          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
          style={{
            backgroundColor: `${row.color}18`,
            color: row.color,
          }}
          aria-hidden="true"
        >
          {React.createElement(getEntityTypeIcon(row.name), { size: 13 })}
        </span>

        <span className="text-xs font-medium truncate">{row.label}</span>
      </div>

      <span
        className={`text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${
          isChecked
            ? "bg-primary/15 text-primary"
            : "bg-surface-subtle text-text-muted"
        }`}
      >
        {row.count}
      </span>
    </label>
  );
};
