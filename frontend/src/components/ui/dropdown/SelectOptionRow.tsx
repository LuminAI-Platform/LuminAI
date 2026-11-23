import React from "react";
import { Check, ICON_SIZES } from "../../../lib/icons";
import { Tooltip } from "../Tooltip";
import type { SelectOption } from "./Select";

interface SelectOptionRowProps {
  opt: SelectOption;
  isSelected: boolean;
  onSelect: (val: string) => void;
}

export const SelectOptionRow: React.FC<SelectOptionRowProps> = ({
  opt,
  isSelected,
  onSelect,
}) => {
  const itemNode = (
    <div
      role="option"
      aria-selected={isSelected}
      aria-disabled={opt.disabled}
      tabIndex={opt.disabled ? -1 : 0}
      onClick={() => !opt.disabled && onSelect(opt.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!opt.disabled) onSelect(opt.value);
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

      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        {opt.hint && (
          <span className="text-xs text-text-muted">{opt.hint}</span>
        )}
        {isSelected && (
          <Check
            size={ICON_SIZES.dropdown}
            className="text-primary shrink-0"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );

  if (opt.disabled && opt.disabledTooltip) {
    return (
      <Tooltip key={opt.value} label={opt.disabledTooltip} side="right">
        <div className="w-full">{itemNode}</div>
      </Tooltip>
    );
  }

  return itemNode;
};
