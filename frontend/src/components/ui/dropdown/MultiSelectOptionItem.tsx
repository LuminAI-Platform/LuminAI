import React from "react";
import { Check } from "../../../lib/icons";
import { Tooltip } from "../Tooltip";
import type { MultiSelectOption } from "./MultiSelect";

interface MultiSelectOptionItemProps {
  option: MultiSelectOption;
  isSelected: boolean;
  onToggle: (val: string) => void;
}

export const MultiSelectOptionItem: React.FC<MultiSelectOptionItemProps> = ({
  option: opt,
  isSelected,
  onToggle,
}) => {
  const itemNode = (
    <div
      role="option"
      aria-selected={isSelected}
      aria-disabled={opt.disabled}
      tabIndex={opt.disabled ? -1 : 0}
      onClick={() => !opt.disabled && onToggle(opt.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!opt.disabled) onToggle(opt.value);
        }
      }}
      className={[
        "w-full h-9 min-h-[40px] sm:min-h-[36px] px-2.5 rounded-lg flex items-center justify-between gap-2.5",
        "text-sm font-medium transition-colors text-left cursor-pointer",
        "hover:bg-surface-hover focus:bg-surface-hover focus:outline-none",
        isSelected
          ? "bg-primary-tint text-primary font-semibold"
          : "text-text hover:text-text",
        opt.disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div
          className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
            isSelected
              ? "bg-primary border-primary text-primary-text"
              : "bg-surface border-border text-transparent"
          }`}
        >
          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
        </div>

        {opt.icon && (
          <span
            className={`w-4 h-4 shrink-0 flex items-center justify-center ${
              isSelected ? "text-primary" : "text-text-secondary"
            }`}
          >
            {opt.icon}
          </span>
        )}

        <span className="truncate">{opt.label}</span>
      </div>

      {opt.count !== undefined && (
        <span
          className={`text-[11px] font-mono px-1.5 py-0.5 rounded shrink-0 transition-colors ${
            isSelected
              ? "bg-primary/20 text-primary font-bold"
              : "bg-surface-subtle text-text-secondary"
          }`}
        >
          {opt.count}
        </span>
      )}
    </div>
  );

  if (opt.disabled && opt.disabledTooltip) {
    return (
      <Tooltip label={opt.disabledTooltip} side="right">
        <div className="w-full">{itemNode}</div>
      </Tooltip>
    );
  }

  return itemNode;
};
